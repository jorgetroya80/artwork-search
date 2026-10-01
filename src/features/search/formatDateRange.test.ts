import { describe, expect, it } from 'vitest';

import { formatDateRange } from './formatDateRange';

describe('formatDateRange', () => {
  it('shows one year when start and end share it', () => {
    expect(formatDateRange({ start: '1642-01-01', end: '1642-12-31' })).toBe(
      '1642'
    );
  });

  it('shows a range when the years differ', () => {
    expect(formatDateRange({ start: '1640-01-01', end: '1642-12-31' })).toBe(
      '1640–1642'
    );
  });

  it('shows the start year when there is no end', () => {
    expect(formatDateRange({ start: '1642-01-01', end: null })).toBe('1642');
  });

  it('shows the end year when there is no start', () => {
    expect(formatDateRange({ start: null, end: '1642-12-31' })).toBe('1642');
  });

  it('returns null without dates', () => {
    expect(formatDateRange({ start: null, end: null })).toBeNull();
  });
});
