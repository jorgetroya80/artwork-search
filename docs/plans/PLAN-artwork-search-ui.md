# Plan: Rijksmuseum artwork search — UI (phase 1)

- Created: 2026-10-01
- Status: **approved** (2026-10-01)
- Spec: [SPEC-artwork-search-ui.md](../specs/SPEC-artwork-search-ui.md)

The task list lives in this file. Check off tasks here as they are done.

## Overview

Build the phase 1 search page described in the spec: a responsive page with one artist field, a
Search button, a results grid of 10 artworks, "Load more", and the empty and error states. The
page uses `useArtworkSearch` from `src/api/rijksmuseum` and adds no data logic. Base UI primitives
sit behind app-owned wrappers in `src/components/ui/`. Colors and radius come from semantic tokens
in `src/index.css`. Each task ends with green `pnpm lint`, `pnpm test` and `pnpm build`.

## Dependency graph

```
T1 Base UI + tokens + ESLint import guard
        │
        ├──► T2 Button wrapper ──┐
        │                        │
        └──► T3 TextField wrapper┤
                                 ▼
T4 pure helpers ───────►  T5 search form slice (SearchPage, SearchForm, status line)
(getErrorMessage,                │
 formatDateRange)                ▼
                         T6 artwork cards (grid, skeletons, image fallback, item error)
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
          T7 empty + error states     T8 Load more
                    └────────────┬────────────┘
                                 ▼
                         T9 accessibility + responsive pass
                                 │
                                 ▼
                         T10 coverage gate + spec status
```

Can run in parallel: T2 with T3, T4 at any time, and T7 with T8.

## Architecture decisions

- **Wrappers first.** `Button` and `TextField` are built and tested before any feature code, so
  feature code never touches Base UI. The ESLint guard lands in T1, before the first Base UI
  import, so a direct import fails lint from day one.
- **One state owner.** `SearchPage` owns `draft` and `submittedTerm` and calls `useArtworkSearch`.
  `SearchForm` and `SearchResults` are presentational and get values and callbacks as props.
- **Submit guard in the handler.** `handleSubmit` returns early when `draft` is blank or
  `status === 'pending'`. It does not rely on the button state, so Enter in the input is safe
  whatever the wrapper does with `pending`.
- **Same term after an error calls `retry()`.** `handleSubmit` compares `draft.trim()` with
  `submittedTerm`. If they match and `status === 'error'`, it calls `retry()`; otherwise it sets
  `submittedTerm`.
- **Tests without jest-dom.** `@testing-library/jest-dom` is not installed and the spec adds no
  test dependencies. The accessible description is checked with
  `getByRole('searchbox', { name: 'Artist name', description: /full name/ })`. Disabled state and
  attributes are checked with plain `expect(...).toBe(...)` on DOM properties.
- **Test client.** `renderWithClient(ui)` in `src/test/render.tsx` reuses the
  `renderHookWithClient` setup (`createQueryClient()` + `retryDelay: 0`). Load more tests use the
  existing `generatedSearchHandlers(total)` from `src/test/msw/handlers.ts`.
- **Image error in jsdom.** jsdom does not load images. The `onError` path is tested with
  `fireEvent.error(img)`.
- **Skeleton count.** The pending grid renders `PAGE_SIZE` skeleton cards (imported from the API
  index), so it matches the first batch.

## Task list

### Phase 1: Foundation

- [x] **T1: Base UI, tokens, ESLint import guard**
  - `pnpm add @base-ui/react@1.8.0` (released 2026-09-04, old enough for the pnpm release-age
    policy).
  - `src/index.css`: keep `@import 'tailwindcss'`, add the `@theme inline` tokens from the spec and
    `body { @apply bg-bg text-fg; }`.
  - `eslint.config.js`: `no-restricted-imports` with pattern `@base-ui/*` for `src/**`, and an
    override that turns it off for `src/components/ui/**`. Message points to `src/components/ui`.
  - `vite.config.ts`: coverage `include` adds `src/features/search/**` and `src/components/**`.
  - Acceptance: a temporary `import { Button } from '@base-ui/react/button'` in `src/App.tsx`
    fails `pnpm lint`, and the same import in `src/components/ui/` passes. A temporary
    `className="bg-bg text-fg-muted rounded-control"` passes the `better-tailwindcss` rules (token
    classes are known). Remove both temporary changes.
  - Verify: `pnpm lint && pnpm test && pnpm build`.
  - Files: `package.json`, `pnpm-lock.yaml`, `src/index.css`, `eslint.config.js`,
    `vite.config.ts`.
  - Size: S.
  - Done: the existing `no-restricted-imports` paths moved to `restrictedImportPaths`, so the `src/components/ui/**` override keeps the `FC` ban and only drops the `@base-ui/*` pattern. Checked with temporary files: a Base UI import outside `src/components/ui/` fails lint, inside it passes; token classes (`bg-bg`, `text-fg-muted`, `rounded-control`, `outline-accent`) pass `no-unknown-classes`, an unknown class fails. `@theme inline` works, no fallback needed.

