import { render, userEvent } from '@testing-library/react-native';

import { ReadingControlsSheet } from '../src/components/ReadingControlsSheet';
import { usePreferencesStore } from '../src/state/preferencesStore';

beforeEach(() => {
  usePreferencesStore.setState({
    list: { filter: 'all', sort: 'recent' },
    reading: { fontStep: 1, comfort: false, paper: 'warm' },
  });
});

const reading = () => usePreferencesStore.getState().reading;

describe('ReadingControlsSheet', () => {
  it('steps font size up and down (clamped) into the store', async () => {
    const view = await render(<ReadingControlsSheet visible onClose={jest.fn()} />);
    const user = userEvent.setup();

    await user.press(view.getByTestId('font-larger'));
    expect(reading().fontStep).toBe(2);
    expect(view.getByTestId('font-label')).toHaveTextContent('Size · L');

    await user.press(view.getByTestId('font-smaller'));
    await user.press(view.getByTestId('font-smaller'));
    expect(reading().fontStep).toBe(0); // clamped at S
  });

  it('toggles reading comfort', async () => {
    const view = await render(<ReadingControlsSheet visible onClose={jest.fn()} />);
    await userEvent.press(view.getByTestId('comfort-toggle'));
    expect(reading().comfort).toBe(true);
  });

  it('switches paper to bright white', async () => {
    const view = await render(<ReadingControlsSheet visible onClose={jest.fn()} />);
    await userEvent.press(view.getByTestId('paper-white'));
    expect(reading().paper).toBe('white');
  });
});
