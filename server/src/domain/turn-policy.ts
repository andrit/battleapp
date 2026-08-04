/**
 * Turn-advance policy (Phase 6 forward-compat seam). Isolating "who writes next" behind one pure
 * function keeps the submit path (`POST /stories/:id/turns`) untouched when new modes land. See
 * `docs/engineering/decision-multi-author-forward-compat.md`.
 *
 * V1 ships `round_robin` only. **Scheduled for V2** (that doc + the SDLC roadmap): multi-author (2 → N,
 * still round-robin) and **claim / queue** modes (dynamic "my turn now", 3+ authors) slot in here.
 * Claim mode additionally needs a stored `turn_token` epoch — today the token is the derived turn
 * sequence carried on submit (the optimistic-concurrency guard), which is the same value a future
 * claim arbitration will key on; it graduates to a stored column when that mode is built.
 */
import type { Story } from './types.js';

export type TurnMode = 'round_robin'; // 'claim' | 'queue' — V2 (see the decision doc)

/**
 * `round_robin`: hand the turn to the next participant in **join order** after `lastAuthorId`, wrapping
 * around. A solo story (≤1 participant) stays on the same author so the loop continues. Behaviour is
 * identical to the previous inline "the other participant" logic for V1's two-author stories, and
 * generalises to N authors for free.
 */
export function advanceTurn(story: Story, lastAuthorId: string): string {
  const ids = [...story.participants]
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at)) // deterministic join order
    .map((p) => p.player_id);
  if (ids.length <= 1) return lastAuthorId; // solo → stays your turn
  const i = ids.indexOf(lastAuthorId); // -1 (author not found) → wraps to ids[0]
  return ids[(i + 1) % ids.length];
}
