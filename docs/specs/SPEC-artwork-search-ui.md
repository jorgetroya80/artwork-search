# Spec: Rijksmuseum artwork search — UI

- Created: 2026-10-01
- Status: **implemented** (2026-10-01)
- Plan: [PLAN-artwork-search-ui.md](../plans/PLAN-artwork-search-ui.md)
- Depends on: [SPEC-artwork-search-api.md](SPEC-artwork-search-api.md) (implemented)

## Objective

Give the user a responsive page to search the Rijksmuseum collection by **artist name** and browse
the results. The page consumes `useArtworkSearch` from `src/api/rijksmuseum` and adds no new data
logic.

User: a visitor on phone, tablet or desktop. Success: they type an artist name, press Search, and
see the first 10 artworks with image, title, artists and date. They can load 10 more while results
remain. Empty results and errors give a clear message instead of a blank page.

UI language: English only.

### Scope (phase 1)

This spec covers **search and results only**. The artwork detail page is a later phase (see
"Next phases"). In this phase cards are not clickable.

### Assumptions

1. Single page. No router in this phase, and the search term is not kept in the URL or in
   storage. A reload starts from the idle state.
2. Evergreen browsers only (latest Chrome, Firefox, Safari, Edge, iOS Safari, Android Chrome).
3. Light theme only, neutral look. Colors and radius come from semantic tokens (see "Styling"),
   so a later spec can change the theme or add dark mode without touching components.
4. React Compiler handles memoization. No manual `useMemo` / `useCallback` / `memo`.

## Page layout

```
┌──────────────────────────────────────────────┐
│ Artwork search                               │  <h1>
│ ┌──────────────────────────────┐ ┌────────┐  │
│ │ Artist name                  │ │ Search │  │  <form role="search">
│ └──────────────────────────────┘ └────────┘  │
│ Use the full name, e.g. "Rembrandt"          │  hint
│                                              │
│ Showing 10 of 1423 results                   │  status line (aria-live)
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐                  │
│ │img │ │img │ │img │ │img │                  │  result grid
│ │... │ │... │ │... │ │... │                  │
│ └────┘ └────┘ └────┘ └────┘                  │
│              ┌───────────┐                   │
│              │ Load more │                   │
│              └───────────┘                   │
└──────────────────────────────────────────────┘
```

### Responsive rules (Tailwind default breakpoints)

| Width             | Form                                      | Grid columns |
| ----------------- | ----------------------------------------- | ------------ |
| `< sm` (< 640 px) | Input and button stacked, both full width | 1            |
| `sm` (≥ 640 px)   | Input and button on one row               | 2            |
| `lg` (≥ 1024 px)  | Same                                      | 3            |
| `xl` (≥ 1280 px)  | Same                                      | 4            |

- Content max width `max-w-6xl`, centered, with side padding (`px-4`).
- No horizontal scroll at 320 px width.
- Touch targets at least 44 × 44 px.
- The form is a grid: `grid-cols-1`, and `sm:grid-cols-[1fr_auto]` from `sm`. `TextField` lays out
  label, input and description as a subgrid (`grid-rows-subgrid`), so the Search button sits in the
  input row whatever the label height. No pixel offsets.

## Styling

Goal: this spec ships a minimal neutral look, and later specs change styling or theming in **one
place** (`src/index.css`) without editing components.

`src/index.css` keeps the full Tailwind import (preflight included) and adds a small set of
**semantic tokens** with `@theme`. Their values point to the Tailwind `stone` palette:

```css
@import 'tailwindcss';

@theme inline {
  --color-bg: var(--color-white);
  --color-bg-subtle: var(--color-stone-100); /* placeholders, skeletons */
  --color-fg: var(--color-stone-900);
  --color-fg-muted: var(
    --color-stone-600
  ); /* hint, artists, date, status line */
  --color-border: var(--color-stone-300);
  --color-accent: var(--color-stone-900); /* primary button, focus ring */
  --color-accent-fg: var(--color-white);
  --radius-control: var(--radius-md); /* buttons, inputs, cards */
}

body {
  @apply bg-bg text-fg;
}
```

