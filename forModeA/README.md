# forModeA — outbox to the workbench

This directory is **battleapp's outbox to the AI Dev Workbench (Mode A)**. Mode B (the in-repo
Claude Code session) can't write upstream directly, so anything that needs the workbench operator or
the human designer — scaffold gaps, feature requests, and hand-offs that can't be completed inside
the container — is dropped here as a numbered note (`NNN-slug.md`) and listed under **Open items**.

Close an item by moving it to `## Done` with the date it was resolved.

## Open items

- [001](001-phase5-ondevice-oauth-verification.md) — **Phase 5:** on-device verification of the real
  OAuth sign-in + First-story onboarding flow. **In progress** — Google sign-in verified on device
  **all four advance criteria verified on device 2026-08-03/04** (Keychain-not-AsyncStorage, cold-start,
  sign-out, silent refresh). Extra coverage remaining: new-account onboarding, two-device alternation.
  *Opened 2026-08-02.*
- [002](002-phase6-ondevice-offline-verification.md) — **Phase 6:** on-device verification of the
  offline & sync flows (banner + cached reads, offline write queue + restart-survival, stale rejection,
  offline cold-start, reconnect catch-up). Code + both suites green; `phase_readiness` green. **JS-only,
  Metro-reloadable — no EAS rebuild.** Confidence gate before advancing to Phase 7. *Opened 2026-08-04.*

## Done

_(none yet)_
