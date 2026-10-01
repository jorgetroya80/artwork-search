import {
  infiniteQueryOptions,
  queryOptions,
  skipToken,
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { fetchArtwork, fetchLinkedArt, type FetchEntity } from './artwork';
import { PAGE_SIZE } from './constants';
import { normalizeSearchInput } from './normalize';
import { getVisibleIds } from './pagination';
import { searchCollection } from './search';
import type {
  Artwork,
  ArtworkResult,
  SearchInput,
  SearchParams,
  SearchStatus,
} from './types';

// Collection records rarely change, so resolved artworks and entities never go stale.
const COLLECTION_STALE_TIME = Infinity;

export const rijksQueryKeys = {
  all: ['rijksmuseum'] as const,
  search: (params: SearchParams | null) =>
    [...rijksQueryKeys.all, 'search', params] as const,
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

export const searchQueryOptions = (params: SearchParams | null) =>
  infiniteQueryOptions({
    queryKey: rijksQueryKeys.search(params),
    queryFn: params
      ? ({ pageParam, signal }) => searchCollection(params, pageParam, signal)
      : skipToken,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
  });

function toArtworkResult(
  id: string,
  query: UseQueryResult<Artwork>
): ArtworkResult {
  if (query.isSuccess) return { id, status: 'success', artwork: query.data };
  if (query.isError) {
    return {
      id,
      status: 'error',
      error: query.error,
      retry: () => void query.refetch(),
    };
  }
  return { id, status: 'pending' };
}

export function useArtworkSearch(input: SearchInput) {
  const params = normalizeSearchInput(input);
  const queryClient = useQueryClient();
  const search = useInfiniteQuery(searchQueryOptions(params));
  const pages = search.data?.pages ?? [];
  const visibleIds = getVisibleIds(pages, PAGE_SIZE);
  const artworkQueries = useQueries({
    queries: visibleIds.map((id) => artworkQueryOptions(queryClient, id)),
  });
  const total = pages[0]?.total ?? null;
  const status: SearchStatus = params ? search.status : 'idle';

  return {
    status,
    artworks: visibleIds.map((id, index) =>
      toArtworkResult(id, artworkQueries[index])
    ),
    total,
    isEmpty: status === 'success' && total === 0,
    error: status === 'error' ? search.error : null,
    retry: () => void search.refetch(),
  };
}
