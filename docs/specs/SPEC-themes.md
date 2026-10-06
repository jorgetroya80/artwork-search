# Spec: Themes

- Created: 2026-10-06
- Status: **implemented** 2026-10-06 (branch `feat/themes`). Approved 2026-10-06.
- Plan: [PLAN-themes.md](../plans/PLAN-themes.md)
- Related: [SPEC-artwork-search-ui.md](SPEC-artwork-search-ui.md) (semantic tokens in
  `src/index.css`), [SPEC-render-deploy.md](SPEC-render-deploy.md),
  [SPEC-docker-image.md](SPEC-docker-image.md)

## Objective

The app ships with several color themes. Configuration picks one: an environment variable at build
time names the theme, and the built app uses only that theme. A new theme is one CSS file.

User: the maintainer, who picks the theme for each deployment (Render, Docker image, local dev).
Visitors see one theme and cannot change it. Success:

- `VITE_THEME=theme-1 pnpm build` builds the app with the `theme-1` theme. With no `VITE_THEME`, the app
  uses the default theme `gallery`, which looks exactly like the app today.
- An unknown name (`VITE_THEME=nope`) fails the build and lists the valid names.
- The first paint already uses the chosen theme: no flash of another theme, no JavaScript involved.
- Adding a theme means adding one file under `src/themes/`. No component changes.

### Scope

`src/index.css`, new `src/themes/*.css`, `vite.config.ts`, `index.html`, the `Dockerfile` (build
argument), `render.yaml` (env var), README. No component changes: components already use only the
semantic tokens (`bg`, `bg-subtle`, `fg`, `fg-muted`, `border`, `accent`, `accent-fg`,
`rounded-control`). `public/404.html` keeps its own inline design (it is self-contained and is not
built by Vite).

### Assumptions

1. Components use no raw palette color (`stone-*`, `white`, …) and no `dark:` variant. Checked
   2026-10-06: every color class in `src/**/*.tsx` is a semantic token.
2. Tailwind v4 `@theme inline` makes each utility use the variable's value directly. So a theme
   cannot override `--color-bg` at runtime today. The tokens must point to plain CSS variables that
   each theme sets.
3. Vite exposes `VITE_*` variables at build time and lets a plugin rewrite `index.html`
   (`transformIndexHtml`). Render passes `envVars` to the build; Docker passes them with `ARG`.
4. Every theme's CSS ships in the bundle (all themes together are well under 1 kB gzipped), and the
   `data-theme` attribute on `<html>` selects one. This is simpler than bundling only the chosen
   file, and the cost is negligible.

## Design

### Tokens

`src/index.css` maps each Tailwind token to a theme variable:

```css
@import 'tailwindcss';
@import './themes/gallery.css';
@import './themes/theme-1.css';
@import './themes/theme-1-dark.css';

/* Semantic tokens: components use only these. Each theme in src/themes/ sets the variables. */
@theme inline {
  --color-bg: var(--theme-bg);
  --color-bg-subtle: var(--theme-bg-subtle);
  --color-fg: var(--theme-fg);
  --color-fg-muted: var(--theme-fg-muted);
  --color-border: var(--theme-border);
  --color-accent: var(--theme-accent);
  --color-accent-fg: var(--theme-accent-fg);
  --radius-control: var(--theme-radius-control);
}
```

### Theme files

One file per theme, `src/themes/<name>.css`. The file name is the theme name (lowercase,
kebab-case). Each file sets all eight variables and `color-scheme` under its own selector:

```css
[data-theme='gallery'] {
  color-scheme: light;
  --theme-bg: var(--color-white);
  --theme-bg-subtle: var(--color-stone-100);
  --theme-fg: var(--color-stone-900);
  --theme-fg-muted: var(--color-stone-600);
  --theme-border: var(--color-stone-300);
  --theme-accent: var(--color-stone-900);
  --theme-accent-fg: var(--color-white);
  --theme-radius-control: var(--radius-md);
}
```