Rules for components:

- Colors only through the tokens: `bg-bg`, `bg-bg-subtle`, `text-fg`, `text-fg-muted`,
  `border-border`, `bg-accent`, `text-accent-fg`, `outline-accent`. Raw palette classes
  (`stone-*`, `white`, `black`), hex values and arbitrary color values (`bg-[#...]`) are not
  allowed.
- Radius only through `rounded-control`.
- Layout, spacing, typography size/weight and breakpoints use the Tailwind defaults (`flex`,
  `grid`, `gap-*`, `p-*`, `text-sm`, `font-semibold`, `sm:`, …). They are not themed in this
  spec.
- Library components (Base UI) are styled only inside the UI wrappers in `src/components/ui/`
  (see "UI component layer"). Feature code never styles a library part or a library data
  attribute.
- Focus: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`
  on every control. Never `outline-none` without a replacement.
- Motion: `motion-safe:animate-pulse` only, so reduced-motion users see no animation.

A later theme spec (dark mode, brand colors, fonts) changes token values in `src/index.css`, and
adds tokens there if needed. Components stay the same.

## UI component layer

Goal: feature code does not depend on a UI library. All library components sit behind **app-owned
wrappers** in `src/components/ui/`. Replacing Base UI with another library (or plain HTML) changes
only that folder.

```
src/features/search/*  ──imports──▶  src/components/ui/*  ──imports──▶  @base-ui/react/*
                     (app API)                         (only place that knows the library)
```

Rules:

1. **Only `src/components/ui/` imports `@base-ui/react`.** Enforced by ESLint
   `no-restricted-imports` (pattern `@base-ui/*`) for `src/**`, with an override that allows it in
   `src/components/ui/**`.
2. **Wrapper props are app-owned.** No library type, prop name or concept leaks out: no
   `Button.Props`, no `focusableWhenDisabled`, no `render`, no `Field.*` parts, no `className`
   pass-through. Props are plain types defined in the wrapper file.
3. **Library behavior maps to app concepts.** Example: `Button` `pending` prop. The wrapper turns
   it into Base UI `disabled` + `focusableWhenDisabled`. Another library would map it differently.
4. **Wrapper styles live in the wrapper.** Token classes and library data attributes
   (`data-disabled:`, `data-focused:`) appear only inside `src/components/ui/`.
5. **Wrapper tests check behavior, not the library:** roles, accessible names, descriptions,
   disabled state, focus, events. They must still pass after a library swap without edits.
6. **Feature code imports from the barrel** `src/components/ui/index.ts`, never from a wrapper
   file path or the library.

### Wrappers in phase 1

| Wrapper     | App API (summary)                                                                | Base UI inside                                                                                              |
| ----------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Button`    | `variant`, `type`, `disabled`, `pending`, `onClick`, `children`                  | `Button` (`@base-ui/react/button`)                                                                          |
| `TextField` | `label`, `description`, `value`, `onValueChange`, `type`, `name`, `autoComplete` | `Field.Root`, `Field.Label`, `Field.Description` (`@base-ui/react/field`), `Input` (`@base-ui/react/input`) |

- `TextField` links the label and the description to the input (`htmlFor`, `aria-describedby`).
  With Base UI, `Field` does it; another library must keep the same accessible result.
- Base UI imports always use subpaths (`@base-ui/react/button`), never the package root.
- Not used in phase 1: Base UI `Form` (a native `<form>` is enough), and popup components
  (`Dialog`, `Popover`, `Toast`, …), so the root `isolation: isolate` setup is not needed yet.
- The result grid, cards, image, skeleton and messages are plain HTML elements in
  `src/features/search`. They are not wrappers, because no library is involved.

## Search form

- Native `<form role="search">` with one `TextField`: label **"Artist name"**, `type="search"`.
- The input value maps to `creator` only: `useArtworkSearch({ creator: submittedTerm })`. `title`
  is never sent.
- Hint below the input, as the `TextField` `description`: **`Use the full name, e.g. "Rembrandt"`**. Reason: the API matches whole
  words only (`rembr` returns 0).
- Button **"Search"**, `type="submit"`. Pressing Enter in the input submits too.
- The form keeps two values: the text being typed (`draft`) and the last submitted term
  (`submittedTerm`). Only a submit passes the text to the hook. Typing does not search.
- Submit calls `event.preventDefault()`. The page never reloads.
- Submit sets `submittedTerm` to `draft.trim()`. The hook normalizes it further (inner
  whitespace).

### Search button state

| Condition                               | Button   | Label        |
| --------------------------------------- | -------- | ------------ |
| `draft` is blank after trim             | disabled | "Search"     |
| Search running (`status === 'pending'`) | disabled | "Searching…" |
| Otherwise (idle, success, empty, error) | enabled  | "Search"     |

- Blank input: `Button` `disabled`. Search running: `Button` `pending`. A pending button cannot be
  activated but keeps focus (a natively disabled button loses it), so screen readers hear the
  "Searching…" label.
- The submit handler also returns early when `draft` is blank or `status === 'pending'`. So Enter in
  the input cannot start a second search, whatever the button does.
- The button is enabled again when the first search page finishes (success, empty or error). Item
  cards may still be loading at that time; they show their own loading state.
- Submitting the same term again is allowed:
  - After success or empty: no change. The hook input is the same, so the results stay and no
    request is sent.
  - After an error: submit calls `retry()`. Without this, Search would do nothing, because the
    hook input does not change.
- The input stays editable while a search runs.

## Result states

The area below the form shows exactly one of these, chosen from the hook result:

| Hook state                            | UI                                                      |
| ------------------------------------- | ------------------------------------------------------- |
| `status: 'idle'`                      | Nothing (only the form and hint)                        |
| `status: 'pending'`                   | Grid of 10 skeleton cards                               |
| `status: 'success'`, `isEmpty: true`  | Empty message                                           |
| `status: 'success'`, `isEmpty: false` | Status line, result grid, Load more button if `hasMore` |
| `status: 'error'`                     | Error message with "Try again" button                   |

### Empty

Text: **"No results found. Try another search term."**

### Error (first search request failed)

The list is replaced by an error block (`role="alert"`) with a message and a **"Try again"** button
that calls `retry()`.

| Error                         | Message                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| `kind: 'http'`, `status: 429` | **"The service is not available right now. Please try again later."** |
| Any other error               | **"Something went wrong. Please try again."**                         |

- One shared helper `getErrorMessage(error: RijksApiError): string` returns the text. Every error
  surface below uses it.
- The UI never shows `error.message` (developer text with URLs).
- The hook already retries `5xx`, `429`, `network` and `timeout` 2 times before the error reaches
  the UI. `400` is not retried automatically; "Try again" repeats it on demand.
- While the retry runs, the area shows skeleton cards again (`status` goes back to `pending`) and
  the Search button is disabled.

### Success

- Status line: **"Showing {artworks.length} of {total} results"**. For `total === 1`:
  **"Showing 1 of 1 result"**. Numbers use `toLocaleString('en-US')` ("1,423").
- Grid of cards, one per `artworks[i]`, in API order. Key: `id`.
- Artworks already shown stay in place when more load.

## Artwork card

Semantic `<article>` inside a `<li>` of a `<ul>`. Not interactive in this phase: no link, no
`onClick`, no hover or pointer cursor that suggests a click.

By `ArtworkResult.status`:

- `pending`: skeleton card: `bg-bg-subtle` image box (same `aspect-[4/3]`) and 2 text bars,
  `motion-safe:animate-pulse`, `aria-busy="true"`. Same size as the resolved card, so the grid does
  not jump.
- `error`: card with text **"This artwork could not be loaded."** and a **"Retry"** button that
  calls the item `retry()`. Other cards are not affected.
- `success`:
  - Image: `thumbnailUrl`, fixed aspect ratio box (`aspect-[4/3]`), `object-cover`,
    `loading="lazy"`, `alt` = artwork title.
  - Title (`<h2>`), at most 2 lines (`line-clamp-2`), full title in `title` attribute.
  - Artists joined with `", "`. Hidden when `artists` is `[]`.
  - Date: year of `date.start`. When `date.end` has a different year: `"1640–1642"`. Hidden when
    both are `null`.

### Image fallback

When `thumbnailUrl` is `null`, or the `<img>` fires `onError`, the image box shows a placeholder:
the text **"Image not available"** (`text-fg-muted`), centered on `bg-bg-subtle`. Same size as the image box,
so the grid does not jump.

## Load more

- Button **"Load more"** below the grid, shown only when `hasMore` is true. Calls `loadMore()`.
- While `isLoadingMore`: `Button` `pending` (cannot be activated, keeps focus), label
  **"Loading…"**.
- New items appear as skeleton cards, then resolve one by one.
- When `loadMoreError` is set: the list stays, and a short message from `getErrorMessage` appears
  next to the button (`role="alert"`). The button stays enabled; clicking it retries.
- When `hasMore` turns false the button is removed.

## Accessibility

- `<main>` landmark, one `<h1>`, form with `role="search"`.
- Status line and empty message in a polite live region (`aria-live="polite"`). The live region
  element is always rendered (empty while idle), so screen readers announce changes. Error blocks
  use `role="alert"`.
- Results grid has `aria-busy="true"` while `status === 'pending'`.
- All controls reachable by keyboard with a visible focus outline (see "Styling").
- Text contrast WCAG AA (4.5:1). `fg` and `fg-muted` on `bg` pass with the default token values;
  any later token change must keep this.
- Focus stays on the Search button / input after submit. It is not moved to the results.
- A retry button leaves the page while it retries, so focus moves to an element that stays (WCAG
  2.4.3): "Try again" focuses the results region (`<section aria-label="Search results"
tabIndex={-1}>`), and a card's "Retry" focuses that card's `<li tabIndex={-1}>`. Both show the
  `accent` focus outline.

## Interface (new code)

```ts
// src/features/search/getErrorMessage.ts
export function getErrorMessage(error: RijksApiError): string;

// src/features/search/formatDateRange.ts
export function formatDateRange(date: Artwork['date']): string | null;

// Components: named exports, props typed with a local `type ...Props`, return type inferred
export function SearchPage(); // owns draft + submittedTerm, calls useArtworkSearch
export function SearchForm(props: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSearching: boolean;
});
export function SearchResults(props: {
  search: ReturnType<typeof useArtworkSearch>;
});
export function ArtworkCard(props: { result: ArtworkResult });
export function ArtworkImage(props: { src: string | null; alt: string });
export function ErrorMessage(props: {
  error: RijksApiError;
  onRetry: () => void;
});

// src/components/ui/Button.tsx: app-owned props only, no library types
export type ButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary'; // default 'secondary'
  type?: 'button' | 'submit'; // default 'button'
  disabled?: boolean; // not focusable, cannot be activated
  pending?: boolean; // cannot be activated, stays focusable, aria-disabled
  onClick?: () => void;
};
export function Button(props: ButtonProps);

// src/components/ui/TextField.tsx
export type TextFieldProps = {
  label: string;
  description?: string; // linked with aria-describedby
  value: string;
  onValueChange: (value: string) => void;
  type?: 'text' | 'search'; // default 'text'
  name?: string;
  autoComplete?: string;
};
export function TextField(props: TextFieldProps);

// src/components/ui/index.ts: the only import path for feature code
export { Button, type ButtonProps } from './Button';
export { TextField, type TextFieldProps } from './TextField';
```

New props are added to a wrapper only when a feature needs them, and only as app concepts.

`App.tsx` renders `<SearchPage />` and drops the Vite template content. It keeps its default
export, because `main.tsx` imports it that way.

## Project Structure

```
src/features/search/
  SearchPage.tsx          → state (draft, submittedTerm), hook call, layout
  SearchForm.tsx          → input, hint, Search button
  SearchResults.tsx       → picks idle / pending / empty / error / success view, Load more
  ArtworkCard.tsx         → pending / error / success card
  ArtworkImage.tsx        → <img> with placeholder fallback
  ErrorMessage.tsx        → error block + Try again
  getErrorMessage.ts      → RijksApiError → user text
  formatDateRange.ts      → Artwork date → "1642" | "1640–1642" | null
  *.test.ts(x)            → co-located tests
src/App.tsx               → renders SearchPage
src/index.css             → Tailwind import + semantic tokens (@theme inline) + body colors
src/components/ui/        → UI wrappers: the only code that imports @base-ui/react
  index.ts                → barrel, the only import path for feature code
  Button.tsx              → wraps Base UI Button; token styles; primary / secondary / pending
  TextField.tsx           → wraps Base UI Field + Input; label, description, value
  *.test.tsx              → behavior tests, library-agnostic
eslint.config.js          → no-restricted-imports for @base-ui/* outside src/components/ui
src/test/render.tsx       → add renderWithClient (same QueryClient setup as renderHookWithClient)
vite.config.ts            → add src/features/search/** and src/components/** to coverage include
```

## Tech Stack

Existing: React 19.3 (React Compiler), TypeScript 6.0, Tailwind 4, TanStack Query 5, Vitest,
Testing Library, MSW.

New dependency (approved): `@base-ui/react` **1.8.0**, exact version like the other dependencies
(`pnpm add @base-ui/react@1.8.0`). Peer deps `react` / `react-dom` ^19 are met. Its optional peers
`date-fns` and `@date-fns/tz` are not installed. Nothing else new. Icons, if any, are inline SVG.

## Commands

```sh
pnpm start                  # Vite dev server (manual responsive check)
pnpm test                   # vitest run
pnpm test:watch             # vitest
pnpm test:coverage          # vitest run --coverage
pnpm lint                   # eslint 'src/**/*.{ts,tsx}'
pnpm build                  # tsc -b && vite build (type check included)
```

## Code Style

Same as the API spec: Prettier/ESLint setup, named exports in `src/features` and
`src/components`, no `any`. Tailwind classes with semantic color/radius tokens only (see
"Styling"), no other CSS beyond `index.css`. Components stay small; logic that is not rendering (`getErrorMessage`, `formatDateRange`) lives in pure functions.

```tsx
const HTTP_TOO_MANY_REQUESTS = 429;

