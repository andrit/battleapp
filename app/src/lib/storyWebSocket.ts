/**
 * Live turn updates over WebSocket. The server publishes `TurnAdded` (via its Notifier seam) to
 * everyone subscribed to a story; this patches the subscriber's React Query cache so the
 * opponent's turn appears without a refetch. The connection lifecycle is tied to the Story
 * screen's mount, and status is mirrored into useStoryStore.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import { BASE_URL, type StoryWithTurns } from './api';
import { keys } from './queries';
import { useIsOnline } from './network';
import { useStoryStore } from '../state/storyStore';
import type { Turn } from '../domain/types';

export function storyWsUrl(id: string): string {
  // http→ws, https→wss
  return `${BASE_URL.replace(/^http/, 'ws')}/ws/stories/${id}`;
}

interface WsEvent {
  type: string;
  payload: unknown;
}

/** Append a turn to the cached story, deduped by id or sequence_number (guards against the
 *  submitter's own optimistic/real turn already being present). No-op if the story isn't cached. */
export function patchStoryWithTurn(qc: QueryClient, storyId: string, turn: Turn): void {
  qc.setQueryData<StoryWithTurns>(keys.story(storyId), (prev) => {
    if (!prev) return prev;
    const dup = prev.turns.some(
      (t) => t.id === turn.id || t.sequence_number === turn.sequence_number,
    );
    if (dup) return prev;
    return { ...prev, turns: [...prev.turns, turn] };
  });
}

/**
 * Open a WebSocket for the story on mount; patch the cache on TurnAdded; close on unmount. Tied to
 * connectivity (Phase 6): while offline we hold no socket, and when the network returns we **reconnect
 * and catch up** by invalidating the story — the socket only carries *live* events, so turns published
 * while it was down need a refetch. (React Query's refetchOnReconnect also refetches active queries;
 * this additionally covers a socket-only drop.)
 */
export function useStoryWebSocket(storyId: string): void {
  const qc = useQueryClient();
  const setWsStatus = useStoryStore((s) => s.setWsStatus);
  const online = useIsOnline();
  const hasConnected = useRef(false);

  useEffect(() => {
    if (!online) {
      setWsStatus('disconnected'); // no socket while offline; reconnect happens when back online
      return;
    }
    setWsStatus('connecting');
    const ws = new WebSocket(storyWsUrl(storyId));

    ws.onopen = () => {
      setWsStatus('connected');
      // On a RECONNECT (not the first open), catch up on turns published while the socket was down.
      if (hasConnected.current) void qc.invalidateQueries({ queryKey: keys.story(storyId) });
      hasConnected.current = true;
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as WsEvent;
        if (msg.type === 'TurnAdded') {
          patchStoryWithTurn(qc, storyId, msg.payload as Turn);
        }
      } catch {
        // ignore malformed frames (e.g. the Phase 1 echo stub)
      }
    };
    ws.onclose = () => setWsStatus('disconnected');

    return () => {
      ws.close();
    };
  }, [storyId, qc, setWsStatus, online]);
}
