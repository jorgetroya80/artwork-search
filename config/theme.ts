import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, type Plugin } from 'vite';

export const DEFAULT_THEME = 'gallery';

export function listThemes(dir: string): string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.css'))
    .map((file) => file.slice(0, -'.css'.length))
    .sort();
}

export function resolveTheme(
  requested: string | undefined,
  available: string[]
): string {
  const theme = requested || DEFAULT_THEME;
  if (!available.includes(theme)) {
    throw new Error(
      `Unknown theme "${theme}". Valid themes: ${[...available].sort().join(', ')}.`
    );
  }
  return theme;
}

/** Picks the theme from VITE_THEME at build time and sets it on <html>, so the first paint uses it. */
export function themePlugin(): Plugin {
  let theme = DEFAULT_THEME;

  return {
    name: 'theme',
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir, 'VITE_');
      theme = resolveTheme(
        env.VITE_THEME,
        listThemes(join(config.root, 'src/themes'))
      );
    },
    transformIndexHtml(html) {
      return html.replace(/<html([^>]*)>/, `<html$1 data-theme="${theme}">`);
    },
  };
}
