import { render, userEvent } from '@testing-library/react-native';

import StorySection from '../src/components/StorySection';
import type { Turn } from '../src/domain/types';

function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: 't1',
    story_id: 's1',
    author_id: 'p1',
    author_type: 'human',
    content: 'The ferry left before dawn.',
    sequence_number: 1,
    moderation_status: 'passed',
    supersedes: null,
    created_at: '2026-07-22T00:00:00.000Z',
    ...overrides,
  };
}

// Entrance animation is decorative; disable it so tests assert content, not motion.
const noAnim = { animateEntrance: false } as const;

describe('StorySection', () => {
  it('renders a human turn with author chip and serif content', async () => {
    const view = await render(
      <StorySection turn={makeTurn()} authorName="@you" authorSlot="a" {...noAnim} />,
    );
    expect(view.getByTestId('story-section')).toBeTruthy();
    expect(view.queryByTestId('story-section-ai')).toBeNull();
    expect(view.getByText('@you')).toBeTruthy();
    expect(view.getByText('The ferry left before dawn.')).toBeTruthy();
  });

  it('renders an AI turn with the "stepped in for" attribution and AI treatment', async () => {
    const turn = makeTurn({ author_type: 'ai', content: 'It asked, in a voice like wet rope.' });
    const view = await render(
      <StorySection turn={turn} authorName="@sam" authorSlot="b" {...noAnim} />,
    );
    expect(view.getByTestId('story-section-ai')).toBeTruthy();
    expect(view.queryByTestId('story-section')).toBeNull();
    expect(view.getByText(/AI stepped in for @sam/)).toBeTruthy();
  });

  it('shows the reaction affordance only when onToggleReaction is provided, and fires it', async () => {
    const onToggleReaction = jest.fn();
    const view = await render(
      <StorySection turn={makeTurn()} authorName="@you" authorSlot="a" {...noAnim} />,
    );
    expect(view.queryByTestId('react-toggle')).toBeNull();

    await view.rerender(
      <StorySection
        turn={makeTurn()}
        authorName="@you"
        authorSlot="a"
        reactionCount={2}
        onToggleReaction={onToggleReaction}
        {...noAnim}
      />,
    );
    expect(view.getByText('2')).toBeTruthy();
    await userEvent.press(view.getByTestId('react-toggle'));
    expect(onToggleReaction).toHaveBeenCalledTimes(1);
  });
});
