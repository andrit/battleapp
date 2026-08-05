import { render } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';

import { OfflineBanner } from '../src/components/OfflineBanner';
import { isOnlineState, startNetworkMonitoring, useNetworkStore } from '../src/lib/network';

describe('isOnlineState', () => {
  it('is online only when connected and the internet is reachable (unknown reachability = online)', () => {
    expect(isOnlineState({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isOnlineState({ isConnected: true, isInternetReachable: null })).toBe(true); // not yet probed
    expect(isOnlineState({ isConnected: true, isInternetReachable: false })).toBe(false); // connected, no internet
    expect(isOnlineState({ isConnected: false, isInternetReachable: null })).toBe(false);
  });
});

describe('startNetworkMonitoring', () => {
  it('degrades to online (no crash) when the native NetInfo module is unavailable', () => {
    (NetInfo.addEventListener as jest.Mock).mockImplementationOnce(() => {
      throw new Error('@react-native-community/netinfo: NativeModule.RNCNetInfo is null');
    });
    useNetworkStore.setState({ online: false });

    expect(() => startNetworkMonitoring()).not.toThrow();
    expect(useNetworkStore.getState().online).toBe(true);
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
