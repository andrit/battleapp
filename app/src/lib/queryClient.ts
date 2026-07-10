import { QueryClient } from '@tanstack/react-query';

/**
 * retry:false keeps failures fast and deterministic (a turn-based game surfaces errors to the
 * user rather than silently retrying; React Query still refetches on focus/reconnect). Revisit
 * for the offline story in task 6.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}
