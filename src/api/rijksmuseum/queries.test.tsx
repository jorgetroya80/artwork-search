import { act, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  generatedObjectId,
  nightWatchWithoutNotation,
} from '../../test/msw/factories';
import { generatedSearchHandlers } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderHookWithClient } from '../../test/render';
import { SEARCH_URL } from './constants';
import { RijksApiError } from './errors';
import { useArtwork, useArtworkSearch } from './queries';
import type { ArtworkResult, SearchInput } from './types';

const NIGHT_WATCH_ID = 'https://id.rijksmuseum.nl/200107928';
const COPY_ID = 'https://id.rijksmuseum.nl/900000001';
const REMBRANDT_ID = 'https://id.rijksmuseum.nl/2103429';

const requestedUrls: string[] = [];
const recordRequest = ({ request }: { request: Request }) => {
  requestedUrls.push(request.url);
};
const countRequests = (url: string) =>
  requestedUrls.filter((requested) => requested === url).length;

const isSearchRequest = (url: string) => url.startsWith(SEARCH_URL);
const searchRequestCount = () => requestedUrls.filter(isSearchRequest).length;
const countByStatus = (
  search: ReturnType<typeof useArtworkSearch>,
  status: ArtworkResult['status']
) => search.artworks.filter((item) => item.status === status).length;

beforeEach(() => {
  requestedUrls.length = 0;
  server.events.on('request:start', recordRequest);
});

afterEach(() => {
  server.events.removeListener('request:start', recordRequest);
});

describe('useArtwork', () => {
  it('resolves The Night Watch', async () => {
    const { result } = renderHookWithClient(() => useArtwork(NIGHT_WATCH_ID));

    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.data).toMatchObject({
      objectNumber: 'SK-C-5',
      artists: ['Rembrandt van Rijn'],
    });
  });

  it('retries a 500 two times, then reports the error', async () => {
    server.use(
      http.get(NIGHT_WATCH_ID, () => new HttpResponse(null, { status: 500 }))
    );

    const { result } = renderHookWithClient(() => useArtwork(NIGHT_WATCH_ID));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBeInstanceOf(RijksApiError);
    expect(result.current.error).toMatchObject({ kind: 'http', status: 500 });
    expect(countRequests(NIGHT_WATCH_ID)).toBe(3);
  });

  it('does not retry a 400', async () => {
    server.use(
      http.get(NIGHT_WATCH_ID, () => new HttpResponse(null, { status: 400 }))
    );

    const { result } = renderHookWithClient(() => useArtwork(NIGHT_WATCH_ID));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(countRequests(NIGHT_WATCH_ID)).toBe(1);
  });

  it('fetches an artist shared by two artworks once', async () => {
    server.use(
      http.get(NIGHT_WATCH_ID, () =>
        HttpResponse.json(nightWatchWithoutNotation())
      ),
      http.get(COPY_ID, () => HttpResponse.json(nightWatchWithoutNotation()))
    );

    const { result } = renderHookWithClient(() => [
      useArtwork(NIGHT_WATCH_ID),
      useArtwork(COPY_ID),
    ]);

    await waitFor(() =>
      expect(result.current.every((query) => query.isSuccess)).toBe(true)
    );
    expect(result.current.map((query) => query.data?.artists)).toEqual([
      ['Rembrandt van Rijn'],
      ['Rembrandt van Rijn'],
    ]);
    expect(countRequests(REMBRANDT_ID)).toBe(1);
  });
});

