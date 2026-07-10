import { render } from '@testing-library/react-native';

import App from '../App';

// App primes the offline stories cache from AsyncStorage on mount.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The Stories tab calls /health on mount — keep the test hermetic.
globalThis.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({ status: 'ok', service: 'battleapp-server', version: '0.1.0' }),
  }),
) as unknown as typeof fetch;

describe('App', () => {
  it('renders the tab shell with Stories focused', async () => {
    const screen = await render(<App />);
    expect(await screen.findByText('server: battleapp-server 0.1.0 — ok')).toBeTruthy();
    expect(screen.getByText('Open placeholder story')).toBeTruthy();
  });
});
