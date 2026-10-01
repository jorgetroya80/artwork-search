import { describe, expect, it } from 'vitest';

import { normalizeSearchInput } from './normalize';

describe('normalizeSearchInput', () => {
  it.each([
    [{}],
    [{ creator: null, title: null }],
    [{ creator: undefined, title: undefined }],
    [{ creator: '', title: '' }],
    [{ creator: '  ', title: null }],
    [{ creator: '\t\n', title: '   ' }],
  ])('returns null when both fields are blank: %o', (input) => {
    expect(normalizeSearchInput(input)).toBeNull();
  });

  it('trims and collapses inner whitespace', () => {
    expect(
      normalizeSearchInput({ creator: '  Rembrandt   van  Rijn ' })
    ).toEqual({ creator: 'Rembrandt van Rijn' });
  });

  it('keeps one field and removes the blank one', () => {
    expect(
      normalizeSearchInput({ creator: '   ', title: ' Nachtwacht ' })
    ).toEqual({ title: 'Nachtwacht' });
  });

  it('keeps both fields when both have text', () => {
    expect(
      normalizeSearchInput({ creator: 'Rembrandt', title: 'Nachtwacht' })
    ).toEqual({ creator: 'Rembrandt', title: 'Nachtwacht' });
  });

  it('does not change case or add wildcards', () => {
    expect(normalizeSearchInput({ title: 'nachtW*' })).toEqual({
      title: 'nachtW*',
    });
  });
});
