import { QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';

import { createCachePersister, CACHE_MAX_AGE } from '../src/lib/queryClient';

// The persister writes through the (mocked) AsyncStorage singleton, so a fresh client can restore
// what a previous one saved — this is what gives us offline reads for the list and viewed stories.
describe('React Query cache persistence', () => {
  it('persists a query and restores it into a fresh client (offline reads survive a restart)', async () => {
    const persister = createCachePersister();

    const first = new QueryClient();
    first.setQueryData(['stories'], { stories: [{ id: 's1', title: 'Saved' }] });
    first.setQueryData(['story', 's1'], { id: 's1', turns: [{ id: 't1' }] });
    await persistQueryClientSave({ queryClient: first, persister });

    const restored = new QueryClient();
    await persistQueryClientRestore({ queryClient: restored, persister, maxAge: CACHE_MAX_AGE });

    expect(restored.getQueryData(['stories'])).toEqual({ stories: [{ id: 's1', title: 'Saved' }] });
    expect(restored.getQueryData(['story', 's1'])).toEqual({ id: 's1', turns: [{ id: 't1' }] });
  });

  it('drops a restore older than maxAge (stale cache is not shown indefinitely)', async () => {
    const persister = createCachePersister();
    const first = new QueryClient();
    first.setQueryData(['stories'], { stories: [{ id: 's1' }] });
    await persistQueryClientSave({ queryClient: first, persister });

    const restored = new QueryClient();
    await persistQueryClientRestore({ queryClient: restored, persister, maxAge: -1 }); // already expired
    expect(restored.getQueryData(['stories'])).toBeUndefined();
  });
});
