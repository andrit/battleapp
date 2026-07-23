import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

/**
 * Submit a turn with an optimistic Section (branch B5 from task-flow.md): the turn appears in
 * the scroll immediately, and on error it rolls back. The component keeps the draft on error
 * (clears it only on success), which is the "returns to the draft box + retry" half of B5.
 */
export function useSubmitTurn(storyId: string) {
  const qc = useQueryClient();
  return useMutation<Turn, Error, string, OptimisticContext>({
    mutationFn: (content) => api.submitTurn(storyId, content),
    onMutate: async (content) => {
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
    onError: (_err, _content, context) => {
      // Roll the optimistic Section back; the draft is preserved in the component for retry.
      if (context?.previous) qc.setQueryData(keys.story(storyId), context.previous);
    },
    onSettled: () => {
      // Reconcile with the server (the real Turn, real sequence number).
      void qc.invalidateQueries({ queryKey: keys.story(storyId) });
    },
  });
}
