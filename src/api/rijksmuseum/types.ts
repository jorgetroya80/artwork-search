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

/** What `useArtworkSearch` returns: the contract between the API layer and the UI. */
export type ArtworkSearch = {
  status: SearchStatus;
  /** Every loaded batch, in API order. */
  artworks: ArtworkResult[];
  /** `null` while idle or before the first response. */
  total: number | null;
  /** True only when the search succeeded with 0 results. */
  isEmpty: boolean;
  /** Set when the first search request failed (`status: 'error'`). */
  error: RijksApiError | null;
  /** Repeats the failed first search request. */
  retry: () => void;
  hasMore: boolean;
  /** Shows `PAGE_SIZE` more artworks; after `loadMoreError` it retries. */
  loadMore: () => void;
  isLoadingMore: boolean;
  loadMoreError: RijksApiError | null;
};
