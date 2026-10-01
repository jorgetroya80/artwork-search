import {
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { fetchArtwork, fetchLinkedArt, type FetchEntity } from './artwork';

// Collection records rarely change, so resolved artworks and entities never go stale.
const COLLECTION_STALE_TIME = Infinity;

export const rijksQueryKeys = {
  all: ['rijksmuseum'] as const,
  artwork: (id: string) => [...rijksQueryKeys.all, 'artwork', id] as const,
  entity: (id: string) => [...rijksQueryKeys.all, 'entity', id] as const,
};

// Linked entities are shared across artworks (one artist, many works), so they get their own
// cache entry and their own signal: one artwork cancelling must not cancel a shared request.
const createEntityFetcher =
  (queryClient: QueryClient): FetchEntity =>
  (url) =>
    queryClient.fetchQuery({
      queryKey: rijksQueryKeys.entity(url),
      queryFn: ({ signal }) => fetchLinkedArt(url, signal),
      staleTime: COLLECTION_STALE_TIME,
    });

export const artworkQueryOptions = (queryClient: QueryClient, id: string) =>
  queryOptions({
    queryKey: rijksQueryKeys.artwork(id),
    queryFn: ({ signal }) =>
      fetchArtwork(id, {
        signal,
        fetchEntity: createEntityFetcher(queryClient),
      }),
    staleTime: COLLECTION_STALE_TIME,
  });

export function useArtwork(id: string) {
  const queryClient = useQueryClient();
  return useQuery(artworkQueryOptions(queryClient, id));
}
