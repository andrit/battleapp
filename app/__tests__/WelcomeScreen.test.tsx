import { render, userEvent, waitFor } from '@testing-library/react-native';

import WelcomeScreen from '../src/screens/auth/WelcomeScreen';
import { useAuthStore } from '../src/state/authStore';

const mockNavigate = jest.fn();
const props = {
  navigation: { navigate: mockNavigate },
  route: { key: 'welcome', name: 'Welcome', params: undefined },
} as unknown as Parameters<typeof WelcomeScreen>[0];

beforeEach(() => {
  mockNavigate.mockReset();
  // Reset to a clean anon state; the default (real) signInWithProvider action stays in place.
  useAuthStore.setState({ accessToken: null, refreshToken: null, player: null, status: 'anon' });
});

describe('WelcomeScreen', () => {
  it('renders the wordmark, tagline, and both provider buttons', async () => {
    const view = await render(<WelcomeScreen {...props} />);
    expect(view.getByText('battleapp')).toBeTruthy();
    expect(view.getByText(/one line at a time/)).toBeTruthy();
    expect(view.getByTestId('continue-apple')).toBeTruthy();
    expect(view.getByTestId('continue-google')).toBeTruthy();
  });

  it('shows a friendly message when the (stubbed) provider flow is not configured', async () => {
    const view = await render(<WelcomeScreen {...props} />);
    await userEvent.press(view.getByTestId('continue-google'));
    // The real signInWithProvider hits the OAuth stub → OAuthNotConfiguredError → friendly copy.
    expect(await view.findByTestId('welcome-message')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('routes a new-account sign-in to the handle pick', async () => {
    // Simulate a successful sign-in that lands a freshly-generated handle.
    useAuthStore.setState({
      signInWithProvider: async () => {
        useAuthStore.setState({
          player: { id: 'p1', display_name: 'player_abcd1234' },
          status: 'authed',
        });
      },
    });
    const view = await render(<WelcomeScreen {...props} />);
    await userEvent.press(view.getByTestId('continue-apple'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('HandlePick'));
  });
});
