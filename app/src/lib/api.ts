/**
 * Typed fetch wrapper for the game server. Reconciled onto the real domain types
 * (src/domain/types.ts) as of Phase 2 — no more Phase 1 stub shapes.
 */
import type { Story, Turn } from '../domain/types';
import { useAuthStore } from '../state/authStore';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API error ${status}`);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Attach the current access token; on a 401 do one silent refresh + retry. A rejected token signs
  // out inside authStore.refresh ('invalid'); an offline/transient refresh keeps the session — either
  // way we don't retry and the 401 surfaces.
  const doFetch = (): Promise<Response> => {
    const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
    // Only declare a JSON body when there is one — Fastify 400s on
    // content-type: application/json with an empty body.
    if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
    const token = useAuthStore.getState().accessToken;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${BASE_URL}${path}`, { ...init, headers });
  };

  let res = await doFetch();
  if (res.status === 401 && useAuthStore.getState().refreshToken) {
    const result = await useAuthStore.getState().refresh();
    if (result.status === 'refreshed') res = await doFetch(); // retry once with the rotated token
  }

  const body: unknown = await res.json();
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

/** GET /stories/:id returns a Story plus its Turns (the server composes this view). */
export type StoryWithTurns = Story & { turns: Turn[] };

export const api = {
  health: () => request<HealthResponse>('/health'),
  /** Dev identity bootstrap until Phase 5 auth — who the server thinks "me" is. */
  me: () => request<{ id: string; display_name: string }>('/me'),
  /** First-run handle pick: set the authenticated player's unique display name. 409 if taken. */
  setDisplayName: (displayName: string) =>
    request<{ id: string; display_name: string }>('/me', {
      method: 'PATCH',
      body: JSON.stringify({ display_name: displayName }),
    }),
  createStory: () => request<Story>('/stories', { method: 'POST' }),
  listStories: () => request<{ stories: Story[] }>('/stories'),
  getStory: (id: string) => request<StoryWithTurns>(`/stories/${id}`),
  /** Join a story as its second author (dev stand-in for invites). Returns the updated story. */
  joinStory: (id: string) => request<Story>(`/stories/${id}/join`, { method: 'POST' }),
  /** Stall-gated director hint; `hint` is null when none applies (never an error). */
  directorHint: (id: string) => request<{ hint: string | null }>(`/stories/${id}/director-hint`),
  submitTurn: (id: string, content: string) =>
    request<Turn>(`/stories/${id}/turns`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};

export { BASE_URL };
