import { QueryClient } from '@tanstack/react-query';

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 1000 * 60 * 60 * 24,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          if (failureCount >= 3) {
            return false;
          }
          const message =
            error instanceof Error ? error.message : String(error);
          return /network request failed|check your connection/i.test(message);
        },
      },
      mutations: {
        retry: 0,
        networkMode: 'offlineFirst',
      },
    },
  });
}
