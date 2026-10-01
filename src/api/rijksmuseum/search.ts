import { SEARCH_URL } from './constants';
import { RijksApiError } from './errors';
import { fetchJson } from './http';
import type { SearchPage, SearchParams } from './types';

type RawSearchPage = {
  partOf: { totalItems: number };
  orderedItems: { id?: unknown }[];
  next?: { id?: unknown };
};

export async function searchCollection(
  params: SearchParams,
  pageToken?: string | null,
  signal?: AbortSignal
): Promise<SearchPage> {
  const url = buildSearchUrl(params, pageToken);
  const body = await fetchJson(url, { signal });
  if (!isRawSearchPage(body)) {
    throw new RijksApiError(`Unexpected search response shape: ${url}`, {
      kind: 'parse',
      url,
    });
  }
  return toSearchPage(body);
}

function buildSearchUrl(params: SearchParams, pageToken?: string | null) {
  const query = new URLSearchParams();
  if (params.creator) query.set('creator', params.creator);
  if (params.title) query.set('title', params.title);
  query.set('imageAvailable', 'true');
  if (pageToken) query.set('pageToken', pageToken);
  return `${SEARCH_URL}?${query}`;
}

function isRawSearchPage(body: unknown): body is RawSearchPage {
  const page = body as Partial<RawSearchPage> | null;
  return (
    typeof page?.partOf?.totalItems === 'number' &&
    Array.isArray(page.orderedItems)
  );
}

function toSearchPage({ partOf, orderedItems, next }: RawSearchPage) {
  return {
    total: partOf.totalItems,
    ids: orderedItems.flatMap(({ id }) => (typeof id === 'string' ? [id] : [])),
    nextPageToken: readPageToken(next?.id),
  };
}

// The token is opaque: read it from the next link, never decode or build it.
function readPageToken(nextUrl: unknown): string | null {
  if (typeof nextUrl !== 'string') return null;
  return URL.parse(nextUrl)?.searchParams.get('pageToken') ?? null;
}
