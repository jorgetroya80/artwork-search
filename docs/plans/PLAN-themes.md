# Plan: Themes

- Created: 2026-10-06
- Status: **in progress**. T1–T4 done 2026-10-06.
- Spec: [SPEC-themes.md](../specs/SPEC-themes.md)

The task list lives in this file. Check off tasks here as they are done.

## Overview

Add build-time color themes as described in the spec:

- `src/index.css`: tokens point to `--theme-*` variables, and the file imports each theme by hand.
- `src/themes/gallery.css` (default, today's look), `theme-1.css`, `theme-1-dark.css`.
- A Vite plugin reads `VITE_THEME`, checks it against the files in `src/themes/`, and writes
  `data-theme` on `<html>`.
- `Dockerfile` build argument, `render.yaml` env var, README section "Themes".

No component changes. No new dependencies.

Spec, plan and implementation land in one PR from `feat/themes`, titled
`feat: add build-time color themes`.

## Dependency graph

```
T1 tokens + gallery.css (no visual change)
 │
 ├──► T2 theme plugin + unit tests ──┐
 │                                   ├──► Checkpoint 1: all themes build, look right, pass contrast
 └──► T3 completeness test ──► T4 theme-1 + theme-1-dark ──┘
                                                           │
                                                           ▼
                                  T5 Dockerfile + render.yaml ──► T6 README
                                                           │
                                                           ▼
                                          Checkpoint 2: review, open PR
```

T2 and T3 can run in parallel after T1.

## Architecture decisions

- **Plugin in its own module, `config/theme.ts`**, imported by `vite.config.ts`. It keeps the
  config short and lets Vitest import the pure parts (`resolveTheme`, `listThemes`) without
  loading Vite. `config/` is added to `tsconfig.node.json` `include`, so `tsc -b` type-checks it
  with Node types. (`/build` is git-ignored, so the folder is not named `build/`.)
- **Pure function for the name check.** `resolveTheme(requested, available)` returns the name or
  throws `Unknown theme "<name>". Valid themes: <sorted list>.` The plugin calls it in
  `configResolved`, so `pnpm start`, `pnpm build` and `pnpm test` all fail early on a bad name.
- **`transformIndexHtml`** adds `data-theme` to `<html>`. `index.html` is not edited by hand, so
  there is one source of truth.
- **`loadEnv` for `VITE_THEME`.** `process.env` alone misses `.env.local`. The plugin reads the
  variable through Vite's `loadEnv(mode, root, 'VITE_')`, so both shell variables and env files
  work.
- **No visual change first.** T1 only moves today's values into `gallery.css`, and screenshots
  against `main` prove it before any new theme lands.
- **Contrast is measured, not trusted.** The spec values were computed by hand. Checkpoint 1
  measures the rendered colors in headless Chrome, which also covers browser gamut mapping of the
  `theme-1` orange (`oklch(0.56 0.1631 52.7)` is just outside sRGB).

## Task list

### Phase 1: Mechanism

- [x] **T1: Tokens point to theme variables; `gallery.css`**
  - `src/index.css`: `@theme inline` maps each token to `var(--theme-*)`, as in the spec.
    `@import './themes/gallery.css'`.
  - `src/themes/gallery.css`: `[data-theme='gallery']` with `color-scheme: light` and today's
    eight values.
  - Until T2 lands, `index.html` gets `data-theme="gallery"` by hand so the app keeps its colors.
    T2 removes it.
  - Acceptance: the app looks the same as on `main`.
  - Verify: `pnpm lint && pnpm test && pnpm build`. Headless Chrome screenshots at 1280 and
    390 px wide, `main` and branch, compared.
  - Files: `src/index.css`, `src/themes/gallery.css`, `index.html`.
  - Size: XS.
  - Done: 2026-10-06. `pnpm lint`, `pnpm test` (169 tests) and `pnpm build` pass. Headless Chrome
    screenshots of the start page at 1280 and 390 px are pixel-identical to the `main` build. They
    cover `bg`, `fg`, `fg-muted`, `border`, `accent`, `accent-fg` and the radius; `bg-subtle` is
    only on loading skeletons and is not on that page. Mutation check: with
    `data-theme="x"` in `dist/index.html`, the colors, border radius and button background
    disappear, so the theme variables drive the tokens (plan risk 1 does not apply).

- [x] **T2: Theme plugin (test first)**
  - Tests in `config/theme.test.ts`: `resolveTheme` returns `gallery` when unset or empty,
    returns each available name, throws on an unknown name with the sorted valid list.
    `listThemes` returns the `.css` file names in `src/themes/` without extension.
  - `config/theme.ts`: `resolveTheme`, `listThemes`, `themePlugin()` (`configResolved` checks the
    name, `transformIndexHtml` sets `data-theme`). Wire it in `vite.config.ts`. Remove the
    hand-written `data-theme` from `index.html`.
  - `tsconfig.node.json`: add `config` to `include`.
  - Acceptance: the tests fail first, then pass. `pnpm build` writes
    `<html lang="en" data-theme="gallery">`. `VITE_THEME=nope pnpm build` fails with the list.
  - Verify: `pnpm test`, the two builds above, `grep data-theme dist/index.html`.
  - Files: `config/theme.ts`, `config/theme.test.ts`, `vite.config.ts`, `tsconfig.node.json`,
    `index.html`.
  - Size: S.
  - Done: 2026-10-06. Tests first: the suite failed (no module), then 7 tests pass. `pnpm lint`,
    `pnpm test` (176 tests), `tsc -b` and `pnpm build` pass; `dist/index.html` has
    `<html lang="en" data-theme="gallery">`. `VITE_THEME=nope` fails `pnpm build` and `pnpm test`
    (exit 1) with `Unknown theme "nope". Valid themes: gallery.` `VITE_THEME=nope` in
    `.env.local` fails the build the same way, so env files work. Changes from the plan: the
    plugin finds `src/themes` from Vite's `root` (`import.meta.url` is not a `file:` URL under
    jsdom), the test file runs in the `node` environment, and `vite.config.ts` imports
    `./config/theme.ts` with its extension (Vite warns otherwise about `configLoader: 'native'`).

