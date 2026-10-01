// Linked Art JSON-LD from a third party: read every field defensively and never throw.
import { AAT, THUMBNAIL_WIDTH } from './constants';

type JsonRecord = Record<string, unknown>;
type Name = { content: string; languages: string[]; classes: string[] };
export type ArtistRef = { id: string; name: string | null };

const IIIF_FULL_SIZE = '/full/max/';

const asRecord = (value: unknown): JsonRecord =>
  typeof value === 'object' && value !== null ? (value as JsonRecord) : {};

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const asString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const readRefIds = (refs: unknown): string[] =>
  asArray(refs).flatMap((ref) => asString(asRecord(ref).id) ?? []);

const readIdentifiers = (entity: unknown, type: string) =>
  asArray(asRecord(entity).identified_by)
    .map(asRecord)
    .filter((item) => item.type === type && typeof item.content === 'string');

function readNames(entity: unknown): Name[] {
  return readIdentifiers(entity, 'Name').map((name) => ({
    content: name.content as string,
    languages: readRefIds(name.language),
    classes: readRefIds(name.classified_as),
  }));
}

export function pickPreferredName(entity: unknown): string | null {
  const names = readNames(entity);
  const isPreferred = (name: Name) => name.classes.includes(AAT.preferredTerm);
  const english = names.filter((name) => name.languages.includes(AAT.english));

  return (
    english.find(isPreferred)?.content ??
    english[0]?.content ??
    names.find(isPreferred)?.content ??
    names[0]?.content ??
    null
  );
}

export function pickObjectNumber(object: unknown): string | null {
  return asString(readIdentifiers(object, 'Identifier')[0]?.content);
}

export function pickDateRange(object: unknown) {
  const timespan = asRecord(asRecord(asRecord(object).produced_by).timespan);
  return {
    start: asString(timespan.begin_of_the_begin),
    end: asString(timespan.end_of_the_end),
  };
}

const readEnglishNotation = (notation: unknown): string | null =>
  asString(
    asArray(notation)
      .map(asRecord)
      .find((value) => value['@language'] === 'en')?.['@value']
  );

function readArtistRefs(refs: unknown): ArtistRef[] {
  return asArray(refs).flatMap((ref) => {
    const { id, notation } = asRecord(ref);
    if (typeof id !== 'string') return [];
    return [{ id, name: readEnglishNotation(notation) }];
  });
}

/** Artists with the English name from `notation`, or `name: null` when it is missing. */
export function pickArtists(object: unknown): ArtistRef[] {
  const production = asRecord(asRecord(object).produced_by);
  const artists = [
    ...readArtistRefs(production.carried_out_by),
    ...asArray(production.part).flatMap((part) =>
      readArtistRefs(asRecord(part).carried_out_by)
    ),
  ];
  return artists.filter(
    (artist, index) => artists.findIndex(({ id }) => id === artist.id) === index
  );
}

export const pickVisualItemIds = (object: unknown) =>
  readRefIds(asRecord(object).shows);

export const pickDigitalObjectIds = (visualItem: unknown) =>
  readRefIds(asRecord(visualItem).digitally_shown_by);

const isHttpsUrl = (url: string) => URL.parse(url)?.protocol === 'https:';

/** First https image URL. Any other scheme gives `null`, so the UI shows its placeholder. */
export const pickImageUrl = (digitalObject: unknown): string | null =>
  readRefIds(asRecord(digitalObject).access_point).find(isHttpsUrl) ?? null;

export const toThumbnailUrl = (imageUrl: string) =>
  imageUrl.replace(IIIF_FULL_SIZE, `/full/${THUMBNAIL_WIDTH},/`);
