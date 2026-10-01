import {
  AAT,
  API_PAGE_SIZE,
  ENTITY_URL_PREFIX,
  SEARCH_URL,
} from '../../api/rijksmuseum/constants';
import nightWatch from '../fixtures/object-200107928.json';

const FIRST_GENERATED_OBJECT_ID = 900_000_000;

type SearchPageOptions = { total: number; pageIndex: number };

const PAGE_TOKEN_PREFIX = 'test-page-';

export const pageTokenFor = (pageIndex: number) =>
  `${PAGE_TOKEN_PREFIX}${pageIndex}`;

export const pageIndexFromToken = (token: string | null) =>
  token ? Number(token.slice(PAGE_TOKEN_PREFIX.length)) : 0;

export const generatedObjectId = (index: number) =>
  `${ENTITY_URL_PREFIX}${FIRST_GENERATED_OBJECT_ID + index}`;

export const isGeneratedObjectId = (numericId: number) =>
  numericId >= FIRST_GENERATED_OBJECT_ID;

const makeObjectRef = (index: number) => ({
  id: generatedObjectId(index),
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

/** The Night Watch without artist `notation`, so the artist must be fetched. */
export function nightWatchWithoutNotation() {
  const [artist] = nightWatch.produced_by.part[0].carried_out_by;
  return {
    ...structuredClone(nightWatch),
    produced_by: {
      ...nightWatch.produced_by,
      part: [{ carried_out_by: [{ id: artist.id, type: artist.type }] }],
    },
  };
}

/** A minimal object with an English title and an artist notation, and no image. */
export const makeGeneratedObject = (id: string) => ({
  id,
  type: 'HumanMadeObject',
  identified_by: [
    {
      type: 'Name',
      content: `Artwork ${id}`,
      language: [{ id: AAT.english }],
      classified_as: [{ id: AAT.preferredTerm }],
    },
  ],
  produced_by: {
    carried_out_by: [
      {
        id: `${ENTITY_URL_PREFIX}1`,
        notation: [{ '@language': 'en', '@value': 'Test Artist' }],
      },
    ],
  },
});
