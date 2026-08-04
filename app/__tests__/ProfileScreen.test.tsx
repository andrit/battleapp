import { render, userEvent, waitFor } from '@testing-library/react-native';

import ProfileScreen from '../src/screens/ProfileScreen';
import { useAuthStore } from '../src/state/authStore';

beforeEach(() => {
  useAuthStore.setState({
    accessToken: 'a',
    refreshToken: 'r',
    player: { id: 'p1', display_name: 'alice' },
    status: 'authed',
  });
});

describe('ProfileScreen', () => {
  it('shows the signed-in handle and a Sign out control', async () => {
    const view = await render(<ProfileScreen />);
    expect(view.getByText('@alice')).toBeTruthy();
    expect(view.getByTestId('sign-out')).toBeTruthy();
  });

  it('Sign out calls authStore.signOut → status anon (the gate then routes to Welcome)', async () => {
    // The real signOut (revoke + SecureStore wipe) is covered in authStore.test; here assert the
    // screen invokes it and the resulting anon state is what drives the gate back to Welcome.
    const signOut = jest.fn(async () => {
      useAuthStore.setState({ accessToken: null, refreshToken: null, player: null, status: 'anon' });
    });
    useAuthStore.setState({ signOut });

    const view = await render(<ProfileScreen />);
    await userEvent.press(view.getByTestId('sign-out'));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().status).toBe('anon');
  });
});