describe('useArtworkSearch, first batch', () => {
  it('stays idle and sends nothing for a blank input', async () => {
    const { result } = renderHookWithClient(() =>
      useArtworkSearch({ creator: '  ', title: null })
    );

    await delay(20);

    expect(result.current).toMatchObject({
      status: 'idle',
      artworks: [],
      total: null,
      isEmpty: false,
      error: null,
    });
    expect(requestedUrls).toEqual([]);
  });

  it('resolves the first 10 artworks in API order', async () => {
    server.use(...generatedSearchHandlers(1423));

    const { result } = renderHookWithClient(() =>
      useArtworkSearch({ creator: 'Rembrandt' })
    );

    expect(result.current).toMatchObject({ status: 'pending', isEmpty: false });
    await waitFor(() =>
      expect(countByStatus(result.current, 'success')).toBe(10)
    );
    expect(result.current.total).toBe(1423);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.artworks.map((item) => item.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => generatedObjectId(index))
    );
    expect(searchRequestCount()).toBe(1);
  });

  it('reports an empty search with isEmpty', async () => {
    const { result } = renderHookWithClient(() =>
      useArtworkSearch({ title: 'zzqqxx' })
    );

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current).toMatchObject({
      artworks: [],
      total: 0,
      isEmpty: true,
    });
  });

  it('retries a failed search two times, then recovers with retry()', async () => {
    server.use(
      http.get(SEARCH_URL, () => new HttpResponse(null, { status: 500 }))
    );

    const { result } = renderHookWithClient(() =>
      useArtworkSearch({ creator: 'Rembrandt' })
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toMatchObject({ kind: 'http', status: 500 });
    expect(result.current.isEmpty).toBe(false);
    expect(searchRequestCount()).toBe(3);

    server.use(...generatedSearchHandlers(15));
    result.current.retry();

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.error).toBeNull();
    expect(result.current.artworks).toHaveLength(10);
  });

  it('keeps an object failure inside its own item, and retries it', async () => {
    const failingId = generatedObjectId(3);
    server.use(
      http.get(failingId, () => new HttpResponse(null, { status: 404 })),
      ...generatedSearchHandlers(15)
    );

    const { result } = renderHookWithClient(() =>
      useArtworkSearch({ creator: 'Rembrandt' })
    );

    await waitFor(() =>
      expect(countByStatus(result.current, 'success')).toBe(9)
    );
    const failed = result.current.artworks.filter(
      (item) => item.status === 'error'
    );
    expect(failed).toMatchObject([
      { id: failingId, error: { kind: 'http', status: 404 } },
    ]);
    expect(result.current.status).toBe('success');

    server.use(...generatedSearchHandlers(15));
    if (failed[0].status === 'error') failed[0].retry();

    await waitFor(() =>
      expect(countByStatus(result.current, 'success')).toBe(10)
    );
  });

  it('cancels the old search when the input changes', async () => {
    const abortedSearches: string[] = [];
    server.use(
      http.get(SEARCH_URL, async ({ request }) => {
        const title = new URL(request.url).searchParams.get('title');
        if (title !== 'slow') return undefined;
        request.signal.addEventListener('abort', () => {
          abortedSearches.push(title);
        });
        await delay(200);
        return HttpResponse.json({
          partOf: { totalItems: 0 },
          orderedItems: [],
        });
      })
    );

    const { result, rerender } = renderHookWithClient(
      ({ input }: { input: SearchInput }) => useArtworkSearch(input),
      { initialProps: { input: { title: 'slow' } } }
    );
    await waitFor(() => expect(searchRequestCount()).toBe(1));

    rerender({ input: { title: 'zzqqxx' } });

    await waitFor(() => expect(result.current.isEmpty).toBe(true));
    expect(abortedSearches).toEqual(['slow']);
  });
});

