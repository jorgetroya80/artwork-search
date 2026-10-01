import type { SearchPage } from './types';

const loadedIds = (pages: SearchPage[]) => pages.flatMap((page) => page.ids);

/** First `visibleCount` IDs across the loaded API pages, in API order. */
export const getVisibleIds = (pages: SearchPage[], visibleCount: number) =>
  loadedIds(pages).slice(0, visibleCount);

/** True when fewer than `visibleCount` IDs are loaded and the last page has a token. */
export function needsNextApiPage(pages: SearchPage[], visibleCount: number) {
  const hasNextPage = Boolean(pages.at(-1)?.nextPageToken);
  return hasNextPage && loadedIds(pages).length < visibleCount;
}
