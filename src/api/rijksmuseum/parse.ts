// Linked Art JSON-LD from a third party: read every field defensively and never throw.
import { AAT, THUMBNAIL_WIDTH } from './constants';
import type { Language } from './types';

type JsonRecord = Record<string, unknown>;
type Name = { content: string; languages: string[]; classes: string[] };

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

export function pickPreferredName(
  entity: unknown,
  language: Language
): string | null {
  const names = readNames(entity);
  const isPreferred = (name: Name) => name.classes.includes(AAT.preferredTerm);
  const inLanguage = names.filter((name) =>
    name.languages.includes(AAT.language[language])
  );

  return (
    inLanguage.find(isPreferred)?.content ??
    inLanguage[0]?.content ??
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

export function pickArtistIds(object: unknown): string[] {
  const production = asRecord(asRecord(object).produced_by);
  const partArtistIds = asArray(production.part).flatMap((part) =>
    readRefIds(asRecord(part).carried_out_by)
  );
  return [
    ...new Set([...readRefIds(production.carried_out_by), ...partArtistIds]),
  ];
}

export const pickVisualItemIds = (object: unknown) =>
  readRefIds(asRecord(object).shows);

export const pickDigitalObjectIds = (visualItem: unknown) =>
  readRefIds(asRecord(visualItem).digitally_shown_by);

export const pickImageUrl = (digitalObject: unknown): string | null =>
  readRefIds(asRecord(digitalObject).access_point)[0] ?? null;

export const toThumbnailUrl = (imageUrl: string) =>
  imageUrl.replace(IIIF_FULL_SIZE, `/full/${THUMBNAIL_WIDTH},/`);
