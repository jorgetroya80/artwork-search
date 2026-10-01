import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from './msw/server';

const TEST_URL = 'https://data.rijksmuseum.nl/search/collection';

describe('test environment', () => {
  it('runs in jsdom', () => {
    expect(document).toBeDefined();
  });

  it('serves MSW handlers to fetch with a combined AbortSignal', async () => {
    server.use(http.get(TEST_URL, () => HttpResponse.json({ ok: true })));
    const signal = AbortSignal.any([
      new AbortController().signal,
      AbortSignal.timeout(1_000),
    ]);

    const response = await fetch(TEST_URL, { signal });

    expect(await response.json()).toEqual({ ok: true });
  });

  it('rejects fetch when the combined signal aborts', async () => {
    server.use(http.get(TEST_URL, () => HttpResponse.json({ ok: true })));
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal]);
    controller.abort();

    await expect(fetch(TEST_URL, { signal })).rejects.toThrow();
  });

  it('rejects requests without a handler', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(fetch('https://example.com/unhandled')).rejects.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('without a matching request handler')
    );
    consoleError.mockRestore();
  });
});
