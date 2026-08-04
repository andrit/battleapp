import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuthStore } from '../src/state/authStore';
import { authApi, AuthApiError } from '../src/lib/authApi';
import { loadPlayer } from '../src/lib/playerCache';

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

// Mock only the authApi endpoints; keep the REAL AuthApiError / isAuthRejection so the store's
// network-vs-rejection branching is exercised faithfully. (playerCache stays real over the global
// AsyncStorage mock.)
jest.mock('../src/lib/authApi', () => {
  const actual = jest.requireActual('../src/lib/authApi');
  return {
    ...actual,
    authApi: {
      oidc: jest.fn(),
      refresh: jest.fn(),
      signout: jest.fn(),
      me: jest.fn(),
      devSession: jest.fn(),
    },
  };
});

const REFRESH_KEY = 'battleapp.auth.refresh';
const player = { id: 'p1', display_name: 'Alice' };
const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const networkError = () => new TypeError('Network request failed'); // fetch reject → "offline"

beforeEach(async () => {
  jest.clearAllMocks();
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await AsyncStorage.clear(); // player cache
  useAuthStore.setState({ accessToken: null, refreshToken: null, player: null, status: 'loading' });
});

describe('useAuthStore — sign-in & secure storage', () => {
  it('signIn persists ONLY the refresh token to SecureStore, caches the player, goes authed', async () => {
    await useAuthStore.getState().signIn({ access_token: 'acc-1', refresh_token: 'ref-1', player });

    const s = useAuthStore.getState();
    expect(s.status).toBe('authed');
    expect(s.accessToken).toBe('acc-1');
    expect(s.player).toEqual(player);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_KEY, 'ref-1');
    expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBe('ref-1');
    expect(await loadPlayer()).toEqual(player); // non-secret identity cached for offline start
  });
});

describe('useAuthStore — hydrate (cold start)', () => {
  it('with no stored refresh token → anon', async () => {
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().status).toBe('anon');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('with a stored refresh token → refreshes, fetches the player, caches it, goes authed', async () => {
    await SecureStore.setItemAsync(REFRESH_KEY, 'stored-ref');
    mockAuthApi.refresh.mockResolvedValue({ access_token: 'acc-2', refresh_token: 'ref-2' });
    mockAuthApi.me.mockResolvedValue(player);

    await useAuthStore.getState().hydrate();

    const s = useAuthStore.getState();
    expect(s.status).toBe('authed');
    expect(s.accessToken).toBe('acc-2');
    expect(s.player).toEqual(player);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_KEY, 'ref-2'); // rotated
    expect(await loadPlayer()).toEqual(player);
  });

  it('with a REJECTED token (401) → signs out (anon, token wiped)', async () => {
    await SecureStore.setItemAsync(REFRESH_KEY, 'stale-ref');
    mockAuthApi.refresh.mockRejectedValue(new AuthApiError(401, '/auth/refresh'));

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().status).toBe('anon');
    expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBeNull();
  });

  it('OFFLINE with a cached player → stays authed, token NOT wiped (no sign-out on a network blip)', async () => {
    await SecureStore.setItemAsync(REFRESH_KEY, 'stored-ref');
    await AsyncStorage.setItem('battleapp.auth.player', JSON.stringify(player)); // prior session cached it
    mockAuthApi.refresh.mockRejectedValue(networkError());

    await useAuthStore.getState().hydrate();

    const s = useAuthStore.getState();
    expect(s.status).toBe('authed'); // offline-authed
    expect(s.player).toEqual(player);
    expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBe('stored-ref'); // token preserved
    expect(mockAuthApi.signout).not.toHaveBeenCalled();
  });

  it('OFFLINE with no cached player → anon but token KEPT (a later online launch restores)', async () => {
    await SecureStore.setItemAsync(REFRESH_KEY, 'stored-ref');
    mockAuthApi.refresh.mockRejectedValue(networkError());

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().status).toBe('anon');
    expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBe('stored-ref'); // NOT wiped
  });
});

describe('useAuthStore — refresh', () => {
  it('rotates the tokens → { refreshed, accessToken }', async () => {
    useAuthStore.setState({ refreshToken: 'ref-a', status: 'authed' });
    mockAuthApi.refresh.mockResolvedValue({ access_token: 'acc-b', refresh_token: 'ref-b' });

    const result = await useAuthStore.getState().refresh();

    expect(result).toEqual({ status: 'refreshed', accessToken: 'acc-b' });
    expect(useAuthStore.getState().accessToken).toBe('acc-b');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_KEY, 'ref-b');
  });

  it('on a REJECTED token (401) → { invalid }, signs out', async () => {
    useAuthStore.setState({ refreshToken: 'ref-bad', status: 'authed', accessToken: 'old' });
    mockAuthApi.refresh.mockRejectedValue(new AuthApiError(401, '/auth/refresh'));

    const result = await useAuthStore.getState().refresh();

    expect(result).toEqual({ status: 'invalid' });
    expect(useAuthStore.getState().status).toBe('anon');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('on a NETWORK error → { offline }, keeps the token & session', async () => {
    useAuthStore.setState({ refreshToken: 'ref-keep', status: 'authed', accessToken: 'old' });
    await SecureStore.setItemAsync(REFRESH_KEY, 'ref-keep');
    mockAuthApi.refresh.mockRejectedValue(networkError());

    const result = await useAuthStore.getState().refresh();

    expect(result).toEqual({ status: 'offline' });
    expect(useAuthStore.getState().status).toBe('authed'); // unchanged
    expect(useAuthStore.getState().refreshToken).toBe('ref-keep');
    expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBe('ref-keep'); // not wiped
    expect(mockAuthApi.signout).not.toHaveBeenCalled();
  });
});

describe('useAuthStore — signOut', () => {
  it('revokes the refresh token, clears SecureStore + player cache, goes anon', async () => {
    await useAuthStore.getState().signIn({ access_token: 'acc', refresh_token: 'ref', player });

    await useAuthStore.getState().signOut();

    expect(mockAuthApi.signout).toHaveBeenCalledWith('ref');
    expect(useAuthStore.getState().status).toBe('anon');
    expect(useAuthStore.getState().player).toBeNull();
    expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBeNull();
    expect(await loadPlayer()).toBeNull(); // offline-identity cache cleared
  });
});