- [x] **T3: Theme completeness test**
  - In `config/theme.test.ts`: for every file in `src/themes/`, the selector is
    `[data-theme='<file name>']`, it sets `color-scheme` and all eight `--theme-*` variables, and
    `src/index.css` imports it.
  - Acceptance: passes for `gallery.css`. Fails if a variable or the `@import` is removed
    (mutation check, then restored).
  - Verify: `pnpm test`.
  - Files: `config/theme.test.ts`.
  - Size: XS.
  - Done: 2026-10-06. The required variables are read from the `var(--theme-*)` calls in
    `src/index.css` (8 found, also asserted), so a new token needs every theme to set it. Per theme:
    selector, `color-scheme: light|dark`, every variable, `@import` in `index.css`. 11 tests in
    `config/`, 180 in total, `tsc -b` passes. Mutation checks on `gallery`: dropping
    `--theme-border`, dropping `color-scheme`, a wrong selector and dropping the `@import` each
    fail one test; files restored.

### Phase 2: Theme 1

- [x] **T4: `theme-1` and `theme-1-dark`**
  - Two files with the values from the spec table ("Theme 1"), `color-scheme: light` and `dark`.
    Two `@import` lines in `src/index.css`.
  - Acceptance: T3 passes for both. `VITE_THEME=theme-1` and `VITE_THEME=theme-1-dark` builds
    have the matching `data-theme`.
  - Verify: `pnpm test`, both builds, `grep data-theme dist/index.html`.
  - Files: `src/themes/theme-1.css`, `src/themes/theme-1-dark.css`, `src/index.css`.
  - Size: XS.
  - Done: 2026-10-06. Values from the spec table, with a comment on each contrast fix. `pnpm lint`,
    `pnpm test` (186 tests; T3 now covers three themes) and Prettier pass. Builds with
    `VITE_THEME=theme-1`, `theme-1-dark` and `gallery` write the matching `data-theme`; the built
    CSS has all three selectors. `VITE_THEME=nope` lists `gallery, theme-1, theme-1-dark`.

