import type { SearchPage } from './types';

const loadedIds = (pages: SearchPage[]) => pages.flatMap((page) => page.ids);

/** First `visibleCount` IDs across the loaded API pages, in API order. */
export const getVisibleIds = (pages: SearchPage[], visibleCount: number) =>
  loadedIds(pages).slice(0, visibleCount);

const hasNextApiPage = (pages: SearchPage[]) =>
  Boolean(pages.at(-1)?.nextPageToken);

/** True when fewer than `visibleCount` IDs are loaded and the last page has a token. */
export const needsNextApiPage = (pages: SearchPage[], visibleCount: number) =>
  hasNextApiPage(pages) && loadedIds(pages).length < visibleCount;

/**
 * True while loaded IDs are hidden or another API page exists. Based on what the API really
 * returns, not on `total`, which can promise more results than the pages hold.
 */
export const hasMoreResults = (pages: SearchPage[], visibleCount: number) =>
  visibleCount < loadedIds(pages).length || hasNextApiPage(pages);
