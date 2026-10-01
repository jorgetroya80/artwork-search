import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { nightWatchWithoutNotation } from '../../test/msw/factories';
import { server } from '../../test/msw/server';
import { renderHookWithClient } from '../../test/render';
import { RijksApiError } from './errors';
import { useArtwork } from './queries';

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
