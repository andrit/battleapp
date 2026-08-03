# 001 — Phase 5: on-device verification of real OAuth + First-story flow

**Opened:** 2026-08-02 · **Phase:** 5 (Auth & Secure Storage) · **Status:** IN PROGRESS — Google
sign-in verified on device 2026-08-03; the secure-storage / session criteria below remain.

## Why this needs a human + a device

The Phase-5 auth path is code-complete and green in CI (app 19 suites / 80 tests; server auth suite
covers OIDC verify, refresh rotation, 401s, auth-attributed story/turn), but three things can only be
exercised on a real build:

- **Google sign-in is native** (`@react-native-google-signin/google-signin`) → it does **not** run in
  Expo Go, jest, or this Linux container. The flow is env-gated on `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
  so it's inert everywhere until a dev build + client ids exist.
- **SecureStore/Keychain** token persistence is mocked in jest; the "refresh token is in the Keychain,
  NOT AsyncStorage" advance-criterion needs a device to confirm for real.
- The **First-story onboarding flow** (new account → HandlePick → First-story prompt → app) has only
  been verified via unit/routing tests; the end-to-end feel needs a real run.

## Prerequisites — ✅ satisfied 2026-08-03

1. ✅ Google OAuth clients created (Android + iOS + a real **Web application** client `…1641883…`).
2. ✅ Web id wired into `GOOGLE_CLIENT_ID` (root `.env`), `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (`app/.env`),
   and `eas.json` `development.env`; iOS URL scheme set in `app.json`.
3. ✅ Android EAS dev build installed on a device. (iOS Simulator build still optional.)

See `docs/engineering/social-signin-setup.md` (runbook + problem log) for the full story.

## What to verify on device (Phase 5 advance criteria)

- [x] **Google sign-in completes** — provider `id_token` → our access + refresh tokens → into the app.
      *Verified 2026-08-03: signed in on device and ran a turn.*
- [ ] **New-account onboarding** — a **brand-new** account → **HandlePick** (pick a unique @handle) →
      **First-story prompt** ("You're in!") appears **once**; "Start a story" → a freshly created story
      (Compose-ready); "Browse" → the Stories list. *(Needs a fresh Google account to observe — the
      tester's account already existed, so this path wasn't exercised yet.)*
- [x] Refresh token is stored in **SecureStore/Keychain**, confirmed **NOT** in AsyncStorage.
      *Verified on device 2026-08-03 (Profile dev audit: AsyncStorage keys = `battleapp.prefs` +
      `battleapp.cache.stories` only; token round-trips SecureStore; no AsyncStorage entry holds it).*
- [ ] Token refresh happens **without** the user seeing a sign-in screen (silent refresh).
- [ ] **Cold start** with a valid session goes **straight to the app** — no Welcome, and the
      First-story prompt does **not** re-appear (it's one-time).
- [ ] **Sign out** clears all stored tokens and returns to Welcome.
- [ ] Two devices (Dev: Alice / Dev: Bob, or two real Google accounts) → join + turn alternation.

## Notes

- **Apple sign-in is intentionally deferred** (needs a Services ID + Sign-in key); Google is the path
  for this verification. On iOS, shipping Google will eventually require Sign in with Apple too
  (App Store Guideline 4.8) — tracked for later, not this check.
- Once verified, close by moving the README entry to `## Done` and log the Phase-5 advance.
