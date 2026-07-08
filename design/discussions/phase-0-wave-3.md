# Discussion — Phase 0 Wave 3 (consolidated content)

**Type:** consolidated review copy of all Wave 3 output
**Opened:** 2026-07-04
**Status:** OPEN — tasks 6 & 11 written; tasks 7 & 8 awaiting designer decisions
**Canonical files (source of truth):** `design/game-mechanics.md`, `design/device-apis.md`,
and (pending) `design/task-flow.md`, `design/user-flow.md` + a `.mmd` nav diagram. This file is a
**consolidated copy for review** — edits should land in the canonical files, not here.

Wave 3 per `task-plan-phase-0.md`: **6 game-mechanics → 7 task-flow + 8 user-flow (parallel) +
11 device-apis.** Tasks 6 and 11 had no open questions and are done; 7 and 8 have flagged
unknowns and need your confirm/redirect (bottom of this file).

---

# Task 6 — game-mechanics.md  *(written, ingested)*

The canonical rules of play. Vocabulary is from `glossary.md`; the events these rules produce
are in `event-storm.md`; the aggregates and invariants that enforce them are in `domain-model.md`.
Feeds `task-flow.md`, `user-flow.md`, and `kano.md`. V1 scope; V2 items are marked.

## 0. V1 framing — BattleApp is an AI app in V1
V1 is not "the game now, AI later." Three AI mechanics ship in V1, all via the one **AI Service
Layer** (`claude-haiku-4-5`): **Moderation** (screens every Turn), the **AI Director** (optional
stall-nudge hints), and **AI Fill-in** (attributed safety-net on a timeout). Deferred to V2 is the
**AI Partner** *play mode*. The AI is a restrained helper, never the author.

## 1. The Turn — granularity
- **1–5 sentences, ≤ 500 characters.** Bite-sized; keeps each AI call cheap.
- **Immutable once submitted**; Turns are **append-only and sequential** (`sequence_number`
  contiguous and unique within the Story).
- Carries **author** and **author type** (`human`/`ai`). AI Turns are visibly **attributed**.
- A submitted Turn becomes a **Section** (one Turn = one Section).

## 2. Turn order & the opening
- Two Participants in V1, who **alternate**.
- Start order: invite → invitee **accepts** → **activation** (`lobby → active`) → **creator writes
  the opening Turn** → timer passes to the invitee. The creator writes nothing until activation.
- After the opening, on each `TurnAdded` the turn passes to the other Participant (push notified).

## 3. Pace & the turn timer
- **Pace Preset** is **per-Story**: **Fast (24h)** or **Easy (72h)** per Turn. Set at creation or
  defaulted; **accepting the invite is agreeing to the pace.**
- Timer starts on `TurnPassed` and governs the escalation ladder.

## 4. The escalation ladder (one stalled turn)
Measured against that Participant's Pace Preset span:
1. **Play** — turn opens: no hint, no nudge.
2. **Director hint** — at a **configurable fraction of the span (default ½)**, *only if no Turn
   submitted*, the AI Director offers **one** optional, dismissible hint. Submit in time → no hint,
   no director call. Director reads a **bounded view** (premise + rolling summary + last 2 turns),
   never writes content, never blocks a Turn.
3. **Fill-in warning** — at **deadline − 1h**, a push warns the opponent that fill-in is near.
4. **Deadline** — `TurnTimedOut`, branching on `pure_human`:
   - **off (default):** **AI Fill-in** writes an **attributed** Turn (using Voice Parameters).
   - **on:** no AI writes; the Story **stalls** (`stalled_at` set; still `active`). See §5.

## 5. Pure-Human Mode
- Per-Story boolean, **default off**. When on, **AI Fill-in is disabled**.
- On a pure-human timeout: `StoryStalled` → **pause**. The waiting Participant may **ExtendStory**
  (clears `stalled_at`) or **AbandonStory** (`abandoned`); a **longer secondary timeout**
  auto-abandons if neither.

## 6. Turn limits & end conditions
- **Turn Limit** chosen at creation; Section at `sequence_number == turn_limit` → **complete**.
- **Mutual early exit:** ProposeEnd + AgreeEnd → complete; EndDeclined leaves play unchanged.
- **No AI dependency to end.**
- **Abandonment:** AbandonStory, or a timeout with no viable continuation → `abandoned`.

## 7. Moderation — every Turn, before it exists
- Every submitted Turn is screened **before storage**; only passed content becomes a Turn,
  rejected never persists.
- On reject: reason shown; **edit & resubmit freely, no penalty**.
- Also screens custom Story Element values (V2). Rules live in the **Moderation Policy**
  (`docs/compliance/moderation-policy.md`), which doubles as the App Store UGC policy.

## 8. Spectating & reactions
- View by Participant, signed-in **Spectator**, or **guest** via share link (read-only).
- **Reactions require an account** (one like per user per Section, a toggle). Guests must sign up.
- Reactions notify the Section's author (batched ≤ 5 min).

## 9. Voice Parameters (pointer)
- Per-Story open dial-map (Humor, Dread, Fear, Fantasy…, 0–100) shaping **AI-authored content
  only** (Fill-in V1, Partner V2). Not Director, not Moderation. Full def in `glossary.md`;
  contracts in `ai-service-layer.md`.

## 10. Fixed for V1 vs deferred

