/**
 * AI Service Layer — the single anti-corruption boundary to the Anthropic API (ai-service-layer.md).
 * Game code calls two stable contracts, `moderateTurn` and `directorHint`, and never sees model
 * IDs, prompt text, or SDK types. V1 scope is director-hint (stall-gated) + a moderation hook; AI
 * Fill-in is deferred.
 *
 * Stub by default, real Claude call when ANTHROPIC_API_KEY is set — so the compose stack and the
 * test suites run fully offline against the stub, and production (with a key) gets real screening
 * and hints. Frugality is the point: moderation is cheap and cached; the hint is stall-gated and
 * rare (see director.ts).
 */
import type { BoundedView } from './director.js';

/** Model alias, pinned in one place (ai-service-layer.md §1). Haiku is the frugal, high-volume tier. */
export const AI_MODEL = 'claude-haiku-4-5';

export interface ModerationResult {
  verdict: 'pass' | 'reject';
  /** Player-facing text on reject (the B4 branch); absent on pass. */
  reason?: string;
}

export interface DirectorHint {
  /** One structural nudge, 1–2 sentences ≤ 200 chars. Never story prose. */
  hint: string;
}

export interface AiService {
  /**
   * Screen candidate Turn content before it becomes a Turn. Fail-closed: on an error the caller
   * must NOT store the content (the invariant is "only passed content becomes a Turn").
   */
  moderateTurn(content: string): Promise<ModerationResult>;
  /**
   * One optional structural hint for a stalled turn. Returns null when there's nothing useful to
   * say; a thrown error is treated by the caller as "no hint" (silent skip, ai-director-spec §6).
   */
  directorHint(view: BoundedView): Promise<DirectorHint | null>;
}

// --- Stub (default; offline) ---------------------------------------------------

/**
 * Stub service. Moderation passes everything (real policy screening needs a key); the director
 * offers a rotating structural nudge that never reads story content — enough to exercise the
 * stall-gate, the endpoint, and the client card end-to-end without an API key.
 */
export function createStubAiService(): AiService {
  const nudges = [
    'What does your partner’s last line leave unanswered? Answer it, or make it worse.',
    'Raise the stakes: give the scene something to lose in the next sentence.',
    'Introduce a small, concrete detail that complicates what just happened.',
  ];
  let cursor = 0;
  return {
    async moderateTurn() {
      return { verdict: 'pass' };
    },
    async directorHint(view) {
      const hint = nudges[cursor % nudges.length]!;
      cursor += 1;
      // Keep the stub honest to the contract even though it ignores the view.
      void view;
      return { hint };
    },
  };
}

// --- Real (Anthropic; only when ANTHROPIC_API_KEY is set) -----------------------

const MODERATION_SYSTEM = [
  'You are a content-moderation classifier for a collaborative storytelling game.',
  'Screen a single candidate story sentence for policy violations only — not quality, not style.',
  'Reject content that is illegal, sexual content involving minors, credible threats or incitement',
  'to violence against real people, targeted harassment, or instructions that enable serious harm.',
  'Fictional darkness, conflict, and mature themes in service of a story are allowed — this is a',
  'storytelling game, not a safe-for-all-audiences product. When in doubt about fiction, pass.',
  'On reject, give a short, non-judgmental player-facing reason. Output only the structured verdict.',
].join(' ');

const DIRECTOR_SYSTEM = [
  'You are the invisible narrative Director for a two-author storytelling game.',
  'A player has stalled mid-turn. Offer ONE optional, structural nudge to get them writing again —',
  '1–2 sentences, at most 200 characters. Suggest a direction ("consider…", "what if…"), never',
  'write story prose, never a full sentence they could paste in. Infer the mood from the last turns',
  'and match it. Output only the hint text, nothing else.',
].join(' ');

const MODERATION_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'reject'] },
    reason: { type: 'string' },
  },
  required: ['verdict'],
  additionalProperties: false,
} as const;

function renderBoundedView(view: BoundedView): string {
  const lines: string[] = [];
  if (view.premise) lines.push(`Premise: ${view.premise}`);
  if (view.summary) lines.push(`Story so far: ${view.summary}`);
  for (const t of view.lastTurns) {
    lines.push(`${t.author_type === 'ai' ? 'AI' : 'Author'}: ${t.content}`);
  }
  lines.push('The next author has stalled. Give one structural nudge.');
  return lines.join('\n');
}

/**
 * Real service backed by Anthropic. The SDK reads ANTHROPIC_API_KEY from the environment. The
 * client type is imported lazily so the module loads without the key/SDK resolved at import time.
 */
export async function createAnthropicAiService(): Promise<AiService> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();

  return {
    async moderateTurn(content) {
      // The stable policy block is cache_control'd (identical across every call → cache hits).
      const res = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 128,
        system: [{ type: 'text', text: MODERATION_SYSTEM, cache_control: { type: 'ephemeral' } }],
        output_config: { format: { type: 'json_schema', schema: MODERATION_SCHEMA } },
        messages: [{ role: 'user', content }],
      });
      const text = res.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') throw new Error('moderation: no structured output');
      const parsed = JSON.parse(text.text) as ModerationResult;
      return parsed.verdict === 'reject'
        ? { verdict: 'reject', reason: parsed.reason ?? 'This turn was blocked by moderation.' }
        : { verdict: 'pass' };
    },

    async directorHint(view) {
      const res = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 128,
        system: [{ type: 'text', text: DIRECTOR_SYSTEM }],
        messages: [{ role: 'user', content: renderBoundedView(view) }],
      });
      const text = res.content.find((b) => b.type === 'text');
      const hint = text && text.type === 'text' ? text.text.trim().slice(0, 200) : '';
      return hint.length > 0 ? { hint } : null;
    },
  };
}

/**
 * Pick the service by environment: real when ANTHROPIC_API_KEY is present, else the offline stub.
 * Awaiting the dynamic import only when keyed keeps the stub path synchronous-cheap.
 */
export async function createAiService(): Promise<AiService> {
  if (process.env.ANTHROPIC_API_KEY) return createAnthropicAiService();
  return createStubAiService();
}
