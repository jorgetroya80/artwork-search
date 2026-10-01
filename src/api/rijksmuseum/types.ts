import type { RijksApiError } from './errors';

export type SearchInput = {
  creator?: string | null;
  title?: string | null;
};

/** Normalized input: trimmed, inner whitespace collapsed, blank fields removed. */
export type SearchParams = {
  creator?: string;
  title?: string;
};

export type SearchPage = {
  total: number;
  ids: string[];
  nextPageToken: string | null;
};

export type Artwork = {
  id: string;
  objectNumber: string | null;
  title: string;
  artists: string[];
  date: { start: string | null; end: string | null };
  imageUrl: string | null;
  thumbnailUrl: string | null;
};

export type ArtworkResult =
  | { id: string; status: 'pending' }
  | { id: string; status: 'error'; error: RijksApiError; retry: () => void }
  | { id: string; status: 'success'; artwork: Artwork };

export type SearchStatus = 'idle' | 'pending' | 'error' | 'success';