`color-scheme` makes native parts (scrollbars, form controls, autofill) match light or dark themes.

Initial themes:

| Name                | Look                                                            |
| ------------------- | --------------------------------------------------------------- |
| `gallery` (default) | Today's values (above): white, stone, near-black accent. Light. |
| `theme-1`           | Light: off-white, warm gray, orange accent.                     |
| `theme-1-dark`      | Dark: near-black, white text, orange accent.                    |

### Theme 1

Colors and radius only, no fonts or shadows (maintainer's choice, 2026-10-06). Token values:

| Token            | `theme-1`                       | `theme-1-dark`                    |
| ---------------- | ------------------------------- | --------------------------------- |
| `bg`             | `oklch(0.997 0 0)`              | `oklch(0.2205 0.0036 345.5699)`   |
| `bg-subtle`      | `oklch(0.9702 0 0)`             | `oklch(0.2794 0.0034 345.4616)`   |
| `fg`             | `oklch(0.3285 0.0046 354.9853)` | `oklch(0.997 0 0)`                |
| `fg-muted`       | `oklch(0.5403 0.0029 345.2841)` | `oklch(0.696 0.0075 304.1897)`    |
| `border`         | `oklch(0.9219 0 0)`             | `oklch(0.4039 0.0031 345.345)`    |
| `accent`         | `oklch(0.56 0.1631 52.7157)` ¹  | `oklch(0.7297 0.1631 52.7157)`    |
| `accent-fg`      | `oklch(0.997 0 0)`              | `oklch(0.2205 0.0036 345.5699)` ² |
| `radius-control` | `0.75rem`                       | `0.75rem`                         |

¹ ² Contrast fix (maintainer's choice, 2026-10-06). The base orange (`oklch(0.7297 …)`) with white
text is 2.5:1, below WCAG AA (4.5:1 text, 3:1 focus outline on `bg`):

1. Light: same hue and chroma, lightness lowered to `0.56`. White on it is 4.9:1, and it is 4.9:1
   on `bg` as a focus outline.
2. Dark: the original orange, with the dark background as text color: 6.9:1. As a focus outline on
   `bg` it is 6.9:1.

Other pairs, computed: light `fg`/`bg` 12.2, `fg-muted`/`bg` 5.0, `fg-muted`/`bg-subtle` 4.6. Dark
`fg`/`bg` 17.2, `fg-muted`/`bg` 6.4, `fg-muted`/`bg-subtle` 5.4.

### Choosing the theme

A small Vite plugin in `vite.config.ts`:

1. Reads `VITE_THEME` (default `gallery`).
2. Lists `src/themes/*.css` to get the valid names.
3. Unknown name: throws, so `pnpm start`, `pnpm build` and `pnpm test` fail with
   `Unknown theme "nope". Valid themes: gallery, theme-1, theme-1-dark.`
4. `transformIndexHtml` sets `<html lang="en" data-theme="<name>">`.

The theme is in the HTML before any CSS or JS loads, so there is no flash.

### Deploy

- **Render:** `render.yaml` gets `envVars: - key: VITE_THEME, value: gallery`, and `config/**` joins
  `buildFilter.paths` because the build reads `config/theme.ts`. Changing the theme is
  a one-line change to that file (already in `buildFilter`, so it deploys).
- **Docker:** `Dockerfile` gets `ARG VITE_THEME=gallery` in the build stage.
  `docker build --build-arg VITE_THEME=theme-1 .` builds a Theme 1 image.
- **Local:** `VITE_THEME=theme-1-dark pnpm start`, or a git-ignored `.env.local`.

## Project Structure

```
src/index.css             → tokens point to --theme-* variables; imports every theme
src/themes/gallery.css    → default theme (today's look)
src/themes/theme-1.css       → Theme 1, light
src/themes/theme-1-dark.css  → Theme 1, dark
vite.config.ts            → theme plugin: validate VITE_THEME, set data-theme on <html>
Dockerfile                → ARG VITE_THEME
render.yaml               → envVars VITE_THEME; buildFilter config/**
README.md                 → "Themes" section: list, how to pick one, how to add one
```

## Tech Stack

Tailwind CSS 4.3 (`@theme inline`, CSS variables), Vite 8 plugin API. No new dependencies.

## Commands

```sh
VITE_THEME=theme-1-dark pnpm start
VITE_THEME=theme-1 pnpm build
docker build --build-arg VITE_THEME=theme-1 -t artwork-search .
pnpm lint && pnpm test && pnpm build
```

## Code Style

- Theme files: only the selector, `color-scheme` and the eight `--theme-*` variables. Values from
  the Tailwind palette (`var(--color-*)`) or `oklch()`.
- Comments only where the reason is not obvious, as in the rest of the project.

## Testing Strategy

1. **Unit (Vitest):** the plugin's name check: default when unset, accepts each file name, rejects an
   unknown name with the list of valid names.
2. **Theme completeness:** a test reads every `src/themes/*.css` and checks it sets all eight
   `--theme-*` variables and `color-scheme`, under `[data-theme='<file name>']`.
3. **Build:** `pnpm build` with each theme; `dist/index.html` has the matching `data-theme`.
   `VITE_THEME=nope pnpm build` fails.
4. **Default unchanged:** the `gallery` build looks the same as `main` (screenshots, desktop and
   phone width).
5. **Contrast (headless browser, each theme):** `fg`/`bg`, `fg-muted`/`bg`, `accent-fg`/`accent`
   and `fg`/`bg-subtle`, `fg-muted`/`bg-subtle` reach WCAG AA (4.5:1). Focus outline (`accent` on `bg`) reaches 3:1.
6. **Docker:** `--build-arg VITE_THEME=theme-1` image serves `data-theme="theme-1"`.

## Boundaries

- **Always:** components use only semantic tokens. Every theme sets every variable. Every theme
  passes the contrast check.
- **Ask first:** a theme switcher in the UI, a `?theme=` URL parameter, following the system
  light/dark preference, theming `public/404.html`, more tokens (fonts, shadows, spacing), changing
  the default theme.
- **Never:** raw palette colors or `dark:` in components. A runtime request to load a theme.

## Success Criteria

- [x] With no `VITE_THEME`, the app looks exactly as today.
- [x] `VITE_THEME=theme-1` and `VITE_THEME=theme-1-dark` builds show those themes from the first
      paint.
- [x] An unknown theme name fails the build with the list of valid names.
- [x] A new theme needs only a new file in `src/themes/` and its `@import`.
- [x] Render and Docker builds take the theme from configuration. (Docker checked locally; the live
      Render `data-theme` is checked after the merge.)
- [x] All themes pass the contrast check.
- [x] README explains how to pick and add a theme.

## Decisions

- **Configuration only, no UI switcher** (maintainer's choice, 2026-10-06). One theme per build.
  Cost: changing the theme needs a rebuild and redeploy (Render does this on push).
- **All themes bundled, chosen by `data-theme`** rather than bundling only one file. Simpler plugin
  and no CSS tricks; the extra bytes are negligible. It also leaves a UI switcher possible later
  without restructuring.
- **Own tokens, no theme library.** daisyUI adds component classes that clash with Base UI. Palettes
  from external tools are mapped into a theme file by hand.
- **Theme 1 as two themes** (`theme-1`, `theme-1-dark`), a light and a dark mode. The
  invented `night` and `heritage` themes of the first draft are dropped (maintainer, 2026-10-06).
- **Colors and radius only** (maintainer, 2026-10-06). No web fonts: no extra bytes or requests.
- **Light Theme 1 accent darkened** to pass WCAG AA (maintainer, 2026-10-06). See "Theme 1".
- **`@import` per theme written by hand** in `index.css` (maintainer, 2026-10-06). Simpler and
  explicit. Cost: adding a theme touches two files.

## Open Questions

None.
