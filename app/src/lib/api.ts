/**
 * Typed fetch wrapper for the game server. Reconciled onto the real domain types
 * (src/domain/types.ts) as of Phase 2 — no more Phase 1 stub shapes.
 */
import type { Story, Turn } from '../domain/types';

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
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  // Only declare a JSON body when there is one — Fastify 400s on
  // content-type: application/json with an empty body.
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
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
  createStory: () => request<Story>('/stories', { method: 'POST' }),
  listStories: () => request<{ stories: Story[] }>('/stories'),
  getStory: (id: string) => request<StoryWithTurns>(`/stories/${id}`),
  submitTurn: (id: string, content: string) =>
    request<Turn>(`/stories/${id}/turns`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};

export { BASE_URL };
