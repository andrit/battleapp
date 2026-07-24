import { render, userEvent, waitFor } from '@testing-library/react-native';

import WelcomeScreen from '../src/screens/auth/WelcomeScreen';
import { useAuthStore } from '../src/state/authStore';

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, refreshToken: null, player: null, status: 'anon' });
});

describe('WelcomeScreen', () => {
  it('renders the wordmark, tagline, and both provider buttons', async () => {
    const view = await render(<WelcomeScreen />);
    expect(view.getByText('battleapp')).toBeTruthy();
    expect(view.getByText(/one line at a time/)).toBeTruthy();
    expect(view.getByTestId('continue-apple')).toBeTruthy();
    expect(view.getByTestId('continue-google')).toBeTruthy();
  });

  it('shows a friendly message when the (stubbed) provider flow is not configured', async () => {
    const view = await render(<WelcomeScreen />);
    await userEvent.press(view.getByTestId('continue-google'));
    // The real signInWithProvider hits the OAuth stub → OAuthNotConfiguredError → friendly copy.
    expect(await view.findByTestId('welcome-message')).toBeTruthy();
  });

  it('the dev button signs in and lets the auth gate take over (status → authed)', async () => {
    // Override the dev sign-in to avoid a real /me fetch; assert the store transitions to authed.
    useAuthStore.setState({
      signInAsDev: async () => {
        useAuthStore.setState({ player: { id: 'dev', display_name: 'dev' }, status: 'authed' });
      },
    });
    const view = await render(<WelcomeScreen />);
    await userEvent.press(view.getByTestId('continue-dev'));
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authed'));
  });
});
