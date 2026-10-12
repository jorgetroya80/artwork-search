import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, type Plugin, type Rolldown } from 'vite';

type OutputBundle = Rolldown.OutputBundle;

export const DEFAULT_THEME = 'modern';

/** Latin font files to preload for a theme, as paths relative to the project root. */
export const THEME_FONT_PRELOADS: Record<string, string[]> = {
  modern: [
    'src/assets/fonts/archivo/archivo-normal-400-800-latin.woff2',
    'src/assets/fonts/ibm-plex-mono/ibm-plex-mono-normal-400-latin.woff2'
  ]
};

export function preloadTags(
  files: string[],
  resolveUrl: (file: string) => string
): string {
  return files
    .map(
      (file) =>
        `<link rel="preload" as="font" type="font/woff2" crossorigin href="${resolveUrl(file)}">`
    )
    .join('');
}

/**
 * Finds the hashed URL of a font file already emitted into the bundle.
 * `file` is a path relative to the project root, matching `OutputAsset.originalFileNames`.
 */
export function resolveBundledFontUrl(
  file: string,
  bundle: OutputBundle
): string {
  for (const asset of Object.values(bundle)) {
    if (asset.type === 'asset' && asset.originalFileNames.includes(file)) {
      return `/${asset.fileName}`;
    }
  }
  throw new Error(`Font file not found in the bundle: ${file}`);
}

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
  let root = process.cwd();

  return {
    name: 'theme',
    configResolved(config) {
      root = config.root;
      const env = loadEnv(config.mode, config.envDir, 'VITE_');
      theme = resolveTheme(
        env.VITE_THEME,
        listThemes(join(root, 'src/themes'))
      );
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const files = THEME_FONT_PRELOADS[theme] ?? [];
        const resolveUrl = (file: string) =>
          ctx.bundle ? resolveBundledFontUrl(file, ctx.bundle) : `/${file}`;

        return html
          .replace(/<html([^>]*)>/, `<html$1 data-theme="${theme}">`)
          .replace('</head>', `${preloadTags(files, resolveUrl)}</head>`);
      }
    }
  };
}
