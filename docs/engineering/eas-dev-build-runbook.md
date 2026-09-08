# EAS dev build — runbook

**Why this exists:** on-device verification gates every phase advance (Phase 5 via
[`forModeA/001`](../../forModeA/001-phase5-ondevice-oauth-verification.md), Phase 6 via
[`002`](../../forModeA/002-phase6-ondevice-offline-verification.md)). Most changes are JS and just
Metro-reload onto an existing dev build — **a rebuild is only needed when a native module is added
or upgraded**. This is the checklist for that case, written down because it has now blocked a phase
twice.

Everything here runs **on the host** (the container has no simulator, no Apple/Google keychain, and
no Expo login). Claude cannot run any of it.

## When a rebuild is actually required

Rebuild only if one of these is true:

- a **native module** was added or upgraded in `app/package.json` since the installed build
  (`@react-native-community/netinfo`, `expo-secure-store`, `@react-native-google-signin/…`, …);
- `app/app.json` changed `plugins`, `scheme`, `bundleIdentifier`/`package`, or an icon/splash asset;
- `eas.json` changed the profile's `env` (those are **baked in at build time**, not read at runtime).

Pure JS/TS changes — screens, hooks, stores, React Query wiring — **never** need one. Run
`cd app && npx expo start --dev-client` and reload.

**How to tell the installed build is stale:** the app logs `RNCNetInfo` as `null`, or a feature
reports "coming soon" / throws a native-module error. `network.ts` deliberately degrades to
"assume online" in that case (commit `f1493c9`), so a stale build looks *healthy* while silently
skipping the offline paths — it will not fail loudly for you.

## Checklist

### A. Prerequisites (one-time, already done for this project)

- [x] `app/eas.json` has a `development` profile: `developmentClient: true`, `distribution: internal`,
      `channel: development`, `ios.simulator: true`.
- [x] `app/app.json` has `extra.eas.projectId` = `2cf6f236-8f0c-4289-b05b-584e6323ccb5`
      (set by `eas init` — do not hand-edit).
- [x] `expo-dev-client` in `app/package.json`.
- [x] Google client IDs in the `development` profile's `env` (see
      [`social-signin-setup.md`](social-signin-setup.md) — those are public values, safe in the repo).
- [ ] Logged in: `cd app && npx eas-cli login` (the designer's Expo account). Check with
      `npx eas-cli whoami`.

### B. Build

- [ ] `cd app && npx eas-cli build --profile development --platform android`
- [ ] Watch the queue: the CLI prints a build URL; `npx eas-cli build:list --limit 3` shows status
      later. **EAS has had partial outages** — a build that never finishes is the failure that
      stalled Phase 6, so confirm `finished`, not just "submitted".
- [ ] iOS instead: `--platform ios` builds for the **Simulator** with the current profile
      (`ios.simulator: true`), installable via `npx eas-cli build:run -p ios`. A **physical iPhone**
      needs a paid Apple Developer account — not available, so **Android is the device target**.

### C. Install

- [ ] Android phone: open the build URL (or the QR the CLI prints) on the phone and install the APK.
      Allow "install unknown apps" for the browser if prompted.
- [ ] Confirm the **new** build replaced the old one — check the build's date in the EAS build
      details, not just that an app icon exists.

### D. Point it at the server

- [ ] Server up on the host: `docker compose up --build game-server` at the workspace root;
      `curl http://localhost:4000/health` to confirm.
- [ ] `app/.env` → `EXPO_PUBLIC_API_URL` = the **dev machine's LAN IP**, not `localhost`
      (last known: `http://192.168.1.228:4000`). Phone and Mac on the same Wi-Fi.
- [ ] `cd app && npx expo start --dev-client`, then open the app and let it connect to Metro.

### E. Sanity-check before starting a verification checklist

- [ ] Signed in (Google) and the stories list loads — proves API + auth reach the server.
- [ ] **Native module present:** toggle airplane mode and confirm the **offline banner appears**.
      If it does not, the build predates `netinfo` — go back to B. This one check is what
      distinguishes "the feature is broken" from "you are on the wrong build".

## Gotchas

- `eas.json` `env` values are **build-time**. Changing a client ID means a **new build**, not a
  Metro reload.
- `appVersionSource: remote` + `runtimeVersion.policy: appVersion` — an OTA update only reaches
  builds whose `version` matches `app.json`'s. Bumping `version` orphans existing dev builds.
- Verifying a frontend fix needs the app **fully relaunched**, not backgrounded.
- A dev build is **not** Expo Go: Expo Go cannot load any of the native modules above and will show
  the "coming soon" paths.
