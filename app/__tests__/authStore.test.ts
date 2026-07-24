import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from '../src/state/authStore';
import { authApi } from '../src/lib/authApi';

// expo-secure-store wraps native Keychain/Keystore, unavailable in jest — mock with an in-memory
// store. The real on-device round-trip is a designer device-check.
jest.mock('expo-secure-store', () => {
  const mem: Record<string, string> = {};
  return {
    getItemAsync: jest.fn((k: string) => Promise.resolve(k in mem ? mem[k] : null)),
    setItemAsync: jest.fn((k: string, v: string) => {
      mem[k] = v;
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((k: string) => {
      delete mem[k];
      return Promise.resolve();
    }),
  };
});

// The auth endpoints are exercised on the server; here we mock them to drive the store's logic.
jest.mock('../src/lib/authApi', () => ({
  authApi: { oidc: jest.fn(), refresh: jest.fn(), signout: jest.fn(), me: jest.fn() },
}));

const REFRESH_KEY = 'battleapp.auth.refresh';
const player = { id: 'p1', display_name: 'Alice' };
const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

beforeEach(async () => {
  jest.clearAllMocks();
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    player: null,
    status: 'loading',
  });
});

describe('useAuthStore — sign-in & secure storage', () => {
  it('signIn persists ONLY the refresh token to SecureStore and goes authed', async () => {
    await useAuthStore
      .getState()
      .signIn({ access_token: 'acc-1', refresh_token: 'ref-1', player });

    const s = useAuthStore.getState();
    expect(s.status).toBe('authed');
    expect(s.accessToken).toBe('acc-1');
    expect(s.player).toEqual(player);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_KEY, 'ref-1');
    // the access token is in memory only — not written to SecureStore
    expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBe('ref-1');
  });
});

describe('useAuthStore — hydrate (cold start)', () => {
  it('with no stored refresh token → anon', async () => {
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().status).toBe('anon');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('with a stored refresh token → refreshes, fetches the player, goes authed', async () => {
    await SecureStore.setItemAsync(REFRESH_KEY, 'stored-ref');
    mockAuthApi.refresh.mockResolvedValue({ access_token: 'acc-2', refresh_token: 'ref-2' });
    mockAuthApi.me.mockResolvedValue(player);

    await useAuthStore.getState().hydrate();

    const s = useAuthStore.getState();
    expect(s.status).toBe('authed');
    expect(s.accessToken).toBe('acc-2');
    expect(s.player).toEqual(player);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_KEY, 'ref-2'); // rotated
  });

  it('with a stale refresh token → signs out (anon, cleared)', async () => {
    await SecureStore.setItemAsync(REFRESH_KEY, 'stale-ref');
    mockAuthApi.refresh.mockRejectedValue(new Error('401'));

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().status).toBe('anon');
    expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBeNull();
  });
});

describe('useAuthStore — refresh', () => {
  it('rotates the tokens and returns the new access token', async () => {
    useAuthStore.setState({ refreshToken: 'ref-a', status: 'authed' });
    mockAuthApi.refresh.mockResolvedValue({ access_token: 'acc-b', refresh_token: 'ref-b' });

    const fresh = await useAuthStore.getState().refresh();

    expect(fresh).toBe('acc-b');
    expect(useAuthStore.getState().accessToken).toBe('acc-b');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_KEY, 'ref-b');
  });

  it('on refresh failure → signs out and returns null', async () => {
    useAuthStore.setState({ refreshToken: 'ref-bad', status: 'authed' });
    mockAuthApi.refresh.mockRejectedValue(new Error('401'));

    const fresh = await useAuthStore.getState().refresh();

    expect(fresh).toBeNull();
    expect(useAuthStore.getState().status).toBe('anon');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

describe('useAuthStore — signOut', () => {
  it('revokes the refresh token, clears SecureStore, goes anon', async () => {
    await useAuthStore
      .getState()
      .signIn({ access_token: 'acc', refresh_token: 'ref', player });

    await useAuthStore.getState().signOut();

    expect(mockAuthApi.signout).toHaveBeenCalledWith('ref');
    expect(useAuthStore.getState().status).toBe('anon');
    expect(useAuthStore.getState().player).toBeNull();
    expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBeNull();
  });
});
