import { describe, expect, it } from 'vitest';

import * as rijksmuseum from './index';

describe('public API', () => {
  it('exports only the runtime values of the spec interface', () => {
    expect(Object.keys(rijksmuseum).sort()).toEqual([
      'PAGE_SIZE',
      'RijksApiError',
      'createQueryClient',
      'fetchArtwork',
      'getVisibleIds',
      'needsNextApiPage',
      'normalizeSearchInput',
      'searchCollection',
      'useArtwork',
      'useArtworkSearch',
    ]);
  });
});
