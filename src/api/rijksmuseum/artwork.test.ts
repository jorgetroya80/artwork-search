import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import nightWatch from '../../test/fixtures/object-200107928.json';
import { server } from '../../test/msw/server';
import { fetchArtwork } from './artwork';
import { RijksApiError } from './errors';

const NIGHT_WATCH_ID = 'https://id.rijksmuseum.nl/200107928';
const REMBRANDT_ID = 'https://id.rijksmuseum.nl/2103429';
const VISUAL_ITEM_ID = 'https://id.rijksmuseum.nl/202107928';
const DIGITAL_OBJECT_ID = 'https://id.rijksmuseum.nl/500711199912110510799100';

const requestedUrls: string[] = [];
const recordRequest = ({ request }: { request: Request }) => {
  requestedUrls.push(request.url);
};

const nightWatchWithoutNotation = () => {
  const object = structuredClone(nightWatch) as Record<string, unknown>;
  object.produced_by = {
    ...nightWatch.produced_by,
    part: [{ carried_out_by: [{ id: REMBRANDT_ID, type: 'Person' }] }],
  };
  return object;
};

const serveEntity = (url: string, response: () => Response) =>
  server.use(http.get(url, response));

const failWith500 = () => new HttpResponse(null, { status: 500 });

beforeEach(() => {
  requestedUrls.length = 0;
  server.events.on('request:start', recordRequest);
});

afterEach(() => {
  server.events.removeListener('request:start', recordRequest);
});

describe('fetchArtwork', () => {
  it('resolves The Night Watch with the artist name from notation', async () => {
    const artwork = await fetchArtwork(NIGHT_WATCH_ID);

    expect(artwork).toEqual({
      id: NIGHT_WATCH_ID,
      objectNumber: 'SK-C-5',
      title:
        'The Night Watch Militia Company of District II under the Command of Captain Frans Banninck Cocq',
      artists: ['Rembrandt van Rijn'],
      date: { start: '1642-01-01T00:00:00Z', end: '1642-12-31T23:59:59Z' },
      imageUrl: 'https://iiif.micr.io/PJEZO/full/max/0/default.jpg',
      thumbnailUrl: 'https://iiif.micr.io/PJEZO/full/400,/0/default.jpg',
    });
    expect(requestedUrls).toEqual([
      NIGHT_WATCH_ID,
      VISUAL_ITEM_ID,
      DIGITAL_OBJECT_ID,
    ]);
  });

  it('sends the Linked Art Accept header', async () => {
    let accept: string | null = null;
    serveEntity(DIGITAL_OBJECT_ID, () => HttpResponse.json({}));
    server.use(
      http.get(NIGHT_WATCH_ID, ({ request }) => {
        accept = request.headers.get('Accept');
        return HttpResponse.json(nightWatch);
      })
    );

    await fetchArtwork(NIGHT_WATCH_ID);

    expect(accept).toBe('application/ld+json');
  });

  it('fetches the artist when the object has no English notation', async () => {
    serveEntity(NIGHT_WATCH_ID, () =>
      HttpResponse.json(nightWatchWithoutNotation())
    );

    const artwork = await fetchArtwork(NIGHT_WATCH_ID);

    expect(artwork.artists).toEqual(['Rembrandt van Rijn']);
    expect(requestedUrls).toContain(REMBRANDT_ID);
  });

  it('leaves out an artist whose request fails', async () => {
    serveEntity(NIGHT_WATCH_ID, () =>
      HttpResponse.json(nightWatchWithoutNotation())
    );
    serveEntity(REMBRANDT_ID, failWith500);

    const artwork = await fetchArtwork(NIGHT_WATCH_ID);

    expect(artwork.artists).toEqual([]);
    expect(artwork.title).toContain('The Night Watch');
  });

  it.each([[VISUAL_ITEM_ID], [DIGITAL_OBJECT_ID]])(
    'gives no image when %s fails',
    async (failingUrl) => {
      serveEntity(failingUrl, failWith500);

      const artwork = await fetchArtwork(NIGHT_WATCH_ID);

      expect(artwork.imageUrl).toBeNull();
      expect(artwork.thumbnailUrl).toBeNull();
      expect(artwork.artists).toEqual(['Rembrandt van Rijn']);
    }
  );

  it('rejects with a RijksApiError when the object request fails', async () => {
    serveEntity(NIGHT_WATCH_ID, failWith500);

    await expect(fetchArtwork(NIGHT_WATCH_ID)).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    });
  });

  it('rejects an ID outside the Rijksmuseum domain', async () => {
    await expect(
      fetchArtwork('https://example.com/200107928')
    ).rejects.toMatchObject({ kind: 'invalid-id' });
    expect(requestedUrls).toEqual([]);
  });

  it('uses "Untitled" and empty fields for an object without data', async () => {
    serveEntity(NIGHT_WATCH_ID, () => HttpResponse.json({}));

    await expect(fetchArtwork(NIGHT_WATCH_ID)).resolves.toEqual({
      id: NIGHT_WATCH_ID,
      objectNumber: null,
      title: 'Untitled',
      artists: [],
      date: { start: null, end: null },
      imageUrl: null,
      thumbnailUrl: null,
    });
  });

  it('loads every linked entity through fetchEntity', async () => {
    serveEntity(NIGHT_WATCH_ID, () =>
      HttpResponse.json(nightWatchWithoutNotation())
    );
    const fetchEntity = vi.fn(async (url: string) => {
      const response = await fetch(url);
      return response.json() as Promise<unknown>;
    });

    await fetchArtwork(NIGHT_WATCH_ID, { fetchEntity });

    expect(fetchEntity.mock.calls.map(([url]) => url).sort()).toEqual(
      [DIGITAL_OBJECT_ID, REMBRANDT_ID, VISUAL_ITEM_ID].sort()
    );
  });

  it('rethrows a caller abort instead of returning a partial artwork', async () => {
    const controller = new AbortController();
    serveEntity(VISUAL_ITEM_ID, () => {
      controller.abort();
      return failWith500();
    });

    const error = await fetchArtwork(NIGHT_WATCH_ID, {
      signal: controller.signal,
    }).catch((caught: unknown) => caught);

    expect(error).not.toBeInstanceOf(RijksApiError);
    expect((error as Error).name).toBe('AbortError');
  });
});
