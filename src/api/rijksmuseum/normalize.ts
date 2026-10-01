import type { SearchInput, SearchParams } from './types';

const normalizeField = (value: string | null | undefined) =>
  value?.trim().replace(/\s+/g, ' ') || undefined;

export function normalizeSearchInput(input: SearchInput): SearchParams | null {
  const creator = normalizeField(input.creator);
  const title = normalizeField(input.title);
  if (!creator && !title) return null;

  return {
    ...(creator && { creator }),
    ...(title && { title }),
  };
}