- [x] **T2: `Button` wrapper**
  - `src/components/ui/Button.tsx`: app-owned `ButtonProps` from the spec. Wraps Base UI `Button`.
    `pending` maps to `disabled` + `focusableWhenDisabled`. Variants `primary` / `secondary` with
    token classes, `min-h-11`, focus outline, `data-disabled:` styles.
  - `src/components/ui/index.ts`: barrel exporting `Button` and `ButtonProps`.
  - Tests (library-agnostic): default `type="button"`; `type="submit"` submits a form; `disabled`
    blocks `onClick` and is not focusable; `pending` blocks `onClick` and form submit, stays
    focusable, has `aria-disabled="true"`.
  - Acceptance: all tests pass. `ButtonProps` has no Base UI type.
  - Verify: `pnpm test Button && pnpm lint && pnpm build`.
  - Files: `src/components/ui/Button.tsx`, `src/components/ui/Button.test.tsx`,
    `src/components/ui/index.ts`.
  - Size: S.
  - Done: `pending` maps to Base UI `disabled` + `focusableWhenDisabled`: the button keeps focus, has `aria-disabled="true"`, and blocks both `onClick` and form submit. `src/test/setup.ts` now calls Testing Library `cleanup()` after each test, because Vitest globals are off and the first `render` tests left DOM behind. jsdom lets `.focus()` reach a natively disabled button, so the disabled test checks the `disabled` property instead.

- [x] **T3: `TextField` wrapper**
  - `src/components/ui/TextField.tsx`: app-owned `TextFieldProps` from the spec. Wraps
    `Field.Root`, `Field.Label`, `Field.Description` and `Input`. Token classes, focus outline.
  - Add `TextField` and `TextFieldProps` to the barrel.
  - Tests: input found by its label; accessible description equals `description`;
    `onValueChange` gets the typed value; `type="search"` gives role `searchbox`.
  - Acceptance: all tests pass. `TextFieldProps` has no Base UI type.
  - Verify: `pnpm test TextField && pnpm lint && pnpm build`.
  - Files: `src/components/ui/TextField.tsx`, `src/components/ui/TextField.test.tsx`,
    `src/components/ui/index.ts`.
  - Size: S.
  - Done: Base UI `Field` links label and description in jsdom, no `useId` fallback needed. `prettier.config.js` now sets `tailwindStylesheet: ./src/index.css`: without it the Prettier Tailwind plugin did not know the token classes and sorted them before the built-in ones. (Outside the spec file list, but tooling only.)

- [x] **T4: Pure helpers**
  - `getErrorMessage(error)`: `429` text, generic text for everything else.
  - `formatDateRange(date)`: `"1642"`, `"1640–1642"`, start only, `null` when both are `null`.
  - Tests: `429`, `500`, `400`, `network`, `timeout`, `parse` for the first; same year, range,
    start only, end only, both `null` for the second.
  - Verify: `pnpm test getErrorMessage formatDateRange && pnpm build`.
  - Files: `src/features/search/getErrorMessage.ts`, `getErrorMessage.test.ts`,
    `formatDateRange.ts`, `formatDateRange.test.ts`.
  - Size: XS.
  - Done: `formatDateRange` reads the year with a regex, so signed years before the common era (`-0500-…`) also work. End-only dates show the end year.

### Checkpoint 1: Foundation

- [ ] `pnpm lint`, `pnpm test` and `pnpm build` pass.
- [ ] `grep -rn "@base-ui" src` lists only `src/components/ui/`.
- [ ] Review with the user.

