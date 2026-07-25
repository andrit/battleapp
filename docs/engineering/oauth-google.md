# Google Sign-In (OAuth/OIDC) wiring

How "Continue with Google" turns into an authenticated player. The app never sees a password: it
asks Google for an **`id_token`** and hands it to our server, which verifies it and mints our own
access + refresh tokens.

## Flow

```
Welcome "Continue with Google"
  → authStore.signInWithProvider('google')
  → lib/oauth.getProviderIdToken('google')           # native Google Sign-In → id_token
  → authApi.oidc('google', idToken)  →  POST /auth/oidc
  → server/src/auth/oidc.ts verifyIdToken            # checks iss + aud + exp against Google's JWKS
  → server issues { access_token, refresh_token, player }
```

## Library (SDK 57)

`@react-native-google-signin/google-signin` — SDK 57's recommended path; the old
`expo-auth-session` Google provider is deprecated. It ships native code, so **it requires a dev
build and does NOT run in Expo Go.** In Expo Go (or with no client id) `lib/oauth.ts` throws
`OAuthNotConfiguredError` and the button shows "coming soon"; the **Dev: Alice / Dev: Bob** buttons
remain the Expo Go two-player path.

## The client IDs (all public — they ship in the app)

You create these in Google Cloud → APIs & Services → Credentials. Google issues the `id_token` with
`aud = webClientId`, which is why the **Web** client id is the single value shared app↔server.

| ID | Where it goes | Notes |
|----|---------------|-------|
| **Web** client id | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (app/.env) **and** `GOOGLE_CLIENT_ID` (root .env, server) | Must be identical in both — it's the token `aud` the server verifies. |
| **iOS** client id | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (app/.env) + `iosUrlScheme` in app.json | `iosUrlScheme` = the id **reversed**: `com.googleusercontent.apps.<ios-client-id>`. |
| **Android** client id | nothing in code | Android matches the OAuth client by app **package + SHA-1** (from the EAS keystore). No id in `configure()`. |

`app.json` currently has a placeholder `iosUrlScheme` (`...REPLACE_WITH_IOS_CLIENT_ID`) — replace it
with the reversed iOS client id before an iOS dev build.

## Verify the join is correct

The only thing that must match exactly:

```
app/.env  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID  ==  root .env  GOOGLE_CLIENT_ID
```

If they differ, the server rejects the token with an `aud` mismatch (401).

## Apple

Deferred until an Apple **Services ID** exists. `getProviderIdToken('apple')` still throws
`OAuthNotConfiguredError`; wire it with `expo-apple-authentication` and set `APPLE_CLIENT_ID`
(root .env) when ready. Google and Apple are independent — neither blocks the other.
