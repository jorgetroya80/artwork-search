import { describe, expect, it } from 'vitest';

import { makeSearchPage, pageTokenFor } from './factories';

describe('makeSearchPage', () => {
  it('returns a full first page with a next link', () => {
    const page = makeSearchPage({ total: 1423, pageIndex: 0 });

    expect(page.partOf.totalItems).toBe(1423);
    expect(page.orderedItems).toHaveLength(100);
    expect(page.next?.id).toContain(`pageToken=${pageTokenFor(1)}`);
  });

  it('returns the remaining items on the last page without a next link', () => {
    const page = makeSearchPage({ total: 1423, pageIndex: 14 });

    expect(page.orderedItems).toHaveLength(23);
    expect(page.next).toBeUndefined();
  });

  it('gives each result a unique id across pages', () => {
    const first = makeSearchPage({ total: 200, pageIndex: 0 });
    const second = makeSearchPage({ total: 200, pageIndex: 1 });
    const ids = [...first.orderedItems, ...second.orderedItems].map(
      (item) => item.id
    );

    expect(new Set(ids).size).toBe(200);
    expect(ids[0]).toMatch(/^https:\/\/id\.rijksmuseum\.nl\/\d+$/);
  });

  it('returns an empty page for zero results', () => {
    const page = makeSearchPage({ total: 0, pageIndex: 0 });

    expect(page.orderedItems).toEqual([]);
    expect(page.next).toBeUndefined();
  });
});
