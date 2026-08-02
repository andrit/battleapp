import { render, userEvent, waitFor } from '@testing-library/react-native';

import HandlePickScreen from '../src/screens/auth/HandlePickScreen';
import { api, ApiError } from '../src/lib/api';
import { useAuthStore } from '../src/state/authStore';

beforeEach(() => {
  // Start from a freshly-created account (generated handle, authed) — the state that shows this screen.
  useAuthStore.setState({
    accessToken: 'a',
    refreshToken: 'r',
    player: { id: 'p1', display_name: 'player_1a2b3c4d' },
    status: 'authed',
    justOnboarded: false,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('HandlePickScreen', () => {
  it('renders the prompt and the handle input', async () => {
    const view = await render(<HandlePickScreen />);
    expect(view.getByText('Pick your handle')).toBeTruthy();
    expect(view.getByTestId('handle-input')).toBeTruthy();
  });

  it('a valid handle saves the display name and adopts the returned player', async () => {
    const saved = { id: 'p1', display_name: 'alice' };
    const spy = jest.spyOn(api, 'setDisplayName').mockResolvedValue(saved);

    const view = await render(<HandlePickScreen />);
    await userEvent.type(view.getByTestId('handle-input'), 'alice');
    await userEvent.press(view.getByTestId('handle-submit'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith('alice'));
    // completeHandlePick adopted the real handle AND flagged onboarding → the gate advances to the
    // one-time First-story prompt next.
    expect(useAuthStore.getState().player?.display_name).toBe('alice');
    expect(useAuthStore.getState().justOnboarded).toBe(true);
  });

  it('surfaces the "taken" copy on a 409 without changing the player', async () => {
    jest.spyOn(api, 'setDisplayName').mockRejectedValue(new ApiError(409, { error: 'taken' }));

    const view = await render(<HandlePickScreen />);
    await userEvent.type(view.getByTestId('handle-input'), 'alice');
    await userEvent.press(view.getByTestId('handle-submit'));

    expect(await view.findByTestId('handle-error')).toHaveTextContent(/taken/i);
    expect(useAuthStore.getState().player?.display_name).toBe('player_1a2b3c4d');
  });
});