describe('useArtworkSearch, load more', () => {
  type SearchHook = { current: ReturnType<typeof useArtworkSearch> };

  const renderSearch = async (total: number) => {
    server.use(...generatedSearchHandlers(total));
    const rendered = renderHookWithClient(
      ({ input }: { input: SearchInput }) => useArtworkSearch(input),
      { initialProps: { input: { creator: 'Rembrandt' } } }
    );
    await waitFor(() => expect(rendered.result.current.total).toBe(total));
    return rendered;
  };

  const loadMore = async (result: SearchHook, times = 1) => {
    for (let call = 0; call < times; call++) {
      const expected = Math.min(
        result.current.artworks.length + 10,
        result.current.total ?? 0
      );
      act(() => result.current.loadMore());
      await waitFor(() =>
        expect(result.current.artworks).toHaveLength(expected)
      );
    }
  };

  it('fetches the next API page only on the 10th call', async () => {
    const { result } = await renderSearch(1423);

    await loadMore(result, 9);
    expect(result.current.artworks).toHaveLength(100);
    expect(searchRequestCount()).toBe(1);

    await loadMore(result);
    expect(result.current.artworks).toHaveLength(110);
    expect(searchRequestCount()).toBe(2);
  });

  it('keeps the artworks already loaded', async () => {
    const { result } = await renderSearch(1423);
    await waitFor(() =>
      expect(countByStatus(result.current, 'success')).toBe(10)
    );

    await loadMore(result);

    expect(
      result.current.artworks.slice(0, 10).map((item) => item.status)
    ).toEqual(Array(10).fill('success'));
    expect(result.current.artworks[10].id).toBe(generatedObjectId(10));
  });

  it('adds one batch for a double call during a page fetch', async () => {
    const { result } = await renderSearch(1423);
    await loadMore(result, 9);

    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.artworks).toHaveLength(110));
    await delay(50);
    expect(result.current.artworks).toHaveLength(110);
    expect(searchRequestCount()).toBe(2);
  });

  it('reaches the end of 1423 results with a last batch of 3', async () => {
    const { result } = await renderSearch(1423);

    await loadMore(result, 142);

    expect(result.current.artworks).toHaveLength(1423);
    expect(result.current.artworks.at(-1)?.id).toBe(generatedObjectId(1422));
    expect(result.current.hasMore).toBe(false);
    expect(searchRequestCount()).toBe(15);

    act(() => result.current.loadMore());
    await delay(20);
    expect(result.current.artworks).toHaveLength(1423);
  }, 30_000);

  it('keeps the list on a failed next page and retries on the next call', async () => {
    const { result } = await renderSearch(1423);
    await loadMore(result, 9);
    server.use(
      http.get(SEARCH_URL, () => new HttpResponse(null, { status: 503 }))
    );

    act(() => result.current.loadMore());

    await waitFor(() =>
      expect(result.current.loadMoreError).toMatchObject({ status: 503 })
    );
    expect(result.current).toMatchObject({
      status: 'success',
      error: null,
      hasMore: true,
      isLoadingMore: false,
    });
    expect(result.current.artworks).toHaveLength(100);

    server.use(...generatedSearchHandlers(1423));
    await loadMore(result);
    expect(result.current.loadMoreError).toBeNull();
  });

  it('reports isLoadingMore while the next page loads', async () => {
    const { result } = await renderSearch(1423);
    await loadMore(result, 9);
    server.use(
      http.get(SEARCH_URL, async () => {
        await delay(50);
        return undefined;
      })
    );

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.isLoadingMore).toBe(true));
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));
    expect(result.current.artworks).toHaveLength(110);
  });

  it('starts again from 10 when the input changes', async () => {
    const { result, rerender } = await renderSearch(1423);
    await loadMore(result, 2);

    rerender({ input: { creator: 'Vermeer' } });

    await waitFor(() => expect(result.current.artworks).toHaveLength(10));
  });

  it('stops at the last page when the API total promises more results', async () => {
    server.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json({
          partOf: { totalItems: 25 },
          orderedItems: Array.from({ length: 12 }, (_, index) => ({
            id: generatedObjectId(index),
          })),
        })
      ),
      ...generatedSearchHandlers(15).slice(1)
    );
    const { result } = renderHookWithClient(() =>
      useArtworkSearch({ creator: 'Rembrandt' })
    );
    await waitFor(() => expect(result.current.artworks).toHaveLength(10));
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.artworks).toHaveLength(12));
    expect(result.current.hasMore).toBe(false);
  });

  it('keeps the results and status when a background refetch fails', async () => {
    const { result, queryClient } = await renderSearch(1423);
    server.use(
      http.get(SEARCH_URL, () => new HttpResponse(null, { status: 500 }))
    );

    const searchKey = ['rijksmuseum', 'search', { creator: 'Rembrandt' }];

    await act(() => queryClient.refetchQueries({ queryKey: searchKey }));
    await waitFor(() =>
      expect(queryClient.getQueryState(searchKey)?.status).toBe('error')
    );

    expect(searchRequestCount()).toBe(4);
    expect(result.current).toMatchObject({
      status: 'success',
      error: null,
      loadMoreError: null,
      total: 1423,
    });
    expect(result.current.artworks).toHaveLength(10);
  });

  it('has nothing more for idle and empty searches', async () => {
    const idle = renderHookWithClient(() => useArtworkSearch({}));
    const empty = renderHookWithClient(() =>
      useArtworkSearch({ title: 'zzqqxx' })
    );

    await waitFor(() => expect(empty.result.current.isEmpty).toBe(true));
    expect(idle.result.current.hasMore).toBe(false);
    expect(empty.result.current.hasMore).toBe(false);
  });
});
