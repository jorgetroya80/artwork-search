export const SEARCH_URL = 'https://data.rijksmuseum.nl/search/collection';

const API_PAGE_SIZE = 100;
const FIRST_GENERATED_OBJECT_ID = 900_000_000;

type SearchPageOptions = { total: number; pageIndex: number };

export const pageTokenFor = (pageIndex: number) => `test-page-${pageIndex}`;

const makeObjectRef = (index: number) => ({
  id: `https://id.rijksmuseum.nl/${FIRST_GENERATED_OBJECT_ID + index}`,
  type: 'HumanMadeObject',
});

const makeNextLink = (pageIndex: number) => ({
  id: `${SEARCH_URL}?pageToken=${pageTokenFor(pageIndex)}`,
  type: 'OrderedCollectionPage',
});

export function makeSearchPage({ total, pageIndex }: SearchPageOptions) {
  const start = pageIndex * API_PAGE_SIZE;
  const end = Math.min(start + API_PAGE_SIZE, total);
  const indexes = Array.from(
    { length: Math.max(end - start, 0) },
    (_, offset) => start + offset
  );

  return {
    type: 'OrderedCollectionPage',
    partOf: { type: 'OrderedCollection', totalItems: total },
    orderedItems: indexes.map(makeObjectRef),
    ...(end < total && { next: makeNextLink(pageIndex + 1) }),
  };
}
