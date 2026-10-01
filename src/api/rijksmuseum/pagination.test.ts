import { describe, expect, it } from 'vitest';

import { getVisibleIds, needsNextApiPage } from './pagination';
import type { SearchPage } from './types';

const TOTAL = 1423;

const makePage = (pageIndex: number, total = TOTAL): SearchPage => {
  const start = pageIndex * 100;
  const count = Math.max(Math.min(100, total - start), 0);
  return {
    total,
    ids: Array.from({ length: count }, (_, offset) => `id-${start + offset}`),
    nextPageToken: start + count < total ? `token-${pageIndex + 1}` : null,
  };
};

const makePages = (pageCount: number, total = TOTAL) =>
  Array.from({ length: pageCount }, (_, pageIndex) =>
    makePage(pageIndex, total)
  );

describe('getVisibleIds', () => {
  it('gives the first 10 IDs', () => {
    expect(getVisibleIds(makePages(1), 10)).toEqual(
      Array.from({ length: 10 }, (_, index) => `id-${index}`)
    );
  });

  it('gives the whole first page at 100 visible', () => {
    expect(getVisibleIds(makePages(1), 100)).toHaveLength(100);
  });

  it('continues across 2 pages at 110 visible', () => {
    const ids = getVisibleIds(makePages(2), 110);

    expect(ids).toHaveLength(110);
    expect(ids.at(-1)).toBe('id-109');
  });

  it('gives only the loaded IDs while the next page is missing', () => {
    expect(getVisibleIds(makePages(1), 110)).toHaveLength(100);
  });

  it('gives a last partial batch of 3', () => {
    const ids = getVisibleIds(makePages(15), 1430);

    expect(ids).toHaveLength(TOTAL);
    expect(ids.slice(1420)).toEqual(['id-1420', 'id-1421', 'id-1422']);
  });

  it('gives no IDs for zero results', () => {
    expect(getVisibleIds(makePages(1, 0), 10)).toEqual([]);
  });
});

describe('needsNextApiPage', () => {
  it.each([
    [10, false],
    [100, false],
    [110, true],
  ])('with one page and a token, at %i visible gives %s', (visible, needs) => {
    expect(needsNextApiPage(makePages(1), visible)).toBe(needs);
  });

  it('is false once the next page is loaded', () => {
    expect(needsNextApiPage(makePages(2), 110)).toBe(false);
  });

  it('is false on the last page, which has no token', () => {
    expect(needsNextApiPage(makePages(15), 1430)).toBe(false);
  });

  it('is false for zero results and before the first page', () => {
    expect(needsNextApiPage(makePages(1, 0), 10)).toBe(false);
    expect(needsNextApiPage([], 10)).toBe(false);
  });
});
