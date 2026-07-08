import { render, userEvent, waitFor } from '@testing-library/react-native';

import StoryScreen from '../src/screens/StoryScreen';
import type { StubStory, StubTurn } from '../src/lib/api';

const mockTurns: StubTurn[] = [];

jest.mock('../src/lib/api', () => ({
  api: {
    getStory: jest.fn(
      (): Promise<StubStory> =>
        Promise.resolve({
          id: 's1',
          state: 'lobby',
          turns: [...mockTurns],
          created_at: 'now',
        }),
    ),
    submitTurn: jest.fn((storyId: string, content: string): Promise<StubTurn> => {
      const turn: StubTurn = {
        id: `t${mockTurns.length + 1}`,
        story_id: storyId,
        content,
        sequence_number: mockTurns.length + 1,
        author_type: 'human',
        created_at: 'now',
      };
      mockTurns.push(turn);
      return Promise.resolve(turn);
    }),
  },
}));

const props = {
  route: { key: 'story', name: 'Story', params: { id: 's1' } },
  navigation: {},
} as unknown as Parameters<typeof StoryScreen>[0];

describe('StoryScreen — turn stub end-to-end (client half)', () => {
  it('submits a turn and shows it in the story scroll', async () => {
    const screen = await render(<StoryScreen {...props} />);

    expect(await screen.findByText('No turns yet — write the first one.')).toBeTruthy();

    const user = userEvent.setup();
    await user.type(screen.getByTestId('turn-input'), 'Once upon a stub.');
    await user.press(screen.getByText('Submit turn'));

    await waitFor(() => {
      expect(screen.getByText('Once upon a stub.')).toBeTruthy();
      expect(screen.getByText('#1 · human')).toBeTruthy();
    });
    expect(screen.getByText('state: lobby · turns: 1')).toBeTruthy();
  });
});
