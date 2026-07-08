# BattleApp — Task Flows

**Phase 0 deliverable · written 2026-07-07**

Step-by-step sequences for the four core tasks, with offline, permission-denied, and failure
branches. Vocabulary from `glossary.md`; rules of play from `game-mechanics.md`; the commands and
events each step fires are in `event-storm.md`; screens named here are inventoried in
`user-flow.md`. Branch defaults confirmed by designer 2026-07-07
(`discussions/phase-0-wave-3.md`). V1 scope.

## 0. Shared branch policies

Confirmed defaults, referenced by the tasks below as **B1–B5**.

- **B1 — Offline while composing:** the draft autosaves to `AsyncStorage` on keystroke.
  Submitting while offline **queues** the Turn locally and sends on reconnect, with a
  "Draft saved — will send when you're back online" indicator. The queued submit carries a
  client-generated id so reconnect retries never produce duplicate Turns.
- **B2 — Offline while browsing:** the story list and already-viewed Story scrolls render
  **read-only from cache** — never a blank screen. Actions that need the server (submit, react,
  accept an invite, create a story) are disabled with an offline notice.
- **B3 — Push permission denied:** the game **still fully works**. Turn-ready, invites, reactions,
  and completions surface as **in-app badges** on the Stories tab and story rows. A soft,
  dismissible "notifications are off" nudge deep-links to OS notification settings.
  **No feature is gated on push.** (Permission is requested after the first Turn, per
  `device-apis.md` — this branch also covers the not-yet-asked state.)
- **B4 — Moderation reject:** the rejection reason shows inline on the compose screen; the author
  may **edit & resubmit freely, no penalty**. Rejected content is never stored (⚡ TurnRejected).
- **B5 — Submit failure (5xx / timeout):** the optimistically shown Section **rolls back**, the
  Turn content returns to the draft box intact, and a retry affordance appears.

## 1. Start a story

1. Stories tab → **New story**. ▶ StartStory → ⚡ StoryCreated (`lobby`) — **no settings yet**:
   configuration is fully deferred to the Settings Handshake (step 5), defaults loaded.
2. Invite the co-author by username or share link: ▶ InvitePlayer(author) → ⚡ AuthorInvited →
   push to the invitee.
3. Wait in the lobby — the story row shows "waiting for [invitee]". The creator writes **nothing**
   before activation.
4. On ⚡ InviteAccepted → ⚡ StoryActivated (`lobby → active`); the creator is notified
   ("game on").
5. **Settings Handshake:** the creator's settings sheet opens with defaults preloaded — Turn
   Limit, Pace Preset (**Fast 24h / Easy 72h**), Pure-Human Mode toggle (default off), optional
   Voice Parameters. The creator proposes — **keeping the defaults is one tap** — and the invitee
   **confirms** (⚡ SettingsConfirmed) or **requests changes**, which bounces the sheet back to
   the creator (the invitee never edits directly). Settings lock when the opening Turn is
   submitted; Voice Parameters stay adjustable mid-story via the hidden panel.
6. The creator composes the opening Turn (all of task 2's compose rules apply, including
   moderation) → ⚡ OpeningTurnAdded → ⚡ TurnPassed → invitee push-notified; the turn timer starts.

**Branches:** invite declined → ⚡ InviteDeclined; the story stays in `lobby`, the creator is
notified and may invite someone else or abandon it. Handshake never confirmed → the secondary
timeout auto-abandons. Offline → **B2** (creation, invite, and the handshake need the server).
Push denied → **B3** (acceptance and settings-confirmation surface as badges).

## 2. Take a turn

1. Entry: push "your turn" deep-links straight to the story (`battleapp://story/:id`), or the
   in-app badge (**B3**) → Story View → the compose affordance.
2. Read the scroll; compose **1–5 sentences, ≤ 500 characters**. Draft autosaves (**B1**).
3. If the turn timer has passed the director-hint fraction (default ½ of the Pace Preset span)
   with no Turn submitted, **one** dismissible AI Director hint card may be showing
   (⚡ DirectorHintGenerated / ⚡ HintDismissed). It never blocks composing or submitting.
4. Submit → the Section appears **optimistically** → moderation screens the content
   (▶ ModerateTurn, before storage).
5. Pass → ⚡ TurnAdded (Section reconciled, `sequence_number`++) → ⚡ TurnPassed → opponent
   push-notified; their timer starts.
6. If `sequence_number == turn_limit` → ⚡ StoryCompleted → end screen.

**Branches:** offline → **B1** (queue). Moderation reject → **B4**. Submit error → **B5**.

**While waiting (the other side of the loop):** after your Turn, the opponent walks the escalation
ladder — play → director hint (½ span) → fill-in warning push (deadline − 1h) → deadline. At
⚡ TurnTimedOut: Pure-Human Mode off → attributed **AI Fill-in** Turn and play continues; on →
⚡ StoryStalled — you are push-notified ("story stalled — extend or abandon?") and Story View
offers **Extend** (▶ ExtendStory) or **Abandon** (▶ AbandonStory); a longer secondary timeout
auto-abandons if you choose neither.

## 3. Spectate + react

1. Entry: Discover tab (public feed), a spectator-invite push, or a **share link** (universal
   link — opens the app if installed, else the read-only web view; guests welcome).
2. ▶ ViewStory → read-only Story scroll, updating as Turns land. AI Turns are visibly attributed.
3. React: tap like on a Section — **requires an account**. Signed in: ▶ AddReaction →
   ⚡ ReactionAdded (a toggle; ▶ RemoveReaction to unlike; one like per user per Section). The
   Section's author is notified, batched ≤ 5 min.
4. A **guest** tapping react hits the sign-up gate; after ⚡ PlayerRegistered they return to the
   same Story View.

**Branches:** offline → **B2** (cached, read-only). Reporting is available from any Section
(▶ ReportContent → ⚡ ContentReported, 24h-SLA review queue).

## 4. Respond to invite

1. Entry: push "invited you to a story" deep-links to the Invite screen; or the in-app badge
   (**B3**) on the Stories tab.
2. The Invite screen shows the inviter and notes that the story's settings (pace, turn limit,
   pure-human, voice) are **proposed by the creator after you accept** — you confirm them in the
   Settings Handshake before play begins.
3. Accept → ⚡ InviteAccepted → ⚡ StoryActivated. When the creator proposes the settings, the
   invitee gets a "confirm the story settings" push (or badge, **B3**), reviews the sheet
   read-only, and **confirms** or **requests changes**. After ⚡ SettingsConfirmed the story
   appears in Stories as "waiting for [creator]'s opening" — the invitee's first turn comes
   after ⚡ OpeningTurnAdded / ⚡ TurnPassed.
4. Decline → ⚡ InviteDeclined → the creator is notified; nothing else changes for the invitee.

**Branches:** push denied → **B3**. Offline → **B2** (the invite renders from cache; accept/decline
need the server and queue is *not* used here — the buttons disable with an offline notice, since
accepting starts a real-time obligation).
