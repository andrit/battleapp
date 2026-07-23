import { usePreferencesStore } from '../src/state/preferencesStore';

const DEFAULTS = {
  list: { filter: 'all', sort: 'recent' },
  reading: { fontStep: 1, comfort: false, paper: 'warm' },
} as const;

beforeEach(() => {
  usePreferencesStore.setState({ ...DEFAULTS });
});

describe('usePreferencesStore', () => {
  it('has the documented defaults', () => {
    const s = usePreferencesStore.getState();
    expect(s.list).toEqual(DEFAULTS.list);
    expect(s.reading).toEqual(DEFAULTS.reading);
  });

  it('updates list prefs without touching reading prefs', () => {
    usePreferencesStore.getState().setFilter('completed');
    usePreferencesStore.getState().setSort('az');
    const s = usePreferencesStore.getState();
    expect(s.list).toEqual({ filter: 'completed', sort: 'az' });
    expect(s.reading).toEqual(DEFAULTS.reading);
  });

  it('updates reading prefs independently', () => {
    usePreferencesStore.getState().setFontStep(3);
    usePreferencesStore.getState().setComfort(true);
    usePreferencesStore.getState().setPaper('white');
    expect(usePreferencesStore.getState().reading).toEqual({
      fontStep: 3,
      comfort: true,
      paper: 'white',
    });
  });
});
