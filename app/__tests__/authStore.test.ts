import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from '../src/state/authStore';

// expo-secure-store wraps native Keychain/Keystore, unavailable in jest — mock with an
// in-memory store. The real on-device round-trip is verified designer-side in task 9.
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

const TOKEN_KEY = 'battleapp.auth.token';
const player = { id: 'p1', display_name: 'Alice' };

beforeEach(async () => {
  // reset both the store state and the mocked SecureStore
  await useAuthStore.getState().signOut();
});

describe('useAuthStore + SecureStore', () => {
  it('signIn writes the token to SecureStore and marks authed', async () => {
    await useAuthStore.getState().signIn('tok-123', player);
    expect(useAuthStore.getState().token).toBe('tok-123');
    expect(useAuthStore.getState().player).toEqual(player);
    expect(useAuthStore.getState().status).toBe('authed');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEY, 'tok-123');
    expect(await SecureStore.getItemAsync(TOKEN_KEY)).toBe('tok-123');
  });

  it('hydrate restores a persisted token', async () => {
    await SecureStore.setItemAsync(TOKEN_KEY, 'persisted-token');
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().token).toBe('persisted-token');
    expect(useAuthStore.getState().status).toBe('authed');
  });

  it('hydrate with no token marks anon', async () => {
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().status).toBe('anon');
  });

  it('signOut deletes the token from SecureStore and marks anon', async () => {
    await useAuthStore.getState().signIn('tok', player);
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().player).toBeNull();
    expect(useAuthStore.getState().status).toBe('anon');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEY);
    expect(await SecureStore.getItemAsync(TOKEN_KEY)).toBeNull();
  });
});
