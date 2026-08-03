# forModeA — outbox to the workbench

This directory is **battleapp's outbox to the AI Dev Workbench (Mode A)**. Mode B (the in-repo
Claude Code session) can't write upstream directly, so anything that needs the workbench operator or
the human designer — scaffold gaps, feature requests, and hand-offs that can't be completed inside
the container — is dropped here as a numbered note (`NNN-slug.md`) and listed under **Open items**.

Close an item by moving it to `## Done` with the date it was resolved.

## Open items

- [001](001-phase5-ondevice-oauth-verification.md) — **Phase 5:** on-device verification of the real
  OAuth sign-in + First-story onboarding flow. **In progress** — Google sign-in verified on device
  2026-08-03; Keychain-not-AsyncStorage verified 2026-08-03; session criteria (silent refresh,
  cold-start, sign-out) + new-account onboarding remain. *Opened 2026-08-02.*

## Done

_(none yet)_
