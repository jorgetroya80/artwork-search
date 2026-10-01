import { waitFor } from '@testing-library/react';
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
  const isSearchRequest = (url: string) => url.startsWith(SEARCH_URL);
  const searchRequestCount = () => requestedUrls.filter(isSearchRequest).length;
  const countByStatus = (
    search: ReturnType<typeof useArtworkSearch>,
    status: ArtworkResult['status']
  ) => search.artworks.filter((item) => item.status === status).length;

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
