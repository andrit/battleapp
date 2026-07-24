/**
 * Provider OIDC sign-in — acquiring a provider `id_token` to hand to our server (`/auth/oidc`).
 *
 * STUB until the OAuth prerequisites land (GOOGLE_CLIENT_ID / APPLE_CLIENT_ID + an EAS dev build):
 * the real implementation uses `expo-auth-session` (Google) and `expo-apple-authentication` (Apple).
 * This module is deliberately kept free of native imports so the app keeps bundling/running in Expo
 * Go in the meantime, and so tests can mock it cleanly.
 */
import type { Provider } from './authApi';

export type { Provider } from './authApi';

/** Thrown when a provider flow is tapped before OAuth credentials are configured. */
export class OAuthNotConfiguredError extends Error {
  constructor(readonly provider: Provider) {
    super(`Sign in with ${provider} isn’t available yet.`);
    this.name = 'OAuthNotConfiguredError';
  }
}

/**
 * Run the provider flow and return its OIDC `id_token`.
 * TODO(phase-5): implement with expo-auth-session (Google) / expo-apple-authentication (Apple) once
 * client ids + a dev build exist. Until then this throws so the UI shows a friendly "not yet" state.
 */
export async function getProviderIdToken(provider: Provider): Promise<string> {
  throw new OAuthNotConfiguredError(provider);
}
