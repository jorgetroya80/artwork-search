# Spec: Modern museum layout and theme

- Created: 2026-10-07
- Status: **approved** 2026-10-07 (design version `1791375557-07a6`)
- Plan: [PLAN-modern-museum.md](../plans/PLAN-modern-museum.md)
- Design: "Museo moderno" artboards in the
  [design canvas](https://claude.ai/artifact/Jo81oYMj5kBCKwr9iHJuPx): `ModernMain`, `ModernResults`
  (1440 px) and `ModernMainMobile`, `ModernResultsMobile` (390 px), version `1791375557-07a6`
- Related: [SPEC-themes.md](SPEC-themes.md) (theme files, `VITE_THEME`),
  [SPEC-artwork-search-ui.md](SPEC-artwork-search-ui.md) (search page behavior)

## Objective

Give the search page the look of a modern museum website: white walls, black type, a large
expanded grotesk, monospaced labels like gallery wall labels, and one small vermilion mark. The
work has two parts:

1. **Layout** (all themes): a new page structure with a header, a hero, a featured artwork, a
   results header and a footer. Components keep using only semantic tokens,
   so every theme renders the new layout in its own colors.
2. **Theme** `modern`: a new theme file with the design's colors, fonts and radius. It becomes the
   default theme.

User: a visitor on phone, tablet or desktop. Search behavior stays as in
SPEC-artwork-search-ui (search by artist, 10 results at a time, Load more, error and empty
states). The new parts are visual, plus one small feature: a featured artwork.

### Success

- With no `VITE_THEME`, the build uses `modern` and matches the desktop artboards at 1440 px and the
  mobile artboards at 390 px.
- `VITE_THEME=gallery`, `theme-1` and `theme-1-dark` still build and render the new layout in their
  own colors, with system fonts.
- Fonts load from the app's own origin. The page makes no request to Google Fonts or any other
  font CDN.
- The featured artwork (The Night Watch) shows its image, title, artist and date.

### Assumptions

1. **One layout for every theme** (maintainer, 2026-10-07). Themes change tokens only; no component
   checks the theme name. So `gallery` changes structure (header, hero, footer, uppercase buttons)
   but keeps its colors.
2. **`modern` is the new default** (maintainer, 2026-10-07). Render and Docker show it without
   configuration. This changes `DEFAULT_THEME`, `render.yaml` and the `Dockerfile` default.
3. **Light only.** No `modern-dark` (maintainer, 2026-10-07).
4. **Fonts are downloaded into the repository and bundled by Vite** from `src/assets/fonts/` (hashed
   file names, long cache), never loaded from a CDN (see "Fonts"). Browsers
   download a `@font-face` file only when some text uses that family, so themes that keep system
   fonts download no font files.
5. UI copy stays English, as today.
6. The featured artwork is fixed in code (The Night Watch, `200107928`). No rotation, no
   configuration.
7. The search term is still not in the URL. A reload starts from the idle state.

## Design

### Page states

The page has two states, driven by the existing `submittedTerm` in `SearchPage`:

| State                             | Shows                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| **Idle** (`submittedTerm === ''`) | Header, hero (title, search form), featured artwork, footer                                  |
| **Search** (a term was submitted) | Header, compact search form, results header, results grid / skeleton / empty / error, footer |

The `<h1>` "Search the collection." is always in the page. In the search state it is visually
hidden (`sr-only`), so the document outline stays valid.

### Layout, idle state (`ModernMain`, `ModernMainMobile`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ■ ARTWORK SEARCH                                                        │ header, 1px fg rule
├──────────────────────────────────────────────────────────────────────────┤
│ Search                                     ┌──────────────────────────┐  │
│ the collection.                            │                          │  │ <h1>
│                                            │   featured artwork       │  │
│ 01 — ARTIST NAME                          │   image                  │  │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━┓     │                          │  │ input + button share
│ ┃ Rembrandt van Rijn      ┃ SEARCH →┃     └──────────────────────────┘  │ one 2px fg border
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━┛  The Night Watch, Rembrandt… 1642│
│ Use the full name, e.g. "Rembrandt"                                      │
├──────────────────────────────────────────────────────────────────────────┤
│ Collection data and images: Rijksmuseum                   Artwork Search │ footer, fg background
└──────────────────────────────────────────────────────────────────────────┘
```

- The header holds only the wordmark: the ■ (a `mark` square, `aria-hidden`) and "Artwork Search".
  No tagline.
- Mobile/desktop switch: Tailwind `sm` (640 px). "Phone" below means under `sm`.

| Part           | Desktop (`ModernMain`)                                                  | Phone (`ModernMainMobile`)                              |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| Page padding   | `max-w-[1360px]`, 24 px sides, 64 px top                                | 16 px sides, 32 px top                                  |
| Header         | 18 px × 24 px padding, wordmark 18 px, square 14 px                     | 14 px × 16 px, wordmark 16 px, square 12 px             |
| `<h1>`         | `clamp(56px, 8.4vw, 132px)`, stretch 112%, line-height 0.9              | 44 px, stretch 100%, line-height 0.95                   |
| Hero           | Wrapping row: text + form `flex: 999 1 560px`, figure `flex: 1 1 380px` | Column: title, form, figure                             |
| Input + button | One row, 68 px tall, input 26 px text, button "SEARCH →"                | Stacked inside the same border, 56 px each, input 20 px |
| Labels / hints | Mono 13 px                                                              | Mono 12 px                                              |
| Featured image | Fills the figure, at least 440 px tall                                  | 280 px tall                                             |
| Footer         | One row, space between                                                  | Two stacked lines                                       |

### Layout, search state (`ModernResults`, `ModernResultsMobile`)

- **Compact form:** label "Artist name" (no step number), no hint, max width 760 px. Input and button
  share the 2px `fg` border.
- **Sticky search bar:** on desktop the header and the compact form stick to the top together, on a
  `bg` background, while results scroll under them. On phone only the compact form sticks (the header
  scrolls away); it gets a 1px `fg` bottom rule.
- **Results header:** the submitted term as `<h2>` (weight 800, stretch 100%, tracking -0.03em,
  `overflow-wrap: break-word`) and the existing `role="status"` text ("Showing 10 of 1,447 results")
  in mono uppercase, after a `mark` square. A 2px `fg` rule under it. While the first page loads,
  the `<h2>` shows the term and the status text is empty, as today.
- **Card:** no outer border. Image area 4:3 on `bg-subtle`. Under it a 1 px `fg` rule, then title
  (semibold, two-line clamp), artists (`fg-muted`), date (mono, `fg-muted`). Skeleton and error
  cards keep their behavior with the same shape.
- **Load more:** centered, 2px `fg` border, transparent background.
- Empty and error states: as today, centered under the results header.

| Part           | Desktop (`ModernResults`)                                                       | Phone (`ModernResultsMobile`)                                                   |
| -------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Compact form   | 56 px tall, input 22 px, button "SEARCH →"                                      | 52 px tall, input 18 px, icon-only button 56 px wide with `aria-label="Search"` |
| `<h2>`         | `clamp(36px, 4.2vw, 64px)`, line-height 1                                       | 32 px, line-height 1.05, `hyphens: auto`                                        |
| Results header | One wrapping row: `<h2>` `flex: 1 1 360px`, status on the right, bottom aligned | Column: `<h2>`, then status                                                     |
| Status square  | 10 px                                                                           | 8 px                                                                            |
| Grid           | `repeat(auto-fill, minmax(240px, 1fr))`, gap 56 px × 24 px                      | 2 columns, gap 32 px × 16 px                                                    |
| Card text      | Title 19 px, artists 15 px, date 13 px                                          | Title 16 px, artists 14 px, date 12 px                                          |
| Load more      | `width: max(33.333vw, 240px)`, max 100%, 64 px tall                             | 240 px wide, 56 px tall                                                         |

### Typography

| Role                                          | Font                          | Style                                                                     |
| --------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------- |
| Display (`h1`, `h2`)                          | `--font-sans` (Archivo)       | 800, tracking -0.03 to -0.035em; stretch and sizes per state tables above |
| Wordmark, buttons                             | `--font-sans`                 | 700–800, uppercase, `font-stretch: 112–125%`                              |
| Body, card title                              | `--font-sans`                 | 400 / 600, 17 px body                                                     |
| Labels, hints, numbers, dates, status, footer | `--font-mono` (IBM Plex Mono) | 400, 13 px, uppercase labels with 0.06em tracking                         |

`font-stretch` has no effect on fonts without a width axis (system fonts in other themes). That is
accepted.

### Icons

The arrow (→) in the Search button is an inline SVG (24 px viewBox,
`stroke="currentColor"`, 2 px, square caps), `aria-hidden`. No icon library.

### Featured artwork

- `FEATURED_ARTWORK_ID = '200107928'` (The Night Watch) in `src/features/search/featuredArtwork.ts`.
- `FeaturedArtwork` uses `useArtwork(FEATURED_ARTWORK_ID)`.
- Image: IIIF URL at 1200 px width (sharp at 2× on a ~500 px column). Add an exported helper in the
  API layer, `toImageUrl(imageUrl, width)`, next to the existing thumbnail helper; `toThumbnailUrl`
  calls it with `THUMBNAIL_WIDTH`.
- `<figure>`: image `object-cover` filling a box at least 440 px tall (desktop) or 280 px tall (phone),
  `alt` = artwork title. `<figcaption>` in mono: "Title, Artists" left, date right.
- Loading: the box on `bg-subtle` with `motion-safe:animate-pulse`, no caption.
- Error or no image: the box on `bg-subtle`, no caption, no alert, no retry. The featured artwork is
  decoration; a failure must not draw attention away from the search.
- Shown only in the idle state, so its request does not compete with search requests.

### Tokens

Two new kinds of token join the eight from SPEC-themes. Every theme must set all of them.

| Token (Tailwind) | Theme variable      | Use                                              |
| ---------------- | ------------------- | ------------------------------------------------ |
| `mark`           | `--theme-mark`      | Decorative squares (header, status). Never text. |
| `font-sans`      | `--theme-font-sans` | Display and body text                            |
| `font-mono`      | `--theme-font-mono` | Labels, hints, numbers, dates, footer            |

`src/index.css` adds to `@theme inline`:

```css
--color-mark: var(--theme-mark);
--font-sans: var(--theme-font-sans);
--font-mono: var(--theme-font-mono);
```

Values for existing themes: `mark` = their `accent`; `font-sans` = Tailwind's default sans stack;
`font-mono` = Tailwind's default mono stack. Their look changes only by layout.

### Theme `modern`

`src/themes/modern.css`:

| Token            | Value                                             | Design hex |
| ---------------- | ------------------------------------------------- | ---------- |
| `bg`             | `oklch(1 0 0)`                                    | `#FFFFFF`  |
| `bg-subtle`      | `oklch(0.9246 0.0055 95.1)`                       | `#E7E6E2`  |
| `fg`             | `oklch(0.1776 0 0)`                               | `#111111`  |
| `fg-muted`       | `oklch(0.4495 0 0)`                               | `#555555`  |
| `border`         | `oklch(0.1776 0 0)`                               | `#111111`  |
| `accent`         | `oklch(0.1776 0 0)`                               | `#111111`  |
| `accent-fg`      | `oklch(1 0 0)`                                    | `#FFFFFF`  |
| `mark`           | `oklch(0.5904 0.2135 30.25)`                      | `#E0301E`  |
| `radius-control` | `0`                                               |            |
| `font-sans`      | `'Archivo', ui-sans-serif, system-ui, sans-serif` |            |
| `font-mono`      | `'IBM Plex Mono', ui-monospace, monospace`        |            |

Contrast (computed): `fg`/`bg` 18.9, `fg-muted`/`bg` 7.5, `fg-muted`/`bg-subtle` 6.0,
`fg`/`bg-subtle` 15.1, `accent-fg`/`accent` 18.9. Focus outline (`accent` on `bg`) 18.9. `mark` on
`bg` is 4.6; it is decoration only.

### Fonts

The font files are downloaded once into the repository and served by the app itself
(self-hosted). The page never loads fonts from Google Fonts or any other CDN.

**Why self-hosted** (maintainer, 2026-10-07):

- **Privacy:** a Google Fonts request sends the visitor's IP address to Google. A German court
  (LG München, 2022) held that doing so without consent breaks the GDPR. Self-hosted fonts make no
  third-party request.
- **Speed:** no extra connections to `fonts.googleapis.com` and `fonts.gstatic.com`; fonts come over
  the same connection as the app. Browsers partition their cache by site, so a CDN font is not
  shared with other sites anyway. The exact URL is known, so it can be preloaded.
- **Reliability:** no dependency on Google's uptime, ad blockers, corporate firewalls or regions
  where Google is blocked. Works offline in development.
- **Control:** the font version is fixed in the repository; an upstream change cannot shift text
  metrics. Hashed file names under `/assets/` get the existing one-year `immutable` cache in nginx.

**Costs, accepted:**

- About 220 KB of woff2 files in the repository. A `modern` page downloads about 100 KB (the two
  preloaded latin files); the rest only when a character needs it.
- Updates are manual: re-download the files. Google would update them automatically.
- Only `latin` and `latin-ext` are included. Greek, Cyrillic or Vietnamese text falls back to the
  system font. Enough for European artist names.
- The SIL Open Font License 1.1 allows redistribution when the license travels with the files, so
  each family folder keeps its `OFL.txt`. The fonts are not modified ("Plex" is a Reserved Font
  Name) and not sold on their own.
- Our server (Render, nginx) serves the font bytes; once per visitor thanks to the cache.

**Documentation.** The project README only says that the app uses free fonts and names them
(Archivo and IBM Plex Mono, SIL Open Font License). No download instructions are documented.

**Files:**

- Files (already downloaded, SIL OFL 1.1, license next to each family):
  `src/assets/fonts/archivo/` (variable, weight 400–800, width 62–125%) and
  `src/assets/fonts/ibm-plex-mono/` (400, 500). Subsets `latin` and `latin-ext`, woff2 only.
- `src/assets/fonts/fonts.css` holds the `@font-face` rules, with `font-display: swap` and the
  `unicode-range` of each subset (copied from the Google Fonts CSS the files came from).
  `index.css` imports it. It does not live in `src/themes/`, because every CSS file there is read
  as a theme.
- **Fallback:** each font stack ends in the system fonts (`ui-sans-serif, system-ui, sans-serif`
  and `ui-monospace, monospace`). Until a file arrives, and if it fails, text shows in the system
  font (`font-display: swap`).
- **Preload** (maintainer, 2026-10-07): the theme plugin adds
  `<link rel="preload" as="font" type="font/woff2" crossorigin href="…">` to `<head>` for the
  fonts of the chosen theme, so they start downloading with the HTML and the swap happens before or
  close to the first paint.
  - Which files: `THEME_FONT_PRELOADS` in `config/theme.ts`, a map from theme name to font file
    paths. `modern` lists the `latin` files used above the fold: Archivo (variable) and IBM Plex
    Mono 400. `latin-ext` and Plex Mono 500 are not preloaded. Themes without an entry get no
    preload.
  - Build: `transformIndexHtml` runs after Vite bundles the CSS and finds each file's hashed URL in
    the bundle (`ctx.bundle`, asset whose original file name matches). A listed file missing from
    the bundle fails the build.
  - Dev: the link points to the source path (`/src/assets/fonts/...`), which the dev server
    serves.
  - If the hashed URL cannot be found from the plugin, fall back to `public/fonts/` with fixed
    URLs. Ask first, because it loses hashed file names.

### Components touched

| File                                                            | Change                                                                             |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/App.tsx`                                                   | Wraps `SearchPage` in the new `Layout` (header, footer)                            |
| `src/components/layout/Layout.tsx`                              | New: header, `<main>`, footer                                                      |
| `src/features/search/SearchPage.tsx`                            | Idle / search states, hero, sticky search bar                                      |
| `src/features/search/SearchForm.tsx`                            | Joined input + button, `compact` prop (label, hint, sizes, icon-only phone button) |
| `src/features/search/SearchResults.tsx`                         | Results header, grid sizes                                                         |
| `src/features/search/ArtworkCard.tsx`                           | New card look                                                                      |
| `src/features/search/FeaturedArtwork.tsx`, `featuredArtwork.ts` | New                                                                                |
| `src/components/ui/Button.tsx`                                  | Variant look (uppercase, weight); optional `icon` and `aria-label` for icon-only   |
| `src/components/ui/TextField.tsx`                               | Look only; keeps label, description and subgrid behavior                           |
| `src/api/rijksmuseum/parse.ts`, `index.ts`                      | `toImageUrl(imageUrl, width)`                                                      |
| `config/theme.ts`                                               | `DEFAULT_THEME = 'modern'`, `THEME_FONT_PRELOADS`, preload links                   |

## Project Structure

```
src/assets/fonts/archivo/            → Archivo woff2 (latin, latin-ext) + OFL.txt
src/assets/fonts/ibm-plex-mono/      → IBM Plex Mono woff2 (400, 500 × latin, latin-ext) + OFL.txt
src/assets/fonts/fonts.css           → @font-face rules
src/themes/modern.css                → new default theme
src/themes/*.css                     → existing themes gain --theme-mark, --theme-font-sans, --theme-font-mono
src/index.css                        → imports fonts.css and modern.css; new tokens
src/components/layout/Layout.tsx     → header + footer
src/features/search/                 → page states, FeaturedArtwork
config/theme.ts                      → DEFAULT_THEME = 'modern'; font preload links per theme
render.yaml, Dockerfile              → default VITE_THEME=modern
README.md                            → theme list, default, free fonts by name, new screenshot
```

## Tech Stack

React 19, Tailwind CSS 4.3, Base UI 1.8, TanStack Query 5, Vite 8. No new dependencies.

## Commands

```sh
pnpm start                                   # modern (default)
VITE_THEME=gallery pnpm start                # another theme, same layout
pnpm lint && pnpm test && pnpm build
pnpm test:coverage                           # 90% lines threshold
docker build -t artwork-search . && docker run --rm -p 8080:80 artwork-search
```

## Code Style

As in the rest of the project: container / presentational split, semantic tokens only, no manual
memoization (React Compiler), comments only where the reason is not obvious. Example of the target
style for a new presentational component:

```tsx
export function FeaturedArtwork() {
  const { data: artwork, status } = useArtwork(FEATURED_ARTWORK_ID);
  const imageUrl =
    artwork?.imageUrl && toImageUrl(artwork.imageUrl, FEATURED_IMAGE_WIDTH);

  return (
    <figure className="flex flex-col gap-3">
      {/* Decoration: on error it stays an empty box, with no alert */}
      <div className="h-70 bg-bg-subtle sm:min-h-110 sm:flex-1">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={artwork.title}
            className="size-full object-cover"
          />
        )}
      </div>
      {status === 'success' && <FeaturedCaption artwork={artwork} />}
    </figure>
  );
}
```

## Testing Strategy

1. **Theme completeness (existing test, extended):** every `src/themes/*.css` sets the eight old
   variables plus `--theme-mark`, `--theme-font-sans`, `--theme-font-mono`.
2. **Default theme:** `resolveTheme(undefined, …)` returns `modern`; build without `VITE_THEME`
   has `data-theme="modern"`.
3. **Preload (unit + build):** the plugin's HTML for `modern` has one preload link per listed file,
   with `as="font"`, `type="font/woff2"` and `crossorigin`; `gallery` has none. In `dist/index.html`
   each preload `href` is a file that exists in `dist/assets/` and is the same URL the CSS
   `@font-face` uses (otherwise the browser downloads it twice). A listed file that is not in the
   bundle fails the build.
4. **Unit:** `toImageUrl` (width replaces `full/max`; `null` in, `null` out);
   `toThumbnailUrl` unchanged.
5. **Components (Vitest + Testing Library + MSW, existing fixtures):**
   - Idle state shows the hero and the featured artwork (title from `object-200107928.json`); no
     results section content.
   - Submitting "Rembrandt" shows results; the featured artwork is gone; the `<h2>` shows the term.
   - Compact form: no hint; on phone the icon-only button has the accessible name "Search".
   - Featured artwork error (MSW 500): box shown, no `role="alert"`, search still works.
   - All existing `SearchPage`, `SearchResults`, `ArtworkCard`, `Button`, `TextField` tests pass,
     updated only where markup changed.
6. **Fonts:** build output has the woff2 files under `dist/assets/`; the built CSS references no
   external font URL.
7. **Manual, headless browser:** screenshots of idle and search states at 1440 px and 390 px for
   `modern`, compared with the four artboards; the sticky bar stays visible while scrolling results; one pair for `gallery` and `theme-1-dark` to check the
   layout works in other colors. Contrast check of every theme (as in SPEC-themes) still passes.

## Boundaries

- **Always:** semantic tokens only in components; every theme sets every variable; real
  `<button>` / `<input>` / `<label>`; touch targets ≥ 44 px; new tests for new behavior; work on
  branch `feat/modern-museum`.
- **Ask first:** a `modern-dark` theme; moving fonts to `public/`; theming `public/404.html`; putting the
  search term in the URL; a router or artwork detail page; making the featured artwork rotate or
  configurable; any new dependency.
- **Never:** load fonts from a CDN; check the theme name in a component; raw palette colors or
  `dark:` in components; commit font files without their license.

## Success Criteria

- [x] Default build is `modern` and matches the desktop artboards at 1440 px and the mobile
      artboards at 390 px, including the sticky search bar.
- [x] `gallery`, `theme-1`, `theme-1-dark` build and render the new layout; contrast check passes.
- [x] No request to an external font host; Archivo and IBM Plex Mono load from `dist/assets/`.
- [x] `modern` preloads its latin font files; no font is downloaded twice; other themes preload
      nothing.
- [x] Featured artwork shows The Night Watch with caption; on error it fails quietly.
- [x] Results header shows the term and the existing status text.
- [x] `pnpm lint && pnpm test && pnpm build` pass; coverage ≥ 90 % lines.
- [ ] README updated: default theme, free fonts by name, new screenshot. (Theme and fonts done;
      screenshot still the old placeholder — no browser available to capture a new one.)

## Decisions

- **"Museo moderno" chosen over "Museo clásico"** (maintainer, 2026-10-07).
- **One layout for all themes** (maintainer, 2026-10-07). Keeps "a theme is one CSS file".
- **`modern` is the default** (maintainer, 2026-10-07).
- **Light only** (maintainer, 2026-10-07).
- **In scope: featured artwork, results header** (maintainer, 2026-10-07). Out: `001…` numbering
  on result cards (confirmed 2026-10-07, also removed from the design).
- **Artist index removed** (maintainer, 2026-10-07), from the spec and from the design.
- **Design revised by the maintainer** (2026-10-07, canvas version `1791375557-07a6`): header
  tagline removed, sticky search bar, smaller results `<h2>`, centered Load more, mobile artboards
  added; `001…` numbering removed from the result cards. This spec follows that version.
- **Classic fonts removed** (Cormorant Garamond, EB Garamond); only Archivo and IBM Plex Mono stay
  (maintainer, 2026-10-07).
- **Fonts are self-hosted, downloaded into the repository** (maintainer, 2026-10-07): privacy,
  speed, reliability and control outweigh about 220 KB in the repository and manual updates. See
  "Fonts".
- **Fonts and a `mark` color become tokens.** SPEC-themes kept fonts out of themes to avoid extra
  bytes; with self-hosted files that load only when used, other themes still download no fonts.
- **Preload fonts, system font as fallback** (maintainer, 2026-10-07).

## Open Questions

None.
