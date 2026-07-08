# BattleApp — Event Storm

**Phase 0 deliverable · written 2026-07-03**

Domain events in temporal order (big-picture event storming), plus the completeness audit
pass. Vocabulary is from `glossary.md`. This drives `bounded-contexts.md` and
`domain-model.md`. V1 scope; V2 items are marked.

## Legend

- **⚡ Event** — something that happened (past tense), the durable record.
- **▶ Command** — an intent that triggers events (issued by an actor).
- **☰ Policy** — "whenever ⚡, do ▶" reactive rule.
- **☁ External** — outside system (Anthropic API, Expo Push, PostHog, Stripe→V2).
- **▦ Read model** — a projection a screen renders.
- **🔥 Hotspot** — unresolved question, flagged not buried.

## Timeline

### 1. Identity & onboarding
- ▶ SignUp → ⚡ **PlayerRegistered**
- ▶ SignIn → ⚡ **PlayerAuthenticated** (session issued; token → secure store)
- ▶ UpdateProfile → ⚡ **ProfileUpdated** (display name, avatar)
- ☰ On PlayerRegistered → prompt first Story or browse (▦ Home)

### 2. Story creation & invitation
- ▶ StartStory (mode=freeform; **no settings** — configuration is fully deferred to the Settings Handshake below, defaults loaded) → ⚡ **StoryCreated** (state=`lobby`) → ☁ PostHog `story_started`
- ▶ InvitePlayer (role=author) → ⚡ **AuthorInvited** → ☁ Push "invited you to a story"
- ▶ InvitePlayer (role=spectator) → ⚡ **SpectatorInvited**
- ▶ RespondToInvite(accept) → ⚡ **InviteAccepted**
- ▶ RespondToInvite(decline) → ⚡ **InviteDeclined**
- ☰ On InviteAccepted (author) → ⚡ **StoryActivated** (`lobby→active`) — **activation**: the game is on **only now**, not before.
- **Settings Handshake** (☰ on StoryActivated; see `glossary.md`): the creator's settings sheet opens, defaults preloaded → ▶ ProposeSettings (turn_limit, pace_preset, pure_human, voice — **keeping the defaults is one tap**) → ⚡ **SettingsProposed** → ☁ Push "confirm the story settings" → invitee ▶ ConfirmSettings → ⚡ **SettingsConfirmed**; or ▶ RequestSettingsChange → ⚡ **SettingsChangeRequested** (bounces back to the creator — the invitee never edits directly). Re-proposal allowed until the opening Turn; a handshake never confirmed auto-abandons via the secondary timeout.
- ▶ SetVoiceParameters (mid-story, via the hidden panel) → ⚡ **VoiceParametersUpdated** (per-Story dial-map shaping AI-authored content; initial dials are set in the Settings Handshake)
- ☰ On SettingsConfirmed → the creator writes the opening Turn: ▶ SubmitTurn(opening) → ⚡ **OpeningTurnAdded** → ⚡ **TurnPassed** (to invitee) → ☁ Push "your turn". **Submitting the opening Turn locks `turn_limit`, `pace_preset`, and `pure_human`** (voice stays adjustable).

### 3. Active play — the core loop
- ☰ On a Participant opening their turn → **no hint yet — let them play.**
- ☰ **Director-hint delay** (timer-gated): if the turn timer reaches a **configurable** fraction of the Pace Preset span (**default ½**) with **no Turn submitted**, → ▶ RequestDirectorHint → ☁ Anthropic → ⚡ **DirectorHintGenerated** → ▦ hint card. If the player has already submitted, **no hint fires** — which also cuts director calls (token efficiency).
- ⚡ **HintDismissed** (optional)
- ▶ SubmitTurn(content) → ☰ **Moderation** ▶ ModerateTurn → ☁ Anthropic → ⚡ **TurnModerated**(pass|reject)
  - pass → ⚡ **TurnAdded** (Section appears; sequence_number++) → ⚡ **TurnPassed** (to opponent) → ☁ Push "your turn" → ▦ Story scroll updated → ☁ PostHog `turn_submitted`
  - reject → ⚡ **TurnRejected** (author sees the reason; may **edit & resubmit freely, no penalty**; content not stored — the *moderation-rejection* branch)
- ☰ Optimistic: Section shown locally on submit, reconciled on TurnAdded / rolled back on TurnRejected (the *optimistic-reconciliation* branch)

