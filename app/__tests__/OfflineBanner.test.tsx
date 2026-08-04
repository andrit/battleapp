import { render } from '@testing-library/react-native';

import { OfflineBanner } from '../src/components/OfflineBanner';
import { isOnlineState, useNetworkStore } from '../src/lib/network';

describe('isOnlineState', () => {
  it('is online only when connected and the internet is reachable (unknown reachability = online)', () => {
    expect(isOnlineState({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isOnlineState({ isConnected: true, isInternetReachable: null })).toBe(true); // not yet probed
    expect(isOnlineState({ isConnected: true, isInternetReachable: false })).toBe(false); // connected, no internet
    expect(isOnlineState({ isConnected: false, isInternetReachable: null })).toBe(false);
  });
});

describe('OfflineBanner', () => {
  afterEach(() => useNetworkStore.setState({ online: true }));

  it('renders nothing while online', async () => {
    useNetworkStore.setState({ online: true });
    const view = await render(<OfflineBanner />);
    expect(view.queryByTestId('offline-banner')).toBeNull();
  });

  it('shows the banner when offline', async () => {
    useNetworkStore.setState({ online: false });
    const view = await render(<OfflineBanner />);
    expect(view.getByTestId('offline-banner')).toBeTruthy();
  });
});
