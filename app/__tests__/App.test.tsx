import { render } from '@testing-library/react-native';

import App from '../App';

// App primes the offline stories cache from AsyncStorage on mount.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// On mount the app fetches /me (dev identity) and lists /stories. Return an empty list so the tab
// shell renders the first-run empty state, and a dev player for /me — keeping the test hermetic.
globalThis.fetch = jest.fn((url: string) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve(
        String(url).includes('/me') ? { id: 'dev', display_name: 'dev' } : { stories: [] },
      ),
  }),
) as unknown as typeof fetch;

describe('App', () => {
  it('renders the tab shell with the Stories tab focused', async () => {
    const screen = await render(<App />);
    expect(await screen.findByText('No stories yet')).toBeTruthy();
  });
});
