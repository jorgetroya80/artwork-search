// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_THEME, listThemes, resolveTheme } from './theme';

describe('resolveTheme', () => {
  const available = ['gallery', 'theme-1', 'theme-1-dark'];

  it.each([undefined, ''])(
    'falls back to the default theme for %j',
    (requested) => {
      expect(resolveTheme(requested, available)).toBe(DEFAULT_THEME);
    }
  );

  it.each(available)('accepts %s', (name) => {
    expect(resolveTheme(name, available)).toBe(name);
  });

  it('rejects an unknown theme and lists the valid ones, sorted', () => {
    expect(() => resolveTheme('nope', ['theme-1', 'gallery'])).toThrow(
      'Unknown theme "nope". Valid themes: gallery, theme-1.'
    );
  });
});

describe('listThemes', () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns the CSS file names without extension, sorted', () => {
    dir = mkdtempSync(join(tmpdir(), 'themes-'));
    for (const file of ['theme-1.css', 'gallery.css', 'notes.md']) {
      writeFileSync(join(dir, file), '');
    }

    expect(listThemes(dir)).toEqual(['gallery', 'theme-1']);
  });
});
