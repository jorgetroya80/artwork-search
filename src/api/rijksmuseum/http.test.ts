import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../test/msw/server';
import { ENTITY_URL_PREFIX, SEARCH_URL } from './constants';
import { RijksApiError } from './errors';
import { fetchJson } from './http';

const ENTITY_URL = `${ENTITY_URL_PREFIX}200107928`;

const respondWith = (resolver: Parameters<typeof http.get>[1]) =>
  server.use(http.get(ENTITY_URL, resolver));

const catchError = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('Expected the promise to reject');
    },
    (error: unknown) => error
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchJson', () => {
  it('returns the parsed JSON body', async () => {
    respondWith(() => HttpResponse.json({ id: ENTITY_URL }));

    await expect(fetchJson(ENTITY_URL)).resolves.toEqual({ id: ENTITY_URL });
  });

  it('sends the requested Accept header', async () => {
    let accept: string | null = null;
    respondWith(({ request }) => {
      accept = request.headers.get('Accept');
      return HttpResponse.json({});
    });

    await fetchJson(ENTITY_URL, { accept: 'application/ld+json' });

    expect(accept).toBe('application/ld+json');
  });

  it('allows the search URL', async () => {
    server.use(http.get(SEARCH_URL, () => HttpResponse.json({ ok: true })));

    await expect(fetchJson(`${SEARCH_URL}?title=x`)).resolves.toEqual({
      ok: true,
    });
  });

  it.each([
    ['https://example.com/200107928'],
    ['https://id.rijksmuseum.nl.evil.com/200107928'],
    ['http://id.rijksmuseum.nl/200107928'],
  ])('rejects %s as invalid-id without a request', async (url) => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const error = await catchError(fetchJson(url));

    expect(error).toMatchObject({ kind: 'invalid-id', retryable: false, url });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('includes the API detail in the message of an http error', async () => {
    respondWith(() =>
      HttpResponse.json(
        { detail: 'Unsupported query parameter: foo' },
        { status: 400 }
      )
    );

    const error = await catchError(fetchJson(ENTITY_URL));

    expect(error).toBeInstanceOf(RijksApiError);
    expect(error).toMatchObject({
      kind: 'http',
      status: 400,
      retryable: false,
    });
    expect((error as Error).message).toContain(
      'Unsupported query parameter: foo'
    );
  });

  it.each([
    [404, false],
    [429, true],
    [500, true],
    [503, true],
  ])(
    'maps HTTP %i to an http error, retryable: %s',
    async (status, retryable) => {
      respondWith(() => new HttpResponse('oops', { status }));

      const error = await catchError(fetchJson(ENTITY_URL));

      expect(error).toMatchObject({ kind: 'http', status, retryable });
    }
  );

  it('maps a failed request to a retryable network error', async () => {
    respondWith(() => HttpResponse.error());

    const error = await catchError(fetchJson(ENTITY_URL));

    expect(error).toMatchObject({
      kind: 'network',
      status: null,
      retryable: true,
    });
    expect((error as Error).cause).toBeDefined();
  });

  it('maps a slow response to a retryable timeout error', async () => {
    respondWith(async () => {
      await delay(200);
      return HttpResponse.json({});
    });

    const error = await catchError(fetchJson(ENTITY_URL, { timeoutMs: 20 }));

    expect(error).toMatchObject({ kind: 'timeout', retryable: true });
  });

  it('maps a body that is not JSON to a parse error', async () => {
    respondWith(() => HttpResponse.text('<html>'));

    const error = await catchError(fetchJson(ENTITY_URL));

    expect(error).toMatchObject({ kind: 'parse', retryable: false });
  });

  it('rethrows a caller abort as is, not as a RijksApiError', async () => {
    respondWith(async () => {
      await delay(200);
      return HttpResponse.json({});
    });
    const controller = new AbortController();

    const pending = catchError(
      fetchJson(ENTITY_URL, { signal: controller.signal })
    );
    controller.abort();
    const error = await pending;

    expect(error).not.toBeInstanceOf(RijksApiError);
    expect((error as Error).name).toBe('AbortError');
  });
});
