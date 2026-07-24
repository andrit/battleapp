import { api, ApiError } from '../src/lib/api';

// Drive api.ts's auth behavior with a controllable fake auth store.
const mockState: {
  accessToken: string | null;
  refreshToken: string | null;
  refresh: jest.Mock;
} = { accessToken: null, refreshToken: null, refresh: jest.fn() };

jest.mock('../src/state/authStore', () => ({
  useAuthStore: { getState: () => mockState },
}));

const okJson = (data: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
const unauthorized = () =>
  Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'unauthorized' }) });

beforeEach(() => {
  mockState.accessToken = null;
  mockState.refreshToken = null;
  mockState.refresh = jest.fn();
});

describe('api.ts auth interceptor', () => {
  it('attaches the access token as a Bearer header', async () => {
    mockState.accessToken = 'tok';
    const fetchMock: jest.Mock = jest.fn(() => okJson({ stories: [] }));
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;

    await api.listStories();

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });

  it('sends no Authorization header when there is no token', async () => {
    const fetchMock: jest.Mock = jest.fn(() => okJson({ stories: [] }));
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;

    await api.listStories();

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('on 401, silently refreshes once and retries with the rotated token', async () => {
    mockState.accessToken = 'old';
    mockState.refreshToken = 'rt';
    mockState.refresh = jest.fn(async () => {
      mockState.accessToken = 'new';
      return 'new';
    });
    const fetchMock: jest.Mock = jest
      .fn()
      .mockImplementationOnce(unauthorized)
      .mockImplementationOnce(() => okJson({ stories: [] }));
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;

    const result = await api.listStories();

    expect(mockState.refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer new'); // retry uses new token
    expect(result).toEqual({ stories: [] });
  });

  it('when the refresh fails (returns null), the 401 surfaces as an ApiError', async () => {
    mockState.accessToken = 'old';
    mockState.refreshToken = 'rt';
    mockState.refresh = jest.fn(async () => null); // refresh failed → signed out
    const fetchMock: jest.Mock = jest.fn(unauthorized);
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;

    await expect(api.listStories()).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retry after a failed refresh
  });
});
