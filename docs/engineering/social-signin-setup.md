# Social Sign-In Provider Setup (Phase 5, Auth)

**What this is:** the end-to-end runbook for getting OAuth/OIDC social sign-in ("Continue with
Google / Apple") working — Google Cloud clients + credentials, app/server env config, the native
library, and the dev build required to run it. This is a **living document**: the status table and
the problem log below are updated as the work moves. Companion doc: the wiring reference in
[`oauth-google.md`](./oauth-google.md) (which client ID goes where).

> Why it needs a runbook: this touches four systems that each have their own gotchas — Google Cloud
> (multiple client *types*), Expo/EAS (project + keystore + dev build), the native Google SDK (no
> Expo Go), and our client↔server `aud` contract. Most failures are config mismatches across those
> boundaries, not code.

---

## The mental model (read this first)

1. **The app never sees a password.** It asks the provider for an **`id_token`** and POSTs it to our
   server (`/auth/oidc`), which verifies it and mints our own access + refresh tokens.
2. **The token's `aud` is the join.** Google issues the `id_token` with `aud = webClientId`. Our
   server verifies that `aud` against `GOOGLE_CLIENT_ID`. So **one value** must be identical in three
   places: the **Web** client ID → `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (app) **==** `GOOGLE_CLIENT_ID`
   (server).
3. **Android needs TWO Google clients.** An **Android** client (package + SHA-1) *authorizes the app*
   — its ID string is never used in code. A **Web** client is what you pass as `webClientId`. Using
   the Android client's ID as `webClientId` is a guaranteed `DEVELOPER_ERROR`.
4. **Native lib ⇒ dev build.** SDK 57 uses `@react-native-google-signin/google-signin` (the old
   `expo-auth-session` Google provider is deprecated). It does **not** run in Expo Go — the
   **Dev: Alice/Bob** buttons remain the Expo Go path.
5. **`EXPO_PUBLIC_*` are JS-inlined by Metro**, not baked into the native binary. Changing `app/.env`
   only needs a **Metro restart** (`npx expo start --dev-client`), not a new EAS build. The server
   reads `GOOGLE_CLIENT_ID` **at boot**, so changing root `.env` needs a **container recreate**.

---

## Identifiers (fill in as they're created)

| Thing | Value | Where it lives |
|---|---|---|
| iOS bundle identifier | `com.andrit.battleapp` | `app.json` → `ios.bundleIdentifier` |
| Android package | `com.andrit.battleapp` | `app.json` → `android.package` |
| Expo project | slug `battleapp`, projectId `2cf6f236-…`, owner `programmar1` | `app.json` → `extra.eas` |
| Google **Web** client ID | ⚠️ TODO — must be **Type: Web application** | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (app/.env) + `GOOGLE_CLIENT_ID` (root .env) |
| Google **Android** client | `764743394823-iclme50…` (Type: Android) + package + EAS keystore SHA-1 | Google Cloud only — **not in code** |
| Google **iOS** client ID | `764743394823-2i9u2i…` (Type: iOS) | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (app/.env) + reversed as `app.json` `iosUrlScheme` |
| Apple Services ID | TODO (deferred) | `APPLE_CLIENT_ID` (root .env) |
| `AUTH_JWT_SECRET` | dev value set (root .env); **replace in prod** | root .env / prod host env |

---

## Runbook / checklist

Legend: [x] done · [~] in progress · [ ] not started

### A. Google Cloud — OAuth clients (all in ONE project)
- [x] **Android** client — Application type Android, Package `com.andrit.battleapp`, SHA-1 = the EAS
      dev keystore's `SHA1 Fingerprint` (from `npx eas-cli credentials -p android`). Confirmed match.
- [x] **iOS** client — Application type iOS, Bundle ID `com.andrit.battleapp` (App Store ID / Team ID
      optional, left blank pre-launch).
- [ ] **Web** client — Application type **Web application**. ⚠️ **This is the current blocker** — the
      value we've been using as the Web ID (`iclme50…`) is actually the *Android* client. Create a
      real Web client and use its ID.
- [ ] **OAuth consent screen** — app name, support email, scopes (`openid`, `email`, `profile`).
      While in "Testing", add yourself as a **test user**. (Basic profile/email are non-sensitive, so
      no Google verification is required to publish.)

### B. Env config
- [x] Root `.env` (gitignored) + `.env.example`; compose passes `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID`
      / `AUTH_JWT_SECRET` via `${VAR:-}`.
- [x] `app/.env` (gitignored) + `.env.example` with `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` /
      `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
- [ ] Put the real **Web** client ID in **both** `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and
      `GOOGLE_CLIENT_ID` (they must match).
- [x] `app.json` `iosUrlScheme` = reversed iOS client ID.

### C. App code
- [x] Installed `@react-native-google-signin/google-signin` (16.1.2) + config plugin in `app.json`.
- [x] `app/src/lib/oauth.ts` — env-gated Google flow (`configure({ webClientId, iosClientId })` →
      `signIn()` → `data.idToken`), `OAuthCancelledError`, Apple still stubbed.
- [x] Diagnostics: server `/auth/oidc` logs the real verify error; WelcomeScreen surfaces the actual
      error string on-screen in `__DEV__`.

### D. EAS / dev build
- [x] Expo project fixed to `battleapp` (after an initial wrong `rhizo-labs` slug).
- [x] EAS Android keystore created (`eas credentials`).
- [x] `eas.json` `development` profile: `developmentClient`, internal, `ios.simulator: true`.
- [x] Android dev build (`npx eas-cli build --profile development --platform android`) installed on a
      physical phone.
- [ ] iOS Simulator build (`… --platform ios` → `eas build:run -p ios`) — backfilled, not yet built.

### E. Verify on-device
- [x] Backend reachable — `EXPO_PUBLIC_API_URL` = LAN IP (`192.168.1.228:4000`), phone on same Wi-Fi.
- [ ] **"Continue with Google" completes a real sign-in** ← the goal, currently blocked by the missing
      Web client (see A).

---

## Where we are right now (2026-07-26)

Google sign-in is fully wired in code and the Android dev build is on the phone, but tapping
**Continue with Google** returns **`DEVELOPER_ERROR`** and nothing reaches the server.

**Root cause identified:** the `webClientId` we're passing is an **Android-type** client ID, but
`webClientId` must be a **Web application** client. That's an invalid config → `DEVELOPER_ERROR`
before any token is issued (hence the empty server log).

## What's next to finish (immediate)

1. Create a **Web application** OAuth client in Google Cloud (Section A).
2. Put its ID in **both** `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (app/.env) and `GOOGLE_CLIENT_ID`
   (root .env).
3. Restart Metro (`npx expo start --dev-client`) and recreate the server
   (`docker compose up -d --force-recreate game-server`; confirm with
   `docker compose exec game-server printenv GOOGLE_CLIENT_ID`).
4. Configure the OAuth consent screen + add yourself as a test user.
5. Retry — expect a real sign-in. If a new error appears, the on-screen `__DEV__` message + the
   server `oidc … verification failed` log now name the cause.
6. (Optional) build the iOS Simulator dev client to verify the Apple-less path on iOS.

## Go-live / production steps (later)

Not needed for dev, required before/at launch:

- **Google Play App Signing SHA-1** — when you ship to Google Play, Play **re-signs** the app with a
  different key. Add **that** SHA-1 (Play Console → *App integrity*) as a **second** Android OAuth
  client (same package). Without it, Google sign-in breaks for Play-installed users.
- **OAuth consent screen → In production** — move it out of "Testing" so any user (not just added test
  users) can sign in.
- **Apple Sign In** — create an Apple **Services ID** + sign-in key, set `APPLE_CLIENT_ID`, wire
  `expo-apple-authentication`, and un-stub `getProviderIdToken('apple')`. Note App Store Guideline
  **4.8**: offering any third-party social login (Google) generally **requires** offering Sign in with
  Apple too — so this is a launch blocker for iOS, not optional.
- **iOS device / TestFlight build** — split a `development-device` (and `production`) profile; needs a
  paid Apple Developer account and registered devices / TestFlight.
- **Production secrets & URLs** — set a real `AUTH_JWT_SECRET` (`openssl rand -hex 32`) in the prod
  host env (never the dev default); point `EXPO_PUBLIC_API_URL` at the prod server; set
  `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` in the prod environment.
- **Identifiers lock at store upload** — the bundle ID / package become permanent once a build is
  uploaded to App Store Connect / Play. (The app's *display name* stays freely changeable.)

---

## Problem log (living history)

Chronological record of what bit us and how it was resolved — so the next provider (Apple) and the
next person don't re-learn it.

| # | Symptom | Cause | Resolution |
|---|---|---|---|
| 1 | Expo project created under slug `rhizo-labs` | Typo during `eas init` | Made a new `battleapp` project; re-ran `eas init --id`. **Don't** delete `eas.json` (holds build profiles). |
| 2 | `zsh: command not found: eas` | No global `eas-cli` on host | Use `npx eas-cli …` (or `npm i -g eas-cli`). |
| 3 | iOS OAuth form wants a "Package Name from AndroidManifest.xml"; no such file in repo | Expo Continuous Native Generation — no committed native project | Bundle ID / package come from `app.json` (`com.andrit.battleapp`). |
| 4 | Android OAuth client needs a SHA-1 we didn't have | No keystore yet | Generated the EAS Android keystore via `eas credentials`; used its `SHA1 Fingerprint`. |
| 5 | `AUTH_JWT_SECRET` / client IDs shouldn't be committed | Secret + per-env config | Root `.env` (gitignored) + `.env.example`; compose interpolates `${VAR:-}`. |
| 6 | Which library for Google? | SDK 57 **deprecated** `expo-auth-session`'s Google provider | Switched to native `@react-native-google-signin/google-signin` → **requires a dev build** (not Expo Go). |
| 7 | On-device "Couldn't sign in — please try again" with no detail | Both client and server swallowed the real error | Server `/auth/oidc` now `req.log.warn`s the verify failure; WelcomeScreen shows the raw error in `__DEV__`. |
| 8 | (revealed by #7) `DEVELOPER_ERROR`, nothing reaches server | Native Google config rejected the app before issuing a token | Investigated SHA-1 (matched) → found the real cause: ↓ |
| 9 | **`DEVELOPER_ERROR` persists though SHA-1 matches** | `webClientId` was set to an **Android-type** client ID; it must be a **Web application** client | **(in progress)** Create a Web client; use its ID for `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` + `GOOGLE_CLIENT_ID`. |

### Debugging cheat-sheet (what the failure mode tells you)
- **"Social sign-in is coming soon"** → env not set (Expo Go, or `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
  missing / Metro not restarted).
- **`DEVELOPER_ERROR`, empty server log** → Android Google config: `webClientId` not a Web client,
  SHA-1/package mismatch, or wrong project. Never reaches our server.
- **Reaches server, 401 `invalid_id_token`** → check the server log: `aud` mismatch
  (`GOOGLE_CLIENT_ID` ≠ Web client / server not restarted), expired token, or JWKS unreachable.
- **Nothing happens / network error** → phone can't reach `EXPO_PUBLIC_API_URL`; load
  `http://<LAN-IP>:4000/health` in the phone browser.
