// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_THEME,
  listThemes,
  preloadTags,
  resolveBundledFontUrl,
  resolveTheme,
  THEME_FONT_PRELOADS
} from './theme';

describe('resolveTheme', () => {
  const available = ['gallery', 'modern', 'theme-1', 'theme-1-dark'];

  it.each([undefined, ''])(
    'falls back to the default theme for %j',
    (requested) => {
      expect(resolveTheme(requested, available)).toBe(DEFAULT_THEME);
    }
  );

  it('defaults to modern', () => {
    expect(DEFAULT_THEME).toBe('modern');
  });

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

describe('THEME_FONT_PRELOADS', () => {
  it('lists modern latin files only, not latin-ext or weight 500', () => {
    expect(THEME_FONT_PRELOADS.modern).toEqual([
      'src/assets/fonts/archivo/archivo-normal-400-800-latin.woff2',
      'src/assets/fonts/ibm-plex-mono/ibm-plex-mono-normal-400-latin.woff2'
    ]);
  });

  it('has no entry for gallery', () => {
    expect(THEME_FONT_PRELOADS.gallery).toBeUndefined();
  });
});

describe('preloadTags', () => {
  it('builds one preload link per file with the resolved URL', () => {
    const html = preloadTags(
      ['a/one.woff2', 'b/two.woff2'],
      (file) => `/assets/${file.split('/').pop()}`
    );

    expect(html).toBe(
      '<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/one.woff2">' +
        '<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/two.woff2">'
    );
  });

  it('returns an empty string for no files', () => {
    expect(preloadTags([], () => '/unused')).toBe('');
  });
});

describe('resolveBundledFontUrl', () => {
  const bundle = {
    'assets/one-abc123.woff2': {
      type: 'asset',
      fileName: 'assets/one-abc123.woff2',
      originalFileNames: ['src/assets/fonts/one.woff2']
    },
    'index-xyz.js': { type: 'chunk', fileName: 'index-xyz.js' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  it('finds the hashed URL for a bundled font file', () => {
    expect(resolveBundledFontUrl('src/assets/fonts/one.woff2', bundle)).toBe(
      '/assets/one-abc123.woff2'
    );
  });

  it('throws, naming the missing path, when the file is not in the bundle', () => {
    expect(() =>
      resolveBundledFontUrl('src/assets/fonts/missing.woff2', bundle)
    ).toThrow('src/assets/fonts/missing.woff2');
  });
});

describe('theme files', () => {
  const srcDir = fileURLToPath(new URL('../src', import.meta.url));
  const themesDir = join(srcDir, 'themes');
  const indexCss = readFileSync(join(srcDir, 'index.css'), 'utf8');
  const variables = [...indexCss.matchAll(/var\((--theme-[a-z-]+)\)/g)].map(
    ([, name]) => name
  );

  it('finds the theme variables in index.css', () => {
    expect(variables).toHaveLength(11);
  });

  describe.each(listThemes(themesDir))('%s', (name) => {
    const css = readFileSync(join(themesDir, `${name}.css`), 'utf8');

    it('is scoped to its own data-theme', () => {
      expect(css.trimStart()).toMatch(
        new RegExp(String.raw`^\[data-theme='${name}'\]\s*\{`)
      );
    });

    it('sets color-scheme and every theme variable', () => {
      expect(css).toMatch(/color-scheme:\s*(light|dark);/);
      for (const variable of variables) {
        expect(css, variable).toContain(`${variable}:`);
      }
    });

    it('is imported by index.css', () => {
      expect(indexCss).toContain(`@import './themes/${name}.css';`);
    });
  });
});
