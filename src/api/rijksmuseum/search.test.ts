import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../test/msw/server';
import { SEARCH_URL } from './constants';
import { searchCollection } from './search';

const captureSearchUrl = () => {
  const captured: { url: URL | null } = { url: null };
  server.use(
    http.get(SEARCH_URL, ({ request }) => {
      captured.url = new URL(request.url);
      return HttpResponse.json({ partOf: { totalItems: 0 }, orderedItems: [] });
    })
  );
  return captured;
};

describe('searchCollection', () => {
  it('maps a search with one result', async () => {
    const page = await searchCollection({
      creator: 'Rembrandt',
      title: 'Nachtwacht',
    });

    expect(page).toEqual({
      total: 1,
      ids: ['https://id.rijksmuseum.nl/200107928'],
      nextPageToken: null,
    });
  });

  it('maps an empty search', async () => {
    await expect(searchCollection({ title: 'zzqqxx' })).resolves.toEqual({
      total: 0,
      ids: [],
      nextPageToken: null,
    });
  });

  it('reads the next page token from next.id', async () => {
    const page = await searchCollection({ creator: 'Rembrandt' });

    expect(page.ids).toHaveLength(100);
    expect(page.nextPageToken).toBe(
      'eyJ0b2tlbiI6ICJodHRwczovL2lkLnJpamtzbXVzZXVtLm5sLzIwMDEyNDYzNiJ9'
    );
  });

  it('always sends imageAvailable=true and only the given fields', async () => {
    const captured = captureSearchUrl();

    await searchCollection({ creator: 'Rembrandt van Rijn' });

    expect(Object.fromEntries(captured.url!.searchParams)).toEqual({
      creator: 'Rembrandt van Rijn',
      imageAvailable: 'true',
    });
  });

  it('sends the page token when given', async () => {
    const captured = captureSearchUrl();

    await searchCollection({ title: 'Nachtwacht' }, 'abc');

    expect(Object.fromEntries(captured.url!.searchParams)).toEqual({
      title: 'Nachtwacht',
      imageAvailable: 'true',
      pageToken: 'abc',
    });
  });

  it.each([
    [{}],
    [{ partOf: {}, orderedItems: [] }],
    [{ partOf: { totalItems: 1 } }],
    [null],
  ])('throws a parse error for an unexpected shape: %o', async (body) => {
    server.use(http.get(SEARCH_URL, () => HttpResponse.json(body)));

    await expect(searchCollection({ title: 'x' })).rejects.toMatchObject({
      kind: 'parse',
    });
  });

  it('passes http errors through', async () => {
    server.use(
      http.get(SEARCH_URL, () => new HttpResponse(null, { status: 500 }))
    );

    await expect(searchCollection({ title: 'x' })).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    });
  });
});