| Mechanic | V1 | V2 |
|----------|----|----|
| Mode | **Freeform** only | Structured, Roguelike |
| Players | two humans, async | AI Partner play mode; real-time co-writing |
| Turn | 1–5 sentences, ≤ 500 chars, append-only | — |
| Pace | Fast 24h / Easy 72h | — |
| Director | timer-gated stall hint (default ½) | — |
| Fill-in | attributed, `pure_human` opt-out | reject-and-retry control (lineage reserved now) |
| End | fixed turn limit + mutual early exit | — |
| Reactions | per-Section like, account required | — |
| Moderation | every Turn + custom values | — |

---

# Task 11 — device-apis.md  *(written, ingested)*

Every native device capability V1 requires, with library, permission strings, workflow
implication. Discharges the "every required native device API listed" and "Expo workflow
decision documented" advance criteria.

## Summary — the workflow decision
**V1 needs exactly one native capability: push notifications.** `expo-notifications` is supported
in the **Expo managed workflow** → **no bare-workflow ejection.** Managed workflow **confirmed**.

## Required device APIs (V1)
### 1. Push notifications — **required**
- **Purpose:** the async loop depends on it — "your turn," fill-in warning, invite, reaction
  (batched), story complete.
- **Library:** `expo-notifications` (+ `expo-device`; Expo push tokens via
  `getExpoPushTokenAsync`); server-side **Expo Push**.
- **Permission:** requested **after the first Turn** (not on launch). Deep-link routing on tap.
- **iOS:** remote-notification entitlement via EAS; OS permission string (no custom Info.plist
  usage string needed for notifications); APNs via EAS credentials.
- **Android:** `POST_NOTIFICATIONS` runtime permission (13+); notification channel at first
  registration; FCM via EAS credentials.
- **Workflow implication:** none — managed-workflow supported.

## Secure storage (noted for completeness)
- **Auth token** in **`expo-secure-store`** (Keychain/Keystore), never `AsyncStorage`.
- **`AsyncStorage`** holds non-secret cache (story list, draft autosave).

## Explicitly NOT required in V1 (so managed workflow holds)

| Capability | Needed? | Note |
|------------|---------|------|
| Camera / photo library | **No** | Avatars not photo-upload in V1; `expo-image-picker` is managed-safe if added. |
| Location | **No** | No geo feature. |
| Bluetooth / BLE | **No** | — |
| NFC | **No** | — |
| Contacts | **No** | Invites by username / share link. |
| Microphone / audio | **No** | Text-only. |
| Biometrics | **No** | Email/password auth; token in secure-store. |

**None forces bare workflow.** The single required API (push) is managed-safe.

---

# Task 7 — task-flow.md  *(PROPOSED — awaiting confirm/redirect)*

Steps are clear; the **branches** aren't specified in the source docs. Proposed defaults:

- **Offline — take a turn:** draft autosaves to `AsyncStorage` on keystroke; submit **queues** and
  sends on reconnect with a "Draft saved / will send" indicator; no duplicate turns.
- **Offline — browse:** story list + already-viewed stories render read-only from cache; never a
  blank screen.
- **Permission-denied — push:** if declined, the game **still works** (in-app badges only); soft
  "notifications are off" nudge with a deep link to OS settings. **No feature gated on push.**
- **Failure — moderation reject:** inline reason + free edit-and-resubmit, no penalty.
- **Failure — submit error (5xx/timeout):** optimistic Section rolls back, Turn returns to the
  draft box, retry affordance.

Core tasks to be flowed: **start story · take a turn · spectate + react · respond to invite**,
each with the branches above where they apply.

---

# Task 8 — user-flow.md  *(PROPOSED — awaiting confirm/redirect; Mermaid ships as a `.mmd` file)*

Decisions needed:
1. **Deep-link scheme** — proposed `battleapp://story/:id`, `battleapp://story/:id/spectate`, plus
   HTTPS **universal links** for share-outs. Confirm the scheme name and universal-link-first for
   shares (better iMessage/web previews).
2. **Navigation shell** — proposed **bottom tabs**: **Stories** (active + your turn),
   **Discover/Spectate** (public feed), **Profile**. Story view + compose pushed/modal on top.
   Confirm or change the top-level tabs.
3. **Notification entry points** — every push deep-links to the exact screen (your-turn → compose;
   reaction → the Section; invite → invite-accept; complete → end screen). Confirm.

---

## Decision needed
Confirm the task-7 branches and the three task-8 decisions above (or redirect), and I'll write both
canonical docs + the `.mmd` nav diagram — closing Wave 3. Wave 4 is ai-director-spec →
ai-service-layer.

_— awaiting designer response —_
---

---
## Claude reply — 2026-07-07

**Wave 3 closed.** Designer confirmed all task-7 branches and all three task-8 decisions as
proposed (in chat, this date). Canonical docs written:

- `design/task-flow.md` — four core tasks (start story · take a turn · spectate + react ·
  respond to invite) with the five confirmed shared branches (B1 offline-compose queue,
  B2 offline-browse cache, B3 push-denied badges, B4 moderation reject, B5 submit rollback).
- `design/user-flow.md` — 18-screen inventory, bottom-tab shell (Stories / Discover / Profile),
  auth gates, deep-link resolution (`battleapp://story/:id` + `/spectate`, universal-link-first
  shares), and the five push entry points.
- `design/user-flow-nav.mmd` — navigation map (Mermaid source; render with mmdc).

Two small items surfaced while writing, both flagged in `user-flow.md` (not silently decided):
universal-link **domain TBD** (placeholder `battleapp.app`, needed before EAS config), and
⚡ StoryStalled has **no push** in the event storm — pure-human stalls surface via in-app badge
only; say the word if a stall push should be added.

Next: **Wave 4** — `ai-director-spec.md` → `ai-service-layer.md`.

_— end Claude reply —_
---
