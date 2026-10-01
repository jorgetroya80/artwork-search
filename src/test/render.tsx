import type { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';

import { createQueryClient } from '../api/rijksmuseum/queryClient';

/** Renders a hook with a fresh production QueryClient, without waiting between retries. */
export function renderHookWithClient<TResult>(hook: () => TResult) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retryDelay: 0 },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(hook, { wrapper }) };
}
