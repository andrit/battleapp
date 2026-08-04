# 002 — Phase 6: on-device verification of the offline & sync flows

**Opened:** 2026-08-04 · **Phase:** 6 (Offline & Sync) · **Status:** OPEN — needs device (the code +
both test suites are green in-container; `phase_readiness` = ready. These flows can only be *felt* on a
real build).

## Why device (and the easy part)

Phase 6 is code-complete and green (app 22 suites / 90 tests; server 70 pass / 13 skip; both typecheck
clean). Connectivity, cache persistence, the offline write queue, and reconnect are exercised by unit
tests, but the end-to-end *feel* — airplane-mode → queued → reconnect → posts — needs a device.

**No EAS rebuild needed:** every Phase-6 change is **JS** and Metro-reloads onto the existing dev build
(the native `netinfo` module already landed with Phase-6 Task 1's build). Just
`cd app && npx expo start --dev-client`, reload, and exercise the flows.

## What to verify on device (maps to the four advance criteria)

- [ ] **Content offline + indicator** *(criteria 1 + 2)* — open a story online, then enable airplane
      mode: the **offline banner** shows, and the **stories list + that story still render** from cache
      (not a blank screen / crash).
- [ ] **Optimistic write, queued offline** *(criteria 3 + 4)* — in airplane mode, write a turn → it
      shows immediately with a **"Queued — will post when back online"** ack and the modal closes →
      disable airplane → the turn **posts on its own** (no manual refresh). Server logs show the
      `POST /stories/:id/turns` fire on reconnect.
- [ ] **Queue survives a restart** *(criterion 4)* — write a turn offline, then **force-quit the app
      while it's queued** → reopen (still offline is fine) → when the network returns it **still posts**
      (the mutation was persisted + resumed).
- [ ] **Stale rejection** — a turn whose slot moved on (2-device: it became the other author's turn, or
      the AI stepped in) → on send it shows **"This story moved on — your turn was skipped"** and the
      draft is dropped (not silently double-posted).
- [ ] **Offline cold-start (the Phase-5 carry-over fix)** — signed in → airplane mode → **force-quit +
      relaunch** → lands **in the app (not Welcome)**, still signed in, showing cached content; disable
      airplane → writes work again (silent token warm).
- [ ] **Reconnect catch-up** — mid-story, drop the network then restore it → **turns published while you
      were offline appear** (refetch) and **live updates resume** (WebSocket reconnects).

## Notes

- These are all Metro-reloadable (JS only). If "coming soon"/native errors appear, you're on a build
  predating Phase-6 Task 1's `netinfo` — rebuild once (`eas build --profile development`).
- `phase_readiness` is already green; this checklist is the on-device confidence gate before advancing
  to **Phase 7 (Push Notifications)** — same pattern as [001](001-phase5-ondevice-oauth-verification.md).
- Once all boxes are ticked, advance the phase and log it.
