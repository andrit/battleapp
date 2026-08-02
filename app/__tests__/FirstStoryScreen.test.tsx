import { render, userEvent, waitFor } from '@testing-library/react-native';

import FirstStoryScreen from '../src/screens/auth/FirstStoryScreen';
import { useAuthStore } from '../src/state/authStore';

beforeEach(() => {
  // The state that shows this screen: authed, real handle, just onboarded.
  useAuthStore.setState({
    status: 'authed',
    player: { id: 'p1', display_name: 'alice' },
    justOnboarded: true,
    pendingStart: false,
  });
});

describe('FirstStoryScreen', () => {
  it('renders the welcome copy and both actions', async () => {
    const view = await render(<FirstStoryScreen />);
    expect(view.getByText(/You.?re in!/)).toBeTruthy();
    expect(view.getByText('Start a story, or look around first.')).toBeTruthy();
    expect(view.getByTestId('first-story-start')).toBeTruthy();
    expect(view.getByTestId('first-story-browse')).toBeTruthy();
  });

  it('"Start a story" dismisses the prompt with the start intent (gate → app, Stories opens create)', async () => {
    const view = await render(<FirstStoryScreen />);
    await userEvent.press(view.getByTestId('first-story-start'));
    await waitFor(() => expect(useAuthStore.getState().justOnboarded).toBe(false));
    expect(useAuthStore.getState().pendingStart).toBe(true);
  });

  it('"Browse" dismisses into the app without the start intent', async () => {
    const view = await render(<FirstStoryScreen />);
    await userEvent.press(view.getByTestId('first-story-browse'));
    await waitFor(() => expect(useAuthStore.getState().justOnboarded).toBe(false));
    expect(useAuthStore.getState().pendingStart).toBe(false);
  });
});
