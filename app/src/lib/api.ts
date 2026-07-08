/**
 * Typed fetch wrapper for the game server.
 * Phase 1: stub shapes mirroring server/src/store.ts.
 * Phase 2 replaces the types with the real domain model and layers React Query on top.
 */
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

export interface StubTurn {
  id: string;
  story_id: string;
  content: string;
  sequence_number: number;
  author_type: 'human' | 'ai';
  created_at: string;
}

export interface StubStory {
  id: string;
  state: 'lobby' | 'active' | 'complete' | 'abandoned';
  turns: StubTurn[];
  created_at: string;
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  createStory: () => request<StubStory>('/stories', { method: 'POST' }),
  listStories: () => request<{ stories: StubStory[] }>('/stories'),
  getStory: (id: string) => request<StubStory>(`/stories/${id}`),
  submitTurn: (id: string, content: string) =>
    request<StubTurn>(`/stories/${id}/turns`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};

export { BASE_URL };