export function getErrorMessage(error: RijksApiError): string {
  if (error.kind === 'http' && error.status === HTTP_TOO_MANY_REQUESTS) {
    return 'The service is not available right now. Please try again later.';
  }
  return 'Something went wrong. Please try again.';
}

type ErrorMessageProps = { error: RijksApiError; onRetry: () => void };

export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-12 text-center"
    >
      <p className="text-fg-muted">{getErrorMessage(error)}</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
```

- User-facing strings live next to the component that shows them. No i18n layer.
- Tests query by role and accessible name (`getByRole('button', { name: 'Search' })`), not by
  class or test id.

## Testing Strategy

- **Unit (Vitest)**: `getErrorMessage` (429, 500, 400, network, timeout, parse), `formatDateRange`
  (same year, range, start only, both null).
- **Component (Testing Library + MSW, `renderWithClient` from `src/test/render.tsx`)** on
  `SearchPage`:
  - Search button disabled with blank or whitespace-only input; no request sent.
  - Same term submitted again after success sends no request; after an error it retries.
  - Submit with button click and with Enter sends one search with `creator` only.
  - Button disabled with label "Searching…" while the search runs; a second click sends no request;
    enabled again after the response.
  - 10 cards rendered on success; status line shows "Showing 10 of N results".
  - Empty fixture shows "No results found. Try another search term."
  - `500` (after hook retries) and `400` show "Something went wrong. Please try again." and "Try
    again" re-runs the search and shows results.
  - `429` shows "The service is not available right now. Please try again later."
  - Load more visible when `hasMore`, adds 10 cards, hidden after the last batch.
  - Load more failure keeps cards, shows the message, and a second click recovers.
  - One failed object shows "This artwork could not be loaded." with "Retry"; other cards render.
  - `thumbnailUrl: null` and `<img>` `error` event both show "Image not available".
- `renderWithClient` sets `retryDelay: 0`, like `renderHookWithClient`, so retried errors do not
  slow tests.
- Use `@testing-library/react` `fireEvent` / `act`. `@testing-library/user-event` is not installed
  and is not added.
- No test hits the real API.
- **Wrappers (`src/components/ui/*.test.tsx`)**, library-agnostic (no Base UI classes, parts or
  data attributes in assertions):
  - `Button`: default `type="button"`, `type="submit"` submits a form, `disabled` blocks `onClick`
    and is not focusable, `pending` blocks `onClick` and the form submit, stays focusable, and has
    `aria-disabled="true"`.
  - `TextField`: input found by its label, has the description as accessible description,
    `onValueChange` gets the typed value.
- **Component, extra cases**: while searching, focus stays on the Search button; Enter in the input
  while searching sends no second request; the hint is linked to the input (`toHaveAccessibleDescription`
  or `aria-describedby`).
- Do not test Base UI internals. Test only what this app relies on: roles, names, disabled state,
  focus.
- Coverage: ≥ 90% lines for `src/features/search/**` and `src/components/**`.
- **Manual responsive check**: `pnpm start`, browser devtools at 320, 640, 1024, 1280 and 1920 px
  widths. jsdom has no layout, so tests do not cover columns or overflow.

## Boundaries

- **Always:** run `pnpm lint`, `pnpm test`, `pnpm build` before each commit. Use the public exports
  of `src/api/rijksmuseum` only. Pick user text from `getErrorMessage`, never from `error.message`.
- **Ask first:** new dependencies (other UI kit, icon library, router). Base UI components
  beyond `Button`, `Field`, `Input`. New wrappers or new wrapper props.
  A detail page or modal. Changes inside `src/api`. Changes outside `src/features/search`,
  `src/components/ui`, `eslint.config.js`, `src/App.tsx`, `src/index.css`, `src/test/render.tsx`,
  `vite.config.ts`. New tokens or changes to token values.
- **Never:** remove the focus outline. Search on every keystroke. Send a blank search. Show raw error messages or URLs to
  the user. Skip or delete failing tests.

## Success Criteria

- [x] Manual check: no horizontal scroll at 320, 640, 1024, 1280 and 1920 px; grid shows 1 / 2 /
      3 / 4 columns at the breakpoints above.
- [x] `src/index.css` keeps `@import 'tailwindcss'` and defines the tokens from "Styling".
- [x] `grep -rE -e '-(stone|white|black)(-[0-9]+)?\b|\[#' src/features src/components` finds no raw color
      class. Colors and radius come only from tokens.
- [x] Changing one token value (e.g. `--color-accent`) restyles every button without editing
      components (manual check).
- [x] All buttons render through `Button`. Every control shows a focus outline on keyboard focus.
- [x] `grep -rn "@base-ui" src` lists files in `src/components/ui/` only, with subpath imports of
      `button`, `field`, `input` only.
- [x] ESLint fails when a file outside `src/components/ui/` imports `@base-ui/*` (checked once by
      hand with a temporary import).
- [x] Wrapper props expose no Base UI type or prop name. Feature code imports UI only from
      `src/components/ui`.
- [x] Focus stays on the Search and Load more buttons while they show "Searching…" / "Loading…".
- [x] `pnpm lint` resolves the token classes (ESLint `better-tailwindcss` reads `src/index.css` as
      `entryPoint`).
- [x] Blank input: Search disabled, 0 requests.
- [x] Search sends `creator` only; button disabled with label "Searching…" while it runs and
      enabled after it ends.
- [x] Same term again: no request after success, retry after error.
- [x] Success shows the first 10 artworks with image (or placeholder), title, artists, date.
- [x] "Load more" shown only while `hasMore`; each click adds 10.
- [x] 0 results shows "No results found. Try another search term."
- [x] 429 shows "The service is not available right now. Please try again later." with "Try again".
- [x] Any other error (400, 500, network, …) shows "Something went wrong. Please try again." with
      "Try again", and "Try again" recovers.
- [x] Failed artwork affects only its own card.
- [x] Keyboard-only use works: type, Enter, Tab to Load more and Retry buttons.
- [x] `pnpm lint`, `pnpm test:coverage` (≥ 90% lines in `src/features/search` and `src/components`) and `pnpm build`
      pass.

## Decisions

- Search by artist only (`creator`). No title field.
- Search button: disabled while blank and while the first search page loads. Repeating the same
  term is allowed (served from cache).
- "Load more" included, shown while `hasMore` is true.
- Error text: one generic message for every error, except `429`, which gets a "service not
  available, try later" message. Every error block has a retry action.
- Styling: full Tailwind with preflight. Colors and radius through semantic tokens in
  `src/index.css`, so later specs restyle or theme in one place. Button styles in one `Button`
  primitive.
- Pending state: skeleton cards, not a spinner.
- Base UI (`@base-ui/react` 1.8.0) for accessible primitives. Phase 1 uses only `Button`, `Field`,
  `Input`, always behind app-owned wrappers in `src/components/ui/` (`Button`, `TextField`). Only
  that folder knows the library, so it can be replaced without touching features. Later phases add
  wrappers as needed, each approved in its spec.
- Results count line ("Showing X of Y results") added for orientation.
- Phase 1 is search and results only. Cards are not clickable until the detail phase.

## Next phases (out of scope here)

**Phase 2: artwork detail page.** Clicking a card opens a new route with the artwork details.
It gets its own spec (`SPEC-artwork-detail-ui.md`). Points that spec must decide, recorded here so
phase 1 does not block them:

- **Router.** New dependency (e.g. React Router or TanStack Router). Needs approval.
- **Route param.** `Artwork.id` is a full URL (`https://id.rijksmuseum.nl/200107928`). The route
  can use the numeric part (`/artworks/200107928`) and rebuild the ID, keeping the
  `https://id.rijksmuseum.nl/` allowlist. Or it can use `objectNumber` (`SK-C-5`), but the API
  layer has no lookup by object number.
- **Detail data.** `useArtwork(id)` already exists. If the page shows more fields than `Artwork`
  has (description, materials, size), the API spec must be extended first.
- **Back to results.** With a router, the search page unmounts when the user opens a detail page.
  On the way back:
  - The search results stay in the TanStack cache.
  - `submittedTerm` (component state) and the hook's `visibleCount` reset. Without a fix, the user
    sees an empty form, and after a new search only the first 10 results.
  - Likely fix: keep the term in the URL (`/?artist=Rembrandt`) and keep `visibleCount` where it
    survives navigation. Scroll position restore also belongs there.
- **Card as a link.** The whole card becomes one `<a>` (or a link on the title with a stretched
  click area), with the token focus outline.

Phase 1 changes nothing for these points: no router, no URL state, cards not clickable.

## Open Questions

None.
