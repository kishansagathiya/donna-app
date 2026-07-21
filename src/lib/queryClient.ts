import { QueryClient } from '@tanstack/react-query';

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 1000 * 60 * 60 * 24,
        refetchOnWindowFocus: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
        networkMode: 'offlineFirst',
      },
    },
  });
}
