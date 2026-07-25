/**
 * Provider OIDC sign-in — acquire a provider `id_token` to hand to our server (`POST /auth/oidc`,
 * which verifies it and mints our own access + refresh tokens).
 *
 * Google uses the native `@react-native-google-signin/google-signin` library — SDK 57's recommended
 * path (the old `expo-auth-session` Google provider is deprecated). It needs a **dev build**: it does
 * NOT run in Expo Go. So the native module is imported lazily and, when it's missing (Expo Go / no
 * dev build) or unconfigured (no client id), we throw `OAuthNotConfiguredError` and the UI shows a
 * friendly "coming soon" — the Alice/Bob dev buttons stay the Expo Go path.
 *
 * Apple is deferred until an Apple **Services ID** exists — still stubbed below.
 *
 * Client IDs — all public (they ship inside the app), configured via `EXPO_PUBLIC_*` env (app/.env):
 *   - EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID — the **Web** OAuth client id. Required to receive an id_token,
 *     and it becomes the token's `aud`, so it MUST equal the server's `GOOGLE_CLIENT_ID`
 *     (verified in server/src/auth/oidc.ts). This is the one value shared between app and server.
 *   - EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID — the iOS OAuth client id (the same client whose reversed id is
 *     the `iosUrlScheme` in app.json). Optional; used on iOS.
 * See docs/engineering/oauth-google.md for the full wiring.
 */
import type { Provider } from './authApi';

export type { Provider } from './authApi';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** Thrown when a provider flow is tapped before its OAuth credentials / native module are available. */
export class OAuthNotConfiguredError extends Error {
  constructor(readonly provider: Provider) {
    super(`Sign in with ${provider} isn’t available yet.`);
    this.name = 'OAuthNotConfiguredError';
  }
}

/** Thrown when the user backs out of the provider sheet — the UI treats this as a no-op (no error). */
export class OAuthCancelledError extends Error {
  constructor(readonly provider: Provider) {
    super(`${provider} sign-in cancelled.`);
    this.name = 'OAuthCancelledError';
  }
}

let googleConfigured = false;

/**
 * Run the provider flow and return its OIDC `id_token` (to POST to /auth/oidc).
 * @throws OAuthNotConfiguredError when the provider isn't wired for this build (Expo Go, no dev build,
 *   or no client id) — the caller shows a "coming soon" message.
 * @throws OAuthCancelledError when the user dismisses the sheet — the caller ignores it.
 */
export async function getProviderIdToken(provider: Provider): Promise<string> {
  if (provider === 'google') return getGoogleIdToken();
  // Apple: deferred until an Apple Services ID + expo-apple-authentication are wired (Phase 5, later).
  throw new OAuthNotConfiguredError(provider);
}

async function getGoogleIdToken(): Promise<string> {
  if (!GOOGLE_WEB_CLIENT_ID) throw new OAuthNotConfiguredError('google');

  // Lazy native import — keeps this module Expo-Go-safe at boot, and jest never loads the native lib
  // because the env gate above short-circuits in tests. A module that can't load (no dev build) is
  // treated as "not configured".
  let mod: typeof import('@react-native-google-signin/google-signin');
  try {
    mod = await import('@react-native-google-signin/google-signin');
  } catch {
    throw new OAuthNotConfiguredError('google');
  }
  const { GoogleSignin, statusCodes, isSuccessResponse, isErrorWithCode } = mod;

  try {
    if (!googleConfigured) {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID, // → id_token `aud`; must match server GOOGLE_CLIENT_ID
        iosClientId: GOOGLE_IOS_CLIENT_ID,
      });
      googleConfigured = true;
    }
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (isSuccessResponse(response)) {
      const idToken = response.data.idToken;
      if (!idToken) throw new Error('Google sign-in returned no id_token');
      return idToken;
    }
    // 'cancelled' / 'noSavedCredentialFound' — the user didn't complete sign-in.
    throw new OAuthCancelledError('google');
  } catch (err) {
    if (err instanceof OAuthCancelledError) throw err;
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new OAuthCancelledError('google');
    }
    if (isNativeModuleUnavailable(err)) throw new OAuthNotConfiguredError('google'); // Expo Go
    throw err;
  }
}

/** Heuristic: the native module isn't linked into this build (i.e. running in Expo Go). */
function isNativeModuleUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /native module|RNGoogleSignin|development build|not (?:available|linked)/i.test(msg);
}
