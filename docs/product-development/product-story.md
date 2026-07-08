# BattleApp — Product Story

**Phase 0 deliverable · written 2026-07-03 · seeds the project Knowledgebase**

## One line

BattleApp is a turn-based collaborative storytelling game: you and a friend (or an AI)
trade one paragraph at a time to build a story neither of you could have written alone.

## Origin

The name comes from a game the founder played with friends on shared Google pages — a
"rap battle" reframed around fiction: mystery, sci-fi, thriller, poetry, written together
by taking turns. Sometimes you follow your partner's lead; sometimes you wrench the story
somewhere new. Friends could watch a story unfold and "like" a turn. BattleApp brings that
into the async mobile era — the same social, improvisational spark, on a phone, with people
anywhere.

## Target user

Adults roughly 20–40 who want **creative play with friends without the commitment of a
game night**. They're the audience that already plays Words with Friends: they enjoy
asynchronous, low-friction, one-move-at-a-time games that fit into the gaps of a day. They
don't think of themselves as "writers" — the appeal is play, surprise, and connection, not
producing something publishable.

Secondary: the solo player who wants a lightweight creative outlet and will play against
the AI when a friend isn't mid-story with them (the AI *partner* mode is V2).

## The problem

- **Social creativity requires coordination.** Making something together with friends
  usually means everyone in the same place at the same time. Life doesn't allow that often.
- **Solo creative writing is lonely** and easy to abandon — a blank page with no one on the
  other side.
- Existing word games are about *scoring*, not *making something*. Nothing occupies the
  space between "casual mobile game" and "collaborative creative act."

## Core value

**The story that emerges from two people trading lines is always more surprising than
either would have written alone.** That surprise — the reveal of what your partner did with
the opening you left them — is the product. Everything else (modes, AI, reactions) serves
that moment.

The founder named the generative engine precisely: the tension between **structure and
creative freedom**. Parlour games like Consequences and the surrealist Exquisite Corpse
work *because* their constraints are arbitrary and strange; they produce outputs no author
would plan. Professional storytellers also lean on structure — setup, complication, crisis,
resolution — for coherence and catharsis. BattleApp treats that tension not as a problem to
resolve but as the thing to play inside: structure should feel like **terrain you discover**,
not rails you're locked onto.

## What V1 is (and isn't)

**V1 is ruthlessly small:** two players, async, freeform mode, text in and text out. Player
A invites a friend; once Player B accepts, the story **activates** and Player A writes the
opening paragraph; Player B gets a push notification, reads the story so far, and writes the
next paragraph; they alternate to a turn limit. Signed-in spectators can read active and
finished stories and react per section. An invisible **AI director** offers a gentle, optional
hint **only if a turn stalls** — it stays silent while you're writing and nudges partway through
the turn timer if nothing's been submitted; **moderation** screens every submission; an **AI
fill-in** keeps a stalled story alive on a timeout (clearly attributed, with a per-story "pure
human" opt-out).

**Deferred to V2:** structured and roguelike story modes, the AI *partner* play mode,
real-time co-writing, story export, auto-generated titles.

## Why it can work

- **The mechanic is instantly graspable** — write a line, pass it on. No tutorial needed.
- **The Words with Friends pattern is proven** — async turns, push on your move, social
  reactions. People already know how to play this shape of game.
- **AI deepens the product without taking it over** — it keeps stories moving and quietly
  nudges toward a satisfying arc, but the creative act stays human. (See the "pure human"
  opt-out and the reject-and-retry posture in the design docs.)

## Responsible, efficient AI — a stated value

The company's philosophy is to promote **AI safety, accountability, and responsible use**, and
battleapp is built to demonstrate it, not just claim it. The AI is deliberately restrained — a
helper, never the author — and the app is **frugal with compute by design**: cached prompts,
stall-gated hints, bounded per-call context, and no wasteful always-on model conversation. That
restraint is surfaced to users (e.g., a visible "AI compute used"), turning responsible AI into
a concrete differentiator for an audience wary of AI overreach — the same audience that wants
creative *play*, not a machine doing the creating for them.

## The name

"BattleApp" keeps the origin's playful, competitive energy — a *battle* of imaginations —
even though the deeper experience is collaboration. The store positioning: *"the
collaborative storytelling game — write stories with friends, one line at a time."*
