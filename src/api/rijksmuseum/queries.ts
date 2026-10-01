import { useState } from 'react';
import {
  infiniteQueryOptions,
  queryOptions,
  skipToken,
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { fetchArtwork, fetchLinkedArt, type FetchEntity } from './artwork';
import { PAGE_SIZE } from './constants';
import { normalizeSearchInput } from './normalize';
import { getVisibleIds, hasMoreResults, needsNextApiPage } from './pagination';
import { searchCollection } from './search';
import type {
  Artwork,
  ArtworkResult,
  ArtworkSearch,
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

type SearchQueryState = Pick<
  UseInfiniteQueryResult,
  'status' | 'isError' | 'data'
>;

function toSearchStatus(
  hasParams: boolean,
  search: SearchQueryState
): SearchStatus {
  if (!hasParams) return 'idle';
  // A failed next page or background refetch keeps the results already loaded.
  if (search.isError && search.data) return 'success';
  return search.status;
}

// The batch belongs to one search. A new search starts from the first batch again.
type VisibleBatch = { searchKey: string; count: number };

function useVisibleBatch(searchKey: string) {
  const [batch, setBatch] = useState<VisibleBatch>({
    searchKey,
    count: PAGE_SIZE,
  });
  const visibleCount = batch.searchKey === searchKey ? batch.count : PAGE_SIZE;
  const nextCount = visibleCount + PAGE_SIZE;
  const showNextBatch = () => setBatch({ searchKey, count: nextCount });

  return { visibleCount, nextCount, showNextBatch };
}

export function useArtworkSearch(input: SearchInput): ArtworkSearch {
  const params = normalizeSearchInput(input);
  const queryClient = useQueryClient();
  const search = useInfiniteQuery(searchQueryOptions(params));
  const { visibleCount, nextCount, showNextBatch } = useVisibleBatch(
    JSON.stringify(params)
  );

  const pages = search.data?.pages ?? [];
  const visibleIds = getVisibleIds(pages, visibleCount);
  const artworkQueries = useQueries({
    queries: visibleIds.map((id) => artworkQueryOptions(queryClient, id)),
  });
  const total = pages[0]?.total ?? null;
  const hasMore = hasMoreResults(pages, visibleCount);
  const status = toSearchStatus(params !== null, search);

  async function loadMore() {
    if (!hasMore || search.isFetching) return;
    if (needsNextApiPage(pages, nextCount)) {
      const result = await search.fetchNextPage({ cancelRefetch: false });
      if (result.isError) return;
    }
    showNextBatch();
  }

  return {
    status,
    artworks: visibleIds.map((id, index) =>
      toArtworkResult(id, artworkQueries[index])
    ),
    total,
    isEmpty: status === 'success' && total === 0,
    error: status === 'error' ? search.error : null,
    retry: () => void search.refetch(),
    hasMore,
    loadMore: () => void loadMore(),
    isLoadingMore: search.isFetchingNextPage,
    loadMoreError: search.isFetchNextPageError ? search.error : null,
  };
}