### Phase 2: Search and results

- [x] **T5: Search form slice**
  - `src/test/render.tsx`: add `renderWithClient`.
  - `SearchPage`: `<main>`, `<h1>` "Artwork search", state (`draft`, `submittedTerm`),
    `useArtworkSearch({ creator: submittedTerm })`, submit guard and same-term logic.
  - `SearchForm`: native `<form role="search">`, `TextField` with label and hint, `Button`
    `type="submit"` (`disabled` when blank, `pending` + "Searching…" while searching). Stacked
    below `sm`, one row from `sm`.
  - `SearchResults` (first version): always-rendered `aria-live="polite"` region; status line on
    success ("Showing X of Y results", singular, `en-US` numbers). No cards yet.
  - `App.tsx`: render `<SearchPage />`, drop the Vite template, keep the default export.
  - Tests on `SearchPage`: blank or whitespace input keeps Search disabled and sends no request;
    click and Enter each send one request with `creator` only; "Searching…" while pending, focus
    stays on the button, a second click or Enter sends no request; button enabled after the
    response; status line text for `creator=Rembrandt` fixture; same term after success sends no
    request.
  - Verify: `pnpm test SearchPage && pnpm lint && pnpm build`.
  - Files: `src/test/render.tsx`, `src/features/search/SearchPage.tsx`, `SearchForm.tsx`,
    `SearchResults.tsx`, `SearchPage.test.tsx`, `src/App.tsx`.
  - Size: M.
  - Done: `handleSubmit` normalizes the draft with `normalizeSearchInput` (not only `trim`), so "Rembrandt van Rijn" and "Rembrandt van Rijn" count as the same term for the retry-after-error rule. The live region is a `<p role="status">` (implicit `aria-live="polite"`). The Search button sits in a `flex-col` div: full width below `sm`, offset by the label height (`sm:mt-7`) from `sm`, so the `Button` wrapper needs no layout prop. Enter is tested with `fireEvent.submit`, because jsdom has no implicit submission on key events. `renderHookWithClient` and `renderWithClient` share one test client factory.

- [ ] **T6: Artwork cards**
  - `ArtworkImage`: `thumbnailUrl` in an `aspect-[4/3]` box, `object-cover`, `loading="lazy"`,
    `alt` = title. Placeholder "Image not available" for `null` or `onError`.
  - `ArtworkCard`: `<article>` per status. Pending skeleton (`bg-bg-subtle`,
    `motion-safe:animate-pulse`, `aria-busy`), error card with "Retry" (item `retry()`), success
    with title (`<h2>`, `line-clamp-2`, `title` attribute), artists, `formatDateRange`. Not
    clickable.
  - `SearchResults`: `<ul>` grid, 1 / 2 / 3 / 4 columns at `sm` / `lg` / `xl`, `max-w-6xl`;
    `PAGE_SIZE` skeleton cards while `status === 'pending'`, with `aria-busy` on the grid.
  - Tests: 10 cards on success with title, artists, date; skeletons while pending; one object
    `500` gives "This artwork could not be loaded." and "Retry" recovers it, other cards render;
    `thumbnailUrl: null` and `fireEvent.error(img)` show "Image not available".
  - Verify: `pnpm test ArtworkCard SearchPage && pnpm lint && pnpm build`.
  - Files: `ArtworkImage.tsx`, `ArtworkCard.tsx`, `ArtworkCard.test.tsx`, `SearchResults.tsx`,
    `SearchPage.test.tsx`.
  - Size: M.

### Checkpoint 2: Search works end to end

- [ ] `pnpm lint`, `pnpm test` and `pnpm build` pass.
- [ ] Manual: `pnpm start`, search "Rembrandt" against the real API, 10 cards with images appear.
- [ ] Review with the user.

### Phase 3: States and Load more

- [ ] **T7: Empty and error states**
  - `ErrorMessage`: `role="alert"`, text from `getErrorMessage`, `Button` "Try again".
  - `SearchResults`: empty message "No results found. Try another search term." in the live
    region; error block replaces the list; retry shows skeletons again.
  - Tests: empty fixture shows the empty message; `500` (after hook retries) and `400` show the
    generic text and "Try again" recovers; `429` shows the "service not available" text; same term
    submitted after an error retries; Search disabled during the retry.
  - Verify: `pnpm test SearchPage ErrorMessage && pnpm lint && pnpm build`.
  - Files: `ErrorMessage.tsx`, `SearchResults.tsx`, `SearchPage.tsx`, `SearchPage.test.tsx`.
  - Size: S.

