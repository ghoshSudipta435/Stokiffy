import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        gcTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false, // Prevent unintentional calculation flickering in financial workstation
        retry: (failureCount: number, error: unknown) => {
          if (failureCount >= 2) return false;
          // Do not retry 4xx errors
          if (error && typeof error === 'object' && 'status' in error) {
            const status = Number((error as { status: unknown }).status);
            if (status >= 400 && status < 500) {
              return false;
            }
          }
          return true;
        },
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always create a new query client
    return createQueryClient();
  }
  // Browser: keep singleton
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();
  }
  return browserQueryClient;
}
