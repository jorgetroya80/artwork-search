// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

describe('theme files', () => {
  const srcDir = fileURLToPath(new URL('../src', import.meta.url));
  const themesDir = join(srcDir, 'themes');
  const indexCss = readFileSync(join(srcDir, 'index.css'), 'utf8');
  const variables = [...indexCss.matchAll(/var\((--theme-[a-z-]+)\)/g)].map(
    ([, name]) => name
  );

  it('finds the theme variables in index.css', () => {
    expect(variables).toHaveLength(8);
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
