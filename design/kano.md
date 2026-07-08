# BattleApp — Kano Classification

**Phase 0 deliverable · written 2026-07-07**

Every V1 feature classified Must-be / Performance / Delighter / Indifferent / Reverse, with
mobile-specific notes, per the kano-model skill (`documents/factory/skill-kano-model.md`).
Deliberately written **last** in Phase 0 (task plan decision) so it classifies the complete
feature set the other docs established — the inverse of the skill's default ordering, on
purpose. Classifications are founder hypotheses (answered as the skeptical target user);
re-run against real users at V1 launch. This is the **scope contract**: if it isn't here, it
isn't built in V1.

## Must-be — table stakes; absence kills the product

- [ ] Account + email/password auth (token in secure-store)
- [ ] Start a story → invite (username or share link) → accept → **Settings Handshake with
      one-tap defaults** — the frictionless start is must-be, the *dials themselves* are below
- [ ] Compose & submit Turns (1–5 sentences, ≤ 500 chars), alternation, append-only story scroll
- [ ] Turn-limit completion + end screen
- [ ] Push "your turn" + deep link to the right screen — the async loop depends on it
      *(mobile: permission asked after the first Turn, never on launch; **B3** in-app badges
      keep the loop alive when push is denied — that fallback is what keeps this must-be
      satisfiable on every device)*
- [ ] **Never lose a draft** — autosave to AsyncStorage on keystroke, offline queue (B1),
      submit-failure rollback (B5) *(mobile: this is the number-one trust breaker if absent)*
- [ ] Moderation on every Turn + Report + Block — **App Store UGC Guideline 1.2 is
      non-negotiable**; also gates the whole content experience
- [ ] Offline read: story list + viewed stories from cache, never a blank screen (B2)

## Performance — quality here scales satisfaction; the investment tier

- [ ] Notification timeliness & reliability (turn ready < 30s; badge accuracy)
- [ ] Turn-submit latency incl. moderation (**p95 < 2s** — it blocks the submit path)
- [ ] Story scroll performance (FlashList; long stories stay smooth)
- [ ] Pace & escalation-ladder correctness (timer → hint → warning → fill-in/stall, exactly
      per `game-mechanics.md` §4 — a mistimed fill-in is a betrayal, not a bug)
- [ ] Story list ordering (your-turn first; status-visible rows)
- [ ] Reactions per Section — the social fuel that makes writers feel seen; visibility and
      batched notifications (≤ 5 min) scale satisfaction

## Delighters — unexpected; "it does that too?"

- [ ] **AI Fill-in** — attributed safety-net Turn that keeps a stalled story alive
- [ ] **AI Director stall hints** — one dismissible nudge, only when stuck
- [ ] **Voice Parameters** (TARS dials) — tune the AI's voice per story
- [ ] **Pure-Human Mode** — the opt-out *is* a feature; trust signal
- [ ] **"AI compute used" transparency** — responsible-AI as a stated value (`product-story.md`)
- [ ] Guest spectating via share link — universal links with rich previews; read-only web view
- [ ] Mutual early exit — end a story gracefully together

## Indifferent — don't invest; minimal or deferred

- [ ] Story titles → keep as a nullable free-text field (near-zero cost); **auto-title is V2**
- [ ] Avatars → preset choices only in V1; no photo upload (also keeps Expo managed workflow —
      `device-apis.md`)
- [ ] Profile stats (stories played/completed) → fields exist in the domain model; **no V1
      surface** beyond a simple count on Profile

## Reverse — dissatisfies some users; ship only with the mitigation

| Reverse risk | Shipped mitigation |
|---|---|
| AI writing story content uninvited | Fill-in is **attributed**, reactive-only, and **Pure-Human Mode** disables it entirely (reject-and-retry V2; lineage reserved) |
| Hint nagging | Stall-gated (½ span), **one** per turn, dismissible, never blocks (`ai-director-spec.md`) |
| Push volume | Reactions batched ≤ 5 min; every push deep-links; badges when denied |
| Config friction at story start | Settings Handshake defaults — **one tap to start writing** |

## Cut from V1 (the boundary; mostly designed-for, not built)

**The V2 boundary is also the launch gate** (designer decision, 2026-07-08): the end of the V1
SDLC is a **beta launch** for beta testers only; **public launch requires the V2 items** that
enable multiple paid accounts (Stripe) and multi-instance scale (Valkey). See
`docs/product-development/sdlc.md` — Release model.

- [ ] AI Partner play mode → V2 (fourth AI consumer)
- [ ] Structured & Roguelike modes, Story Elements, custom-value moderation → V2 (`mode`/`elements` reserved)
- [ ] Reject-and-retry UI → V2 (`Turn.supersedes` lineage already in the schema)
- [ ] Real-time co-writing → V2
- [ ] Story export (md) → V2 share artifact
- [ ] Magic-link auth → V2
- [ ] Monetization (Stripe / Pro tier, paid user profiles) → V2 — V1 beta is free; no paywall can sit inside the core loop; **public launch depends on this**
- [ ] Valkey pub/sub (multi-instance WebSocket fan-out) → V2 — V1 runs a single game-server instance; the notify-layer seam exists (`tech-stack.md`)
- [ ] Auto-title → V2

## Contradiction check (per the skill)

- **Must-be gated behind a paywall?** No — V1 has no paywall.
- **Delighter before must-bes are solid?** No — the SDLC builds must-bes at Phases 1–6; the
  Director lands Phase 7 on an already-working loop (`docs/product-development/sdlc.md`).
- **Must-be with a missing dependency?** Moderation (must-be, Phase 3) needs the AI Service
  Layer — resolved by nesting the layer's build at **Phase 3**, not Phase 7 (the SDLC
  re-sequence).
- **Indifferent features in the build plan?** Titles/avatars/stats reduced to their minimal
  forms above; nothing gets dedicated build time.
