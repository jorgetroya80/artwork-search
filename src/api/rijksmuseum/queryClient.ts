import { QueryClient } from '@tanstack/react-query';

import { RijksApiError } from './errors';

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: RijksApiError;
  }
}

const MAX_RETRIES = 2;
const SEARCH_STALE_TIME_MS = 5 * 60 * 1000;

const shouldRetry = (failureCount: number, error: unknown) =>
  error instanceof RijksApiError &&
  error.retryable &&
  failureCount < MAX_RETRIES;

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: SEARCH_STALE_TIME_MS,
        refetchOnWindowFocus: false,
      },
    },
  });
