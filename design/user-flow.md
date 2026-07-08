# BattleApp — User Flow

**Phase 0 deliverable · written 2026-07-07**

Full screen inventory, navigation structure, auth gates, deep-link and push entry points.
Vocabulary from `glossary.md`; task sequences in `task-flow.md`. Navigation decisions (bottom
tabs, deep-link scheme, notification routing) confirmed by designer 2026-07-07
(`discussions/phase-0-wave-3.md`). Diagram source: `user-flow-nav.mmd` (render locally with
`mmdc -i user-flow-nav.mmd -o user-flow-nav.svg`). V1 scope.

## 1. Navigation shell (confirmed)

**Bottom tabs**, visible only when signed in:

| Tab | Contents |
|-----|----------|
| **Stories** | Your stories — your-turn first, then waiting/lobby/stalled, then complete/abandoned (with status). In-app badges here when push is off/denied. |
| **Discover** | Public feed of spectatable stories. |
| **Profile** | Display name + avatar, settings (notifications nudge, account), blocked players. |

Story View, Compose, and Story Setup are **pushed/modal on top** of the tab shell. Auth screens
sit outside it.

## 2. Screen inventory

| # | Screen | Presentation | Reached from |
|---|--------|--------------|--------------|
| 1 | Welcome | signed-out root | app launch (no session) |
| 2 | Sign Up | push from Welcome | Welcome; guest react gate |
| 3 | Sign In | push from Welcome | Welcome |
| 4 | First-story prompt | one-time interstitial | after ⚡ PlayerRegistered ("start a story or browse") |
| 5 | Stories (tab) | tab root | shell |
| 6 | Discover (tab) | tab root | shell |
| 7 | Profile (tab) | tab root | shell |
| 8 | New Story | modal | Stories → New story; First-story prompt — **no settings here** (deferred to #19); creates the story and leads straight to the invite |
| 9 | Invite (send) | step within New Story | New Story (username or share link) |
| 10 | Invite Accept | pushed | invite push / badge; deep link while story in `lobby` |
| 11 | Story View | pushed | Stories row, Discover row, deep links, pushes |
| 12 | Compose | modal over Story View | "Your turn" affordance; your-turn push |
| 13 | End screen | replaces Story View top | ⚡ StoryCompleted (share affordance) |
| 14 | Stall choice | dialog over Story View | ⚡ StoryStalled (Pure-Human) — Extend / Abandon |
| 15 | Report sheet | sheet | any Section overflow |
| 16 | Block confirm | dialog | Profile of another player; Report sheet |
| 17 | Settings | pushed | Profile |
| 18 | Guest story view | web (universal link) / app read-only | share link without account |
| 19 | Settings sheet (handshake) | sheet over Story View | ⚡ StoryActivated (creator: editable, defaults preloaded, one-tap "start with defaults"); "confirm settings" push (invitee: read-only + Confirm / Request changes) |

## 3. Auth gates

- **Guest** (share link, no account): read-only Story View only. Tapping react → Sign Up (#2),
  returning to the same story after registration. Guests cannot reach the tab shell.
- **Everything inside the tab shell requires an account.** Participation (create, accept, turn)
  and reactions are account-only by definition.

## 4. Deep links (confirmed)

Scheme `battleapp://`; HTTPS **universal links are the share-out format** (better iMessage/web
previews); the web fallback for non-installers is the guest story view + store link.

| Link | Target |
|------|--------|
| `battleapp://story/:id` | Story View, resolved by viewer relationship & state: your turn → Compose ready · invitee while `lobby` → Invite Accept (#10) · participant otherwise → Story View · non-participant → spectate |
| `battleapp://story/:id/spectate` | Story View, read-only |
| `https://<domain>/story/:id` | universal link → same resolution as `battleapp://story/:id`; web guest view if not installed. *Domain TBD — placeholder `battleapp.app`; finalize before EAS config.* |

## 5. Push-notification entry points (confirmed)

Every push deep-links to the exact screen:

| Push | Fires on | Lands at |
|------|----------|----------|
| "Your turn" | ⚡ TurnPassed | Story View with Compose ready (#12) |
| Fill-in warning | ⚡ FillInWarningIssued (deadline − 1h) | Story View (#11) |
| Invite | ⚡ AuthorInvited / ⚡ SpectatorInvited | Invite Accept (#10) / Story View spectate |
| Settings to confirm | ⚡ SettingsProposed | Settings sheet, invitee confirm view (#19) |
| Reaction (batched ≤ 5 min) | ⚡ ReactionAdded | Story View scrolled to the Section |
| Story complete | ⚡ StoryCompleted | End screen (#13) |
| Story stalled (pure-human) | ⚡ StoryStalled | Story View with the Stall choice dialog (#14) |

*(The stall push was added to `event-storm.md` by designer decision 2026-07-07 — it closes the
gap this doc originally flagged.)*

With push denied or not yet granted, all seven entry points degrade to in-app badges
(task-flow **B3**). Permission is requested **after the first Turn** (`device-apis.md`).

## 6. Primary paths

- **Cold start, no session:** Welcome → Sign Up/In → (first registration: First-story prompt) →
  tab shell.
- **Create:** Stories → New Story → invite → lobby wait → activation → Settings Handshake
  (defaults = one tap; invitee confirms) → Compose opening → Story View.
- **Play:** push/badge → Story View → Compose → submit → back to Story View (or End screen at the
  turn limit).
- **Spectate:** Discover or share link → Story View (read-only) → react (account gate for guests).
- **Invite:** push/badge → Invite Accept → accept → confirm settings (handshake, #19) → Stories
  ("waiting for opening") / decline → back.

The complete map, including auth gates and deep-link resolution, is in `user-flow-nav.mmd`.
