import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api, type StoryWithTurns } from './api';
import { useAuthStore } from '../state/authStore';
import type { Turn } from '../domain/types';

export const keys = {
  health: ['health'] as const,
  stories: ['stories'] as const,
  story: (id: string) => ['story', id] as const,
  directorHint: (id: string) => ['directorHint', id] as const,
};

export function useHealth() {
  return useQuery({ queryKey: keys.health, queryFn: api.health });
}

export function useStories() {
  return useQuery({ queryKey: keys.stories, queryFn: api.listStories });
}

/** Join a story as its second author (dev stand-in for invites); refreshes the story on success. */
export function useJoinStory(storyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.joinStory(storyId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.story(storyId) });
    },
  });
}

/** Create a settings-free lobby story (the Start Story FAB); refreshes the list on success. */
export function useCreateStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.createStory(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.stories });
    },
  });
}

export function useStory(id: string) {
  return useQuery({ queryKey: keys.story(id), queryFn: () => api.getStory(id) });
}

/**
 * One-shot director-hint fetch for the Compose surface. Stall-gated + ≤1 per stalled turn on the
 * server, so a single fetch on open is right — no refetch/retry (a missing hint is never an error).
 */
export function useDirectorHint(storyId: string) {
  return useQuery({
    queryKey: keys.directorHint(storyId),
    queryFn: () => api.directorHint(storyId),
    retry: false,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

interface OptimisticContext {
  previous: StoryWithTurns | undefined;
}

/** Variables for the submit-turn mutation. `token` = the sequence the turn should occupy (the server
 *  rejects a stale one with 409). storyId is in the variables so the persisted/resumed mutation is
 *  self-contained. */
export interface SubmitTurnVars {
  storyId: string;
  content: string;
  token: number;
}

const SUBMIT_TURN_KEY = ['submitTurn'] as const;

/**
 * Register the submit-turn mutation **defaults** on the query client. A turn submitted while OFFLINE
 * is paused and persisted (Phase 6 task 2); its `mutationFn` and optimistic/rollback/reconcile logic
 * can't be persisted as closures, so they're registered here by key and re-used when
 * `resumePausedMutations()` replays the turn after a reconnect or app restart (branch B5 of
 * task-flow.md, now offline-durable). Call once at startup, before `PersistQueryClientProvider`.
 * UI feedback (the ack + closing the modal) stays a per-call `onSuccess` in the component.
 */
export function registerMutationDefaults(qc: QueryClient): void {
  qc.setMutationDefaults(SUBMIT_TURN_KEY, {
    mutationFn: (vars) => {
      const { storyId, content, token } = vars as unknown as SubmitTurnVars;
      return api.submitTurn(storyId, content, token);
    },
    onMutate: async (vars) => {
      const { storyId, content } = vars as unknown as SubmitTurnVars;
      await qc.cancelQueries({ queryKey: keys.story(storyId) });
      const previous = qc.getQueryData<StoryWithTurns>(keys.story(storyId));
      if (previous) {
        const optimistic: Turn = {
          id: `optimistic-${Date.now()}`,
          story_id: storyId,
          author_id: useAuthStore.getState().player?.id ?? 'me',
          author_type: 'human',
          content,
          sequence_number: previous.turns.length + 1,
          moderation_status: 'passed',
          supersedes: null,
          created_at: new Date().toISOString(),
        };
        qc.setQueryData<StoryWithTurns>(keys.story(storyId), {
          ...previous,
          turns: [...previous.turns, optimistic],
        });
      }
      return { previous };
    },
    onError: (_err, vars, context) => {
      // Roll the optimistic Section back. A 409 (stale/not-your-turn) is handled for the draft in the
      // component; the cache rollback is the same either way.
      const { storyId } = vars as unknown as SubmitTurnVars;
      const ctx = context as OptimisticContext | undefined;
      if (ctx?.previous) qc.setQueryData(keys.story(storyId), ctx.previous);
    },
    onSettled: (_data, _err, vars) => {
      const { storyId } = vars as unknown as SubmitTurnVars;
      void qc.invalidateQueries({ queryKey: keys.story(storyId) });
    },
  });
}

/**
 * Submit a turn (optimistic B5). Uses the registered defaults (above) so an offline submit queues
 * and replays on reconnect/restart. The caller passes `{ storyId, content, token }`.
 */
export function useSubmitTurn() {
  return useMutation<Turn, Error, SubmitTurnVars, OptimisticContext>({ mutationKey: SUBMIT_TURN_KEY });
}
