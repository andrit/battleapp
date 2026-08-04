import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearPlayer, loadPlayer, savePlayer } from '../src/lib/playerCache';

const player = { id: 'p1', display_name: 'Alice' };

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('playerCache', () => {
  it('round-trips the non-secret player through AsyncStorage', async () => {
    expect(await loadPlayer()).toBeNull();
    await savePlayer(player);
    expect(await loadPlayer()).toEqual(player);
  });

  it('clearPlayer removes it', async () => {
    await savePlayer(player);
    await clearPlayer();
    expect(await loadPlayer()).toBeNull();
  });

  it('returns null on a corrupt entry rather than throwing', async () => {
    await AsyncStorage.setItem('battleapp.auth.player', 'not json{');
    expect(await loadPlayer()).toBeNull();
  });
});
