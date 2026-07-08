import { render } from '@testing-library/react-native';

import App from '../App';

describe('App', () => {
  it('renders without crashing', async () => {
    const { root } = await render(<App />);
    expect(root).toBeTruthy();
  });
});