- [x] **Checkpoint 1: every theme works**
  - `pnpm lint && pnpm test && pnpm build` for each of the three themes.
  - Headless Chrome against `pnpm preview`, each theme, with a search showing results: screenshots
    at 1280 and 390 px; computed colors measured for the spec pairs (`fg`/`bg`, `fg-muted`/`bg`,
    `fg`/`bg-subtle`, `fg-muted`/`bg-subtle`, `accent-fg`/`accent` ≥ 4.5:1; `accent`/`bg` ≥ 3:1).
  - No flash: `dist/index.html` has the attribute before any script runs.
  - Screenshots reviewed with the user before Phase 3.
  - Measured 2026-10-06 (headless Chrome over the DevTools protocol, each theme built to its own
    folder, search "Rembrandt" against the real API, 10 cards, Search button focused). Contrast
    from the rendered sRGB values (canvas, so the `theme-1` orange is clipped to `rgb(187 81 0)`):

    | Pair                   | `gallery` | `theme-1` | `theme-1-dark` | Minimum |
    | ---------------------- | --------- | --------- | -------------- | ------- |
    | `fg`/`bg`              | 17.49     | 12.21     | 17.17          | 4.5     |
    | `fg-muted`/`bg`        | 7.64      | 5.02      | 6.37           | 4.5     |
    | `fg`/`bg-subtle`       | 16.03     | 11.30     | 14.52          | 4.5     |
    | `fg-muted`/`bg-subtle` | 7.00      | 4.64      | 5.39           | 4.5     |
    | `accent-fg`/`accent`   | 17.49     | 4.85      | 6.88           | 4.5     |
    | `accent`/`bg` (focus)  | 17.49     | 4.85      | 6.88           | 3       |

    All pass. Screenshots at 1280 and 390 px: no layout change between themes, focus ring visible
    in all three. Approved by the user 2026-10-06.

### Phase 3: Deploy and docs

- [ ] **T5: Docker and Render configuration**
  - `Dockerfile` build stage: `ARG VITE_THEME=gallery` before `RUN pnpm build`.
  - `render.yaml`: `envVars` gets `VITE_THEME: gallery`, with a comment that changing it changes
    the live theme.
  - Acceptance: `docker build --build-arg VITE_THEME=theme-1` image serves
    `data-theme="theme-1"`; a build without the argument serves `gallery`.
  - Verify: both `docker build` + `docker run` + `curl -s localhost:8080 | grep data-theme`.
    `pnpm exec prettier --check render.yaml`.
  - Files: `Dockerfile`, `render.yaml`.
  - Size: XS.

- [ ] **T6: README "Themes"**
  - The three themes, how to pick one (local, Docker, Render), how to add one (file, `@import`,
    contrast check).
  - Verify: `pnpm exec prettier --check README.md`.
  - Files: `README.md`.
  - Size: XS.

- [ ] **Checkpoint 2: review and PR**
  - `pnpm lint`, `pnpm test`, `pnpm build`, Prettier pass. Spec status and success criteria
    updated. Diff review.
  - PR `feat: add build-time color themes` with `## What` / `## Why`.

## Risks and mitigations

| Risk                                                                           | Impact                              | Mitigation                                                               |
| ------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------ |
| `@theme inline` with `var(--theme-*)` does not resolve per `data-theme`        | High: themes do nothing             | T1 screenshots and T4 builds show it early. Fallback: plain `@theme`     |
| `theme-1` orange is out of sRGB gamut; mapped color differs from the spec      | Low: contrast a bit off             | Checkpoint 1 measures rendered colors. Adjust lightness if below 4.5:1   |
| A plugin error stops `pnpm test` for unrelated work when `VITE_THEME` is wrong | Low                                 | Intended (spec). The error message lists the valid names                 |
| Render does not pass `envVars` to the build                                    | Medium: live site ignores the theme | Render docs say env vars are available at build. Check live `data-theme` |
| `config/` is not linted (`pnpm lint` covers `src/**` only)                     | Low                                 | `tsc -b` type-checks it. Extending lint is out of scope; ask if wanted   |
