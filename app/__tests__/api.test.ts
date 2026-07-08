import { api, ApiError } from '../src/lib/api';

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => mockFetch.mockReset());

describe('api client', () => {
  it('parses a healthy /health response', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ status: 'ok', service: 'battleapp-server', version: '0.1.0' }),
    );
    const health = await api.health();
    expect(health.service).toBe('battleapp-server');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/health'),
      expect.any(Object),
    );
  });

  it('POSTs turn content as JSON', async () => {
    mockFetch.mockReturnValueOnce(
      jsonResponse({ id: 't1', sequence_number: 1, content: 'hello' }, 201),
    );
    await api.submitTurn('story-1', 'hello');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/stories/story-1/turns');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ content: 'hello' });
  });

  it('omits Content-Type on body-less requests (Fastify rejects empty JSON bodies)', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ id: 's1', state: 'lobby', turns: [] }, 201));
    await api.createStory();
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers).not.toHaveProperty('Content-Type');
  });

  it('throws ApiError with status on non-2xx', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ error: 'story_not_found' }, 404));
    await expect(api.getStory('nope')).rejects.toMatchObject({ status: 404 });
    mockFetch.mockReturnValueOnce(jsonResponse({ error: 'story_not_found' }, 404));
    await expect(api.getStory('nope')).rejects.toBeInstanceOf(ApiError);
  });
});
