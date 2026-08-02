import { render } from '@testing-library/react-native';

import RootNavigator from '../src/navigation/RootNavigator';
import { useAuthStore } from '../src/state/authStore';
import type { AuthPlayer } from '../src/state/authStore';

// The gate's job is to decide WHICH screen set exists for a given auth state — not to render the
// real app screens (those have their own tests and pull in React Query / network). Stub the tab
// screens to lightweight markers so this test is purely about the routing decision. Story/Compose
// live in a Stack.Group that only mounts on navigation, so they don't need stubbing here.
jest.mock('../src/screens/StoriesScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => React.createElement(Text, { testID: 'tab-stories' }, 'Stories');
});
jest.mock('../src/screens/DiscoverScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => React.createElement(Text, { testID: 'tab-discover' }, 'Discover');
});
jest.mock('../src/screens/ProfileScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => React.createElement(Text, { testID: 'tab-profile' }, 'Profile');
});

const realPlayer: AuthPlayer = { id: 'p1', display_name: 'alice' };
// A freshly-created OIDC account still carries a generated `player_xxxxxxxx` handle to rename.
const freshPlayer: AuthPlayer = { id: 'p2', display_name: 'player_1a2b3c4d' };

beforeEach(() => {
  // Reset the onboarding one-shots so a state set in one case can't leak into the next.
  useAuthStore.setState({ justOnboarded: false, pendingStart: false });
});

describe('RootNavigator (the auth gate)', () => {
  it('status "loading" shows the hydration splash', async () => {
    useAuthStore.setState({ status: 'loading', player: null });
    const view = await render(<RootNavigator />);
    expect(view.getByTestId('splash')).toBeTruthy();
  });

  it('status "anon" shows Welcome (sign-in options), not the app', async () => {
    useAuthStore.setState({ status: 'anon', player: null });
    const view = await render(<RootNavigator />);
    expect(await view.findByTestId('continue-google')).toBeTruthy();
    expect(view.queryByTestId('tab-stories')).toBeNull();
  });

  it('authed with a still-generated handle routes to the first-run handle pick', async () => {
    useAuthStore.setState({ status: 'authed', player: freshPlayer });
    const view = await render(<RootNavigator />);
    expect(await view.findByTestId('handle-input')).toBeTruthy();
    expect(view.queryByTestId('tab-stories')).toBeNull();
  });

  it('authed with a real handle but just onboarded shows the one-time First-story prompt', async () => {
    useAuthStore.setState({ status: 'authed', player: realPlayer, justOnboarded: true });
    const view = await render(<RootNavigator />);
    expect(await view.findByTestId('first-story-start')).toBeTruthy();
    expect(view.queryByTestId('tab-stories')).toBeNull();
  });

  it('authed with a real handle (not onboarding) routes straight into the app (Tabs)', async () => {
    useAuthStore.setState({ status: 'authed', player: realPlayer, justOnboarded: false });
    const view = await render(<RootNavigator />);
    expect(await view.findByTestId('tab-stories')).toBeTruthy();
    expect(view.queryByTestId('continue-google')).toBeNull();
  });
});