- [ ] **T8: Load more**
  - `SearchResults`: `Button` "Load more" while `hasMore`; `pending` + "Loading…" while
    `isLoadingMore`; inline `role="alert"` message from `getErrorMessage` on `loadMoreError`,
    button stays enabled and retries.
  - Tests (with `generatedSearchHandlers`): button visible when `hasMore`, a click adds 10 cards
    and keeps the first 10; hidden after the last batch (e.g. total 23: 10, 20, 23); a failed next
    page keeps the cards, shows the message, and a second click recovers; focus stays on the
    button while loading.
  - Verify: `pnpm test SearchPage && pnpm lint && pnpm build`.
  - Files: `SearchResults.tsx`, `SearchPage.test.tsx` (or `LoadMore.test.tsx`).
  - Size: S.

### Checkpoint 3: All states

- [ ] `pnpm lint`, `pnpm test` and `pnpm build` pass.
- [ ] Every result state from the spec table has a test.

### Phase 4: Polish and gate

- [ ] **T9: Accessibility and responsive pass**
  - Check against the spec "Accessibility" and "Styling" sections: one `<h1>`, `role="search"`,
    live region always rendered, `aria-busy`, focus outline on every control, keyboard-only flow
    (type, Enter, Tab to Load more / Retry).
  - Manual: no horizontal scroll at 320, 640, 1024, 1280, 1920 px; 1 / 2 / 3 / 4 columns.
  - Manual: change `--color-accent` in `src/index.css` and confirm every button restyles; revert.
  - `grep -rE -e '-(stone|white|black)(-[0-9]+)?\b|\[#' src/features src/components` finds
    nothing.
  - Acceptance: every item above holds. Fixes stay inside the spec's file list.
  - Verify: `pnpm lint && pnpm test && pnpm build`, plus the manual checks.
  - Files: only the components that need fixes.
  - Size: S.

- [ ] **T10: Coverage gate and spec status**
  - `pnpm test:coverage` ≥ 90% lines for `src/features/search/**` and `src/components/**`.
  - README: short "Search UI" note (run `pnpm start`, search by artist).
  - Spec: set status to "implemented" and check the success criteria. Plan: set status.
  - Verify: `pnpm lint && pnpm test:coverage && pnpm build`.
  - Files: `README.md`, `docs/specs/SPEC-artwork-search-ui.md`,
    `docs/plans/PLAN-artwork-search-ui.md`.
  - Size: XS.

### Checkpoint 4: Complete

- [ ] All spec success criteria are checked.
- [ ] `pnpm lint`, `pnpm test:coverage` and `pnpm build` pass.
- [ ] Review with the user, then open the PR from `feat-initial-ui`.

## Risks and mitigations

| Risk                                                                            | Impact                                  | Mitigation                                                                                                                         |
| ------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `better-tailwindcss` does not know the `@theme inline` token classes            | Medium: lint fails on every token class | Checked first in T1 with a temporary class. Fallback: plain `@theme` with the same values (no `inline`)                            |
| Base UI `focusableWhenDisabled` does not block implicit submit (Enter) in jsdom | Medium: double search                   | Submit guard in `handleSubmit` (architecture decision). T2 test documents the wrapper behavior; T5 test covers Enter while pending |
| Base UI `Field` does not set `aria-describedby` on `Input` in jsdom             | Low: hint not announced                 | T3 test catches it. Fallback inside the wrapper: set `id` / `aria-describedby` by hand with `useId`                                |
| Hook retries (2 × backoff) slow error tests                                     | Medium                                  | `renderWithClient` uses `retryDelay: 0`, like the hook tests                                                                       |
| jsdom has no layout, so tests cannot see columns or overflow                    | Low                                     | Manual responsive check in T9                                                                                                      |
| Base UI ships a breaking change in a later version                              | Low: pinned exact                       | Only `src/components/ui/` depends on it; wrapper tests catch behavior changes on upgrade                                           |

## Open questions

None.