### 4. Turn timer & AI fill-in
- ☰ On TurnPassed → start timer per Pace Preset (fast 24h / easy 72h)
- ⚡ **FillInWarningIssued** (1h before deadline) → ☁ Push to the waiting player's opponent
- ▶ (timer) → ⚡ **TurnTimedOut**
  - if `pure_human` off → ▶ RequestAIFillIn (reads the Story's Voice Parameters) → ☁ Anthropic → ⚡ **AIFillInGenerated** → ⚡ **TurnAdded** (author_type=ai, attributed "AI stepped in for [player]") → ⚡ TurnPassed → ☁ Push
  - if `pure_human` on → ⚡ **StoryStalled** → ☁ Push to the waiting player ("story stalled — extend or abandon?") → **pause**; the waiting player may ▶ ExtendStory (⚡ **StoryExtended**) or ▶ AbandonStory (⚡ **StoryAbandoned**); a longer secondary timeout auto-abandons if neither. *(Stall push added by designer decision 2026-07-07.)*
- **AITurnRejected** / **RegenerateAITurn** — placeholder names for the **V2 reject-and-retry** feature (no V1 control). The `Turn` model must carry **regeneration lineage** — a regenerated AI turn links to the turn it supersedes — so V2 wires on with no rework (see `domain-model.md`).

### 5. Spectating & reactions
- ▶ ViewStory (Participant, signed-in Spectator, or **guest** via share link) → ▦ Story scroll (read-only for spectators; **guests can't react until they sign up**)
- ▶ AddReaction(section) → ⚡ **ReactionAdded** → ☁ Push "liked your line" (batched ≤5min) → ▦ reaction count
- ▶ RemoveReaction(section) → ⚡ **ReactionRemoved**

### 6. Ending a story
- ☰ On TurnAdded where sequence == turn_limit → ⚡ **StoryCompleted** (`active→complete`) → ☁ Push both Participants + Spectators; ☁ PostHog `story_completed` → ▦ end screen (share)
- ▶ ProposeEnd → ⚡ **EndProposed** → ▶ AgreeEnd → ⚡ **StoryCompleted** (mutual early exit); or ⚡ **EndDeclined**
- ▶ AbandonStory, or TurnTimedOut with no viable continuation → ⚡ **StoryAbandoned** (`→abandoned`; visible in list with that status)

### 7. Safety
- ▶ ReportContent(section|player, reason) → ⚡ **ContentReported** → ▦ review queue (24h SLA)
- ▶ BlockPlayer → ⚡ **PlayerBlocked** → blocked player's content hidden bidirectionally
- ☰ On repeated Moderation rejects / upheld reports → ⚡ **PlayerBanned** (per Moderation Policy)

## External systems
- ☁ **Anthropic API** (`claude-haiku-4-5`) — three consumers via the AI Service Layer: **Moderation** (§3), **Director hints** (§3), **AI Fill-in** (§4).
- ☁ **Expo Push** — turn ready, reaction, invite, settings to confirm, story complete, fill-in warning, story stalled (pure-human).
- ☁ **PostHog** — `story_started`, `turn_submitted`, `story_completed`, `director_hint_viewed/dismissed` (+ report/block).
- ☁ **Stripe** — V2 (Pro tier), not in V1 events.

## Resolved decisions (designer review, 2026-07-03)
1. **Activation ordering** — invite first; the creator writes the opening Turn **after** the invitee accepts. Activation happens on acceptance — the game is on only then. (§2)
2. **Moderation-rejection UX** — on TurnRejected the author may **edit & resubmit freely, no penalty**. (§3; `design/branches/moderation-rejection.md`)
3. **`pure_human` + timeout** — StoryStalled **pauses**; the waiting player may **extend or abandon**, and a longer secondary timeout auto-abandons. (§4)
4. **Reject-and-retry** — V2 feature; V1 has no control, but `Turn` carries **regeneration lineage** so V2 needs no rework. (§4; `domain-model.md`)
5. **Guest spectator** — read-only view; **no reactions** until they sign up. (§5)
6. **Director-hint delay** — fires at a **configurable** fraction of the turn-timer span, **default ½**, only if unanswered; never at the start. Escalation ladder: play → hint (½) → fill-in warning (deadline − 1h) → AI fill-in (deadline). (§3, §4)
7. **Settings Handshake** (designer review, 2026-07-07) — story configuration is **fully deferred from StartStory** to a handshake between activation and the opening Turn: the creator **proposes** (defaults preloaded, one tap to keep), the invitee **confirms** or **requests changes** (never edits directly — no lockouts). Confirmation replaces the earlier "accepting the invite is agreeing to the pace" convention. `turn_limit` / `pace_preset` / `pure_human` lock at the opening Turn; Voice Parameters stay hidden-panel adjustable. New commands/events: ProposeSettings → SettingsProposed, ConfirmSettings → SettingsConfirmed, RequestSettingsChange → SettingsChangeRequested. (§2)

## Audit pass — completeness sweep

A deliberate second pass, per the agreed checklist:

- **Every command emits ≥1 event** — ✅ verified for SignUp, StartStory, SubmitTurn, InvitePlayer, RespondToInvite, AddReaction, ProposeEnd/AgreeEnd, ReportContent, BlockPlayer. (ViewStory is read-only — no domain event by design.)
- **Every event has a consumer** (policy / read-model / notification) or is terminal — ✅. Terminal-ish: PlayerBanned (terminal to account), StoryAbandoned (terminal to story), ReactionRemoved (updates read model only).
- **Every external system represented** — ✅ Anthropic (3 uses), Expo Push, PostHog; Stripe explicitly deferred.
- **Temporal sanity** (no event depends on a later one) — ✅; the only ordering risk is Hotspot 1 (activation), flagged.
- **Missing-event check** — added on this pass: **FillInWarningIssued** (was implicit in the pacing design), **StoryStalled** (the pure_human timeout path), **EndDeclined** (the negative of EndProposed), **ReactionRemoved** (un-like), **StoryExtended** (the pure_human extend path). 
- **Actors covered** — Player (as creator, participant, spectator, reporter), the System/Timer (TurnTimedOut, warnings), the AI (fill-in, moderation, hints). ✅ 