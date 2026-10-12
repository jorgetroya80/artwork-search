# Plan: Modern museum layout and theme

- Created: 2026-10-07
- Status: **not started**
- Spec: [SPEC-modern-museum.md](../specs/SPEC-modern-museum.md) (approved 2026-10-07)

The task list lives in this file. Check off tasks here as they are done.

## Overview

Build the "Museo moderno" design as the spec describes:

- **Theme mechanism:** three new tokens (`mark`, `font-sans`, `font-mono`) in every theme,
  self-hosted fonts, a new `modern` theme as the default, and font preload links from the theme
  plugin.
- **Layout:** a shared header and footer, idle and search states with a sticky search bar, the
  featured artwork, the results header, and the new card, button and field look.
- **Deploy and docs:** Docker and Render defaults, README.

Spec, plan and implementation land in one PR from `feat/modern-museum`, titled
`feat: add modern museum layout and theme`.

## Dependency graph

```
Phase 1: theme mechanism
T1 new tokens in every theme
 ├──► T2 fonts.css (@font-face) ──► T4 font preload in theme plugin
 └──► T3 modern.css + DEFAULT_THEME ─┘
                                     ▼
                     Checkpoint 1: themes build, fonts self-hosted, preload correct

Phase 2: layout
T5 toImageUrl ─────────────────────────────────┐
T6 Layout (header, footer) ──┐                  │
T7 Button + TextField look ──┼──► T8 SearchForm ──► T9 SearchPage states + sticky bar
                             │                                   │
                             │                   T10 FeaturedArtwork ◄┘ (needs T5, T9)
                             └──► T11 SearchResults header + ArtworkCard
                                                  ▼
                     Checkpoint 2: four artboards matched, other themes, contrast, keyboard

Phase 3: deploy and docs
T12 Dockerfile + render.yaml defaults ──► T13 README ──► Checkpoint 3: review, PR
```

T2 and T3 can run in parallel after T1. T5, T6 and T7 are independent of each other. T11 needs only
T7.

## Architecture decisions

- **Fonts are downloaded into the repository, not loaded from Google Fonts** (spec "Fonts"). The
  woff2 files and their `OFL.txt` are already in `src/assets/fonts/` (downloaded 2026-10-07). T2
  adds the `@font-face` rules.
- **Tokens first, layout second.** Phase 1 changes no component. `gallery` keeps its look until
  Phase 2, so a token or font mistake shows up alone.
- **The completeness test already enforces new tokens.** It reads the required variables from the
  `var(--theme-*)` calls in `src/index.css` (PLAN-themes T3). Adding the three tokens to
  `index.css` makes every theme fail until it sets them, with no test change.
- **`--font-sans` and `--font-mono` override Tailwind's defaults.** Preflight uses `--font-sans`
  for `html`, so body text changes with the theme and components only need `font-mono` where the
  design uses mono.
- **`fonts.css` lives in `src/assets/fonts/`**, not `src/themes/`, because `listThemes` reads every
  CSS file in `src/themes/` as a theme.
- **Preload URLs come from the bundle.** The plugin's `transformIndexHtml` runs with
  `order: 'post'` and reads `ctx.bundle` to map each source font path to its hashed
  `/assets/…woff2` URL, the same URL the bundled CSS uses. In dev (`ctx.bundle` is undefined) it
  links the source path. A listed file not found in the bundle throws.
- **Sticky search bar without measuring the header.** In the search state, `Layout` puts the header
  and a `toolbar` slot (the compact form) in one wrapper: `contents sm:sticky sm:top-0`. On phone the
  wrapper is `display: contents`, so the header scrolls away and the form alone is
  `sticky top-0`; from `sm` the wrapper sticks as a whole and the form is `static`. No JavaScript,
  no hard-coded header height.
- **Icon-only button on phone keeps a visible-text name.** The compact form's button label is
  `sr-only` below `sm` instead of an `aria-label`, so the pending label "Searching…" is still
  announced. The accessible name is "Search", as the spec requires.
- **Featured artwork through the existing hook.** `useArtwork(FEATURED_ARTWORK_ID)` shares the
  query cache; no new data code except `toImageUrl`.

## Task list

### Phase 1: Theme mechanism

- [x] **T1: New tokens in every theme**
  - `src/index.css` `@theme inline`: `--color-mark`, `--font-sans`, `--font-mono` pointing to
    `--theme-mark`, `--theme-font-sans`, `--theme-font-mono`.
  - `gallery.css`, `theme-1.css`, `theme-1-dark.css`: `--theme-mark` = their accent value;
    `--theme-font-sans` / `--theme-font-mono` = Tailwind's default stacks written out
    (`ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', …` and
    `ui-monospace, SFMono-Regular, Menlo, …`), not `var(--font-sans)`, which would point back to
    the overridden token.
  - Acceptance: completeness test fails after the `index.css` change, passes once the three themes
    set the variables. App looks the same as on `main`.
  - Verify: `pnpm test`; `pnpm build`; headless Chrome screenshots at 1280 and 390 px, `main` vs
    branch, identical.
  - Files: `src/index.css`, `src/themes/gallery.css`, `src/themes/theme-1.css`,
    `src/themes/theme-1-dark.css`.
  - Size: XS.

- [x] **T2: Self-hosted font faces**
  - `src/assets/fonts/fonts.css`: `@font-face` for Archivo (variable, `font-weight: 400 800`,
    `font-stretch: 62% 125%`) and IBM Plex Mono 400, 500; `latin` and `latin-ext` each with the
    `unicode-range` from the Google Fonts CSS; `font-display: swap`; relative `url()`.
  - `src/index.css` imports it.
  - Acceptance: `pnpm build` emits the 6 woff2 files under `dist/assets/` with hashed names; the
    built CSS has no `fonts.googleapis.com` / `fonts.gstatic.com` URL. Themes that do not use the
    families download no font (checked in Checkpoint 1).
  - Verify: `pnpm build && ls dist/assets/*.woff2 && ! grep -r "fonts.g" dist/`.
  - Files: `src/assets/fonts/fonts.css`, `src/index.css`.
  - Size: XS.

- [x] **T3: `modern` theme and new default (test first)**
  - Test: `resolveTheme(undefined, …)` returns `modern`. Fails first.
  - `src/themes/modern.css` with the spec's values; `@import` in `index.css`.
  - `config/theme.ts`: `DEFAULT_THEME = 'modern'`.
  - Acceptance: completeness test covers `modern`; `pnpm build` writes `data-theme="modern"`;
    `VITE_THEME=gallery pnpm build` still works.
  - Verify: `pnpm test`, both builds, `grep data-theme dist/index.html`.
  - Files: `src/themes/modern.css`, `src/index.css`, `config/theme.ts`, `config/theme.test.ts`.
  - Size: S.

- [x] **T4: Font preload links (test first)**
  - `config/theme.ts`: `THEME_FONT_PRELOADS: Record<string, string[]>` (`modern`: Archivo latin,
    IBM Plex Mono 400 latin). A pure `preloadTags(files, resolveUrl)` builds the `<link>` tags; the
    plugin's `transformIndexHtml` (`order: 'post'`) resolves URLs from `ctx.bundle` in build and
    source paths in dev, and throws if a listed file is missing from the bundle.
  - Tests: tags have `rel="preload" as="font" type="font/woff2" crossorigin`; one per file;
    none for `gallery`; missing file throws with its path.
  - Acceptance: `dist/index.html` for `modern` has 2 preload links whose `href`s exist in
    `dist/assets/` and appear in the built CSS `@font-face`; `gallery` build has none.
  - Verify: `pnpm test`; `pnpm build`, then a grep script comparing preload `href`s with the CSS
    `url()`s; `VITE_THEME=gallery pnpm build` and grep shows no preload.
  - Files: `config/theme.ts`, `config/theme.test.ts`.
  - Size: S.

- [ ] **Checkpoint 1: theme mechanism**
  - `pnpm lint && pnpm test && pnpm build` pass for every theme.
  - Headless Chrome, `modern` build: network log shows the 2 preloaded fonts fetched once each, from
    the app origin, before first paint; no third-party font request. `gallery` build: no font
    request.
  - Contrast check of all four themes (as in PLAN-themes Checkpoint 1) passes.

### Phase 2: Layout

- [x] **T5: `toImageUrl` (test first)**
  - Tests: replaces `/full/max/` with `/full/<width>,/`; `toThumbnailUrl` output unchanged.
  - `parse.ts`: `toImageUrl(imageUrl, width)`; `toThumbnailUrl` calls it with `THUMBNAIL_WIDTH`.
    Export from `index.ts`.
  - Verify: `pnpm test`.
  - Files: `src/api/rijksmuseum/parse.ts`, `parse.test.ts`, `index.ts`.
  - Size: XS.

- [x] **T6: `Layout` with header and footer**
  - `src/components/layout/Layout.tsx`: header (mark square `aria-hidden`, wordmark "Artwork
    Search"), optional `toolbar` slot in the sticky wrapper, `<main>`, footer ("Collection data and
    images: Rijksmuseum" link to `https://data.rijksmuseum.nl`, "Artwork Search"). Sizes per the
    spec's desktop/phone tables. `App.tsx` wraps `SearchPage`; `SearchPage` drops its own `<main>`.
  - Tests: header text, footer link `href`, `main` landmark present once.
  - Verify: `pnpm test`, `pnpm lint`.
  - Files: `Layout.tsx`, `Layout.test.tsx`, `src/App.tsx`, `SearchPage.tsx`.
  - Size: S.

- [x] **T7: Button and TextField look**
  - `Button`: uppercase, bold, `font-stretch` 112%, 2px `fg` border on `secondary`; optional
    `icon` (rendered after the label, `aria-hidden`). Public API otherwise unchanged.
  - `TextField`: borderless input inside the parent's border (an `inputGroup`/`endSlot` prop so the
    form can put the button inside the same 2px frame, keeping the subgrid rows); mono uppercase
    label; mono hint.
  - Tests: existing tests pass; new: icon is not in the accessible name.
  - Verify: `pnpm test`.
  - Files: `Button.tsx`, `Button.test.tsx`, `TextField.tsx`, `TextField.test.tsx`.
  - Size: S.

- [x] **T8: `SearchForm` look and `compact` prop**
  - Idle: label "01 — Artist name", hint, 68 px row; phone: input and button stacked in the frame.
  - `compact`: label "Artist name", no hint, 56 px (52 px on phone), button label `sr-only` below
    `sm` with the arrow icon visible.
  - Tests (in `SearchPage.test.tsx`): compact form has no hint; the button's accessible name is
    "Search", and "Searching…" while pending.
  - Verify: `pnpm test`.
  - Files: `SearchForm.tsx`, `SearchPage.test.tsx`.
  - Size: S.

- [x] **T9: Page states and sticky bar**
  - `SearchPage`: idle state (hero with `<h1>`, idle form) vs search state (`<h1>` `sr-only`,
    compact form passed to `Layout` as `toolbar`). Focus behavior unchanged.
  - Tests: idle shows the visible heading and no results section content; after submit, heading
    is still in the document, form is compact, results appear.
  - Verify: `pnpm test`; headless Chrome at 1440 and 390 px: scroll results, the bar stays at the
    top (desktop: header + form; phone: form only).
  - Files: `SearchPage.tsx`, `SearchPage.test.tsx`, `Layout.tsx`.
  - Size: M.

- [x] **T10: `FeaturedArtwork` (test first)**
  - `featuredArtwork.ts`: `FEATURED_ARTWORK_ID = '200107928'`, `FEATURED_IMAGE_WIDTH = 1200`.
  - `FeaturedArtwork.tsx`: figure, image `object-cover`, caption "Title, Artists" / date (mono);
    pulse box while loading; empty box on error or no image, no alert. Mounted in the idle hero
    only.
  - Tests (MSW, `object-200107928.json`): caption shows "The Night Watch"; `img` `src` uses
    `/full/1200,/`; on a 500 response the box renders, no `role="alert"`, and the search still
    works; not rendered in the search state.
  - Verify: `pnpm test`.
  - Files: `featuredArtwork.ts`, `FeaturedArtwork.tsx`, `FeaturedArtwork.test.tsx`,
    `SearchPage.tsx`.
  - Size: S.

- [x] **T11: Results header, grid and cards**
  - `SearchResults`: header row with `<h2>` (submitted term, passed from `SearchPage`) and the
    existing `role="status"` text after a `mark` square; grid 2 columns on phone,
    `repeat(auto-fill, minmax(240px, 1fr))` from `sm`; Load more centered with the spec widths.
  - `ArtworkCard`: no outer border; 4:3 image on `bg-subtle`; 1px `fg` rule; title, artists, mono
    date; skeleton and error cards in the same shape. `ArtworkImage` unchanged except classes.
  - Tests: `<h2>` shows the term; status text unchanged; existing card tests pass.
  - Verify: `pnpm test`.
  - Files: `SearchResults.tsx`, `ArtworkCard.tsx`, `ArtworkImage.tsx`, `ArtworkCard.test.tsx`,
    `SearchPage.tsx`.
  - Size: M.

- [ ] **Checkpoint 2: design match**
  - `pnpm lint && pnpm test && pnpm test:coverage && pnpm build` pass (≥ 90% lines).
  - Headless Chrome screenshots, `modern`: idle and search states at 1440 px and 390 px, side by
    side with the four artboards. Differences listed and fixed or accepted by the maintainer.
  - `gallery` and `theme-1-dark`: idle and search at 1440 px; layout intact in their colors.
  - Keyboard: Tab order header → form → results → Load more; focus ring visible in every theme;
    touch targets ≥ 44 px.
  - Show the screenshots to the maintainer before Phase 3.

### Phase 3: Deploy and docs

- [x] **T12: Docker and Render defaults**
  - `Dockerfile`: `ARG VITE_THEME=modern`. `render.yaml`: `VITE_THEME: modern`.
  - Acceptance: default Docker image serves `data-theme="modern"` and the preload links; fonts
    are served from `/assets/` with the immutable cache header (existing nginx rule).
  - Verify: `docker build` + `docker run` + `curl -s localhost:8080 | grep -E "data-theme|preload"`
    and `curl -sI` on one font URL.
  - Files: `Dockerfile`, `render.yaml`.
  - Size: XS.

- [x] **T13: README**
  - Themes table with `modern` (default); one line saying the app uses free fonts, with their
    names (Archivo and IBM Plex Mono, SIL Open Font License); new screenshot in `docs/images/`.
  - Verify: `pnpm exec prettier --check README.md`.
  - Files: `README.md`, `docs/images/screenshot-app.png`.
  - Size: XS.

- [ ] **Checkpoint 3: review and PR**
  - `pnpm lint`, `pnpm test`, `pnpm build`, Prettier pass. Spec status and success criteria
    updated. Diff review.
  - PR `feat: add modern museum layout and theme` with `## What` / `## Why`.
  - After the merge: live site serves `data-theme="modern"` and the fonts from its own origin.

## Risks and mitigations

| Risk                                                                                  | Impact                                  | Mitigation                                                                                                              |
| ------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ctx.bundle` does not expose the original font path (Rolldown asset metadata differs) | Medium: preload cannot find hashed URLs | T4 tries `originalFileNames` first, then matching by file name stem. Else ask to use `public/fonts/` (spec "Ask first") |
| Preload `href` differs from the CSS URL (e.g. `base` or query)                        | Medium: font downloaded twice           | T4 build check compares both; Checkpoint 1 network log                                                                  |
| `display: contents` sticky trick misbehaves in a browser                              | Low: bar not sticky on phone            | T9 manual check in Chrome and Safari (iOS simulator if available); fallback: form sticky only                           |
| Layout swap from fallback to Archivo shifts the big title                             | Low: visible jump on slow networks      | Preload (T4). Optional `size-adjust` fallback face only if the shift is visible in Checkpoint 2                         |
| Night Watch is landscape; tall box crops it                                           | Low: cropped image                      | `object-cover` per spec; maintainer reviews in Checkpoint 2                                                             |
| Other themes look odd with uppercase stretched buttons and system fonts               | Low                                     | Accepted in the spec (one layout for all themes); Checkpoint 2 screenshots                                              |
