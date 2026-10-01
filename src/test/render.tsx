import type { PropsWithChildren, ReactElement } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react';

import { createQueryClient } from '../api/rijksmuseum/queryClient';

/** The production QueryClient, without waiting between retries. */
function createTestQueryClient() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retryDelay: 0 },
  });
  return queryClient;
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

/** Renders a hook with a fresh test QueryClient. */
export function renderHookWithClient<TResult, TProps>(
  hook: (props: TProps) => TResult,
  options?: { initialProps?: TProps }
) {
  const { queryClient, wrapper } = createWrapper();
  return { queryClient, ...renderHook(hook, { ...options, wrapper }) };
}

/** Renders UI with a fresh test QueryClient. */
export function renderWithClient(ui: ReactElement) {
  const { queryClient, wrapper } = createWrapper();
  return { queryClient, ...render(ui, { wrapper }) };
}
