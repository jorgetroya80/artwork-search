# Spec: Rijksmuseum artwork search — API layer

- Created: 2026-10-01
- Status: **approved** (2026-10-01)
- Plan: [PLAN-artwork-search-api.md](../plans/PLAN-artwork-search-api.md)

Scope is the data layer only. The search UI gets its own spec
later and consumes the interface defined here.

## Objective

Give the app a typed, tested way to search the Rijksmuseum collection by **artist name** and/or
**artwork title**, and to turn each result into a flat `Artwork` object ready to render (title,
artists, date, image).

User: the developer building the search UI. Success: the UI calls one hook with `{ creator, title }`
and gets back the resolved artworks loaded so far, the total, and a `loadMore` function for a "Load
more" button. It gets loading and error states, and does not need to know Linked Art / JSON-LD.

### API findings (verified with curl, 2026-10-01)

Search endpoint:

```
GET https://data.rijksmuseum.nl/search/collection?creator=<name>&title=<title>&imageAvailable=true[&pageToken=<token>]
```

- No API key required. CORS open (`access-control-allow-origin: *`), so the browser calls it
  directly.
- `creator` and `title` combine with AND. `creator=Rembrandt&title=Nachtwacht` returns 1 item
  (SK-C-5).
- `imageAvailable=true` keeps only objects with an image. `creator=Rembrandt van Rijn` returns 1463
  items without the filter and 1423 with it.
- Matching is case-insensitive and whole-word. There is no prefix or wildcard search: `rembr`,
  `nachtw` and `nachtw*` all return 0. A multi-word value must match a stored name variant:
  `Rembrandt Harmensz` returns 0, `Johannes Vermeer` returns 4, `Vermeer` returns 16.
- Titles are indexed in Dutch and English: `Nachtwacht` 415, `Night Watch` 4, `melkmeisje` 59,
  `Milkmaid` 4.
- With no filter the endpoint returns the whole collection, and `creator=` (empty) returns 0. Both
  results are useless, so the client must never send a blank search.
- Unknown query parameter: `400 {"detail":"Unsupported query parameter: foo"}`.
- Response is a Linked Art `OrderedCollectionPage`:
  - `partOf.totalItems`: total result count.
  - `orderedItems[]`: up to 100 `{ id, type: "HumanMadeObject" }` per page. **IDs only, no data.**
  - `next.id`: URL of the next page, with an opaque `pageToken`. The last page has no `next`.
  - Zero results: `totalItems: 0`, `orderedItems: []`.
- **Pagination is cursor-based.** Page size is fixed at 100. There is no `page`, `offset` or
  page-size parameter. The `pageToken` is base64 of `{"token": "<last object id>"}`. Treat it as
  opaque: the only way to reach API page N is to follow `next` from page N-1.

Resolving one result costs several more requests to `https://id.rijksmuseum.nl/{id}` (JSON-LD,
~100 KB, ~250 ms each). An unknown ID returns `400`.

| Data                  | Path in object JSON-LD                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Object number         | `identified_by[]` where `type == "Identifier"`, `.content` (e.g. `SK-C-5`)                               |
| Titles                | `identified_by[]` where `type == "Name"`, `.content`                                                     |
| Title language        | `language[].id`: AAT `300388256` = Dutch, AAT `300388277` = English                                      |
| Short / display title | Name whose `classified_as[].id` includes AAT `300404670` (e.g. "De Nachtwacht")                          |
| Date                  | `produced_by.timespan.begin_of_the_begin` / `end_of_the_end` (ISO strings)                               |
| Artist IDs            | `produced_by.part[].carried_out_by[].id` (may also sit at `produced_by.carried_out_by[]`)                |
| Artist name           | fetch artist ID, `identified_by[]` `type == "Name"`; prefer the "First Last" form ("Rembrandt van Rijn") |
| Image                 | `shows[].id` → VisualItem `digitally_shown_by[].id` → DigitalObject `access_point[].id` = IIIF URL       |

IIIF image URL example: `https://iiif.micr.io/PJEZO/full/max/0/default.jpg`. Replace `max` with
`400,` to get a 400 px wide thumbnail.

Full cost per artwork: object + visual item + digital object + one request per artist (artists
are shared across results and are cached).

## Pagination model

The UI shows a growing list with a **"Load more" button**. Each click adds **10 artworks**
(`PAGE_SIZE = 10`). The API returns 100 IDs per cursor page (`API_PAGE_SIZE = 100`). The API layer
hides that difference, so the UI only sees "artworks so far" and "load more".

Two levels, both cumulative:

1. **ID pages (`useInfiniteQuery`).** Each `useInfiniteQuery` page is one API search page of up to
   100 IDs. `getNextPageParam` reads `nextPageToken`. Pages are only appended, never replaced.
2. **Visible batches (`visibleCount`).** The hook shows the first `visibleCount` IDs across all
   loaded ID pages. `visibleCount` starts at 10 and grows by 10 on each `loadMore()`.

`loadMore()` flow:

- `visibleCount` grows by 10.
- If the loaded IDs already cover the new `visibleCount`, no search request is sent. Only the 10
  new artworks are resolved.
- If not, the hook calls `fetchNextPage()` once. Then it resolves the 10 new artworks.
- Result: one search request per 10 clicks. The first page loads with the search (10 visible).
  Clicks 1–9 reach 100 visible from that cached page. Click 10 (110 visible) fetches API page 2.

Rules:

- Artworks already shown stay in the list and keep their resolved state (cached by ID).
- `hasMore = visibleCount < total`. `total` comes from the first search response.
- The last batch can have fewer than 10 artworks (e.g. 3 when `total` is 1423).
- A new search (changed normalized input) starts from scratch: new query key, `visibleCount` back
  to 10.
- There is no page number and no jump to a page. This matches the cursor-based API, which cannot
  skip pages.

## Interface

All public exports come from `src/api/rijksmuseum/index.ts`.

```ts
export const PAGE_SIZE = 10;

export type SearchInput = {
  creator?: string | null;
  title?: string | null;
};

/** Normalized input: trimmed, inner whitespace collapsed, blank fields removed. */
export type SearchParams = {
  creator?: string;
  title?: string;
};

export type SearchPage = {
  total: number;
  ids: string[]; // full https://id.rijksmuseum.nl/... URLs, max 100
  nextPageToken: string | null;
};

export type Artwork = {
  id: string; // full object URL
  objectNumber: string | null; // "SK-C-5"
  title: string; // display title in requested language, falls back to any language
  artists: string[]; // display names, [] when unknown
  date: { start: string | null; end: string | null }; // ISO dates
  imageUrl: string | null; // IIIF full size
  thumbnailUrl: string | null; // IIIF 400px wide
};

export type Language = 'en' | 'nl';

// Pure
export function normalizeSearchInput(input: SearchInput): SearchParams | null;
/** First `visibleCount` IDs across the loaded API pages, in API order. */
export function getVisibleIds(
  pages: SearchPage[],
  visibleCount: number
): string[];
/** True when fewer than `visibleCount` IDs are loaded and the last page has a `nextPageToken`. */
export function needsNextApiPage(
  pages: SearchPage[],
  visibleCount: number
): boolean;

// Fetchers (accept AbortSignal, throw RijksApiError)
export function searchCollection(
  params: SearchParams,
  pageToken?: string | null,
  signal?: AbortSignal
): Promise<SearchPage>;
export function fetchArtwork(
  id: string,
  options?: { language?: Language; signal?: AbortSignal }
): Promise<Artwork>;

// React hooks (TanStack Query)
export function useArtworkSearch(
  input: SearchInput,
  options?: { language?: Language }
): {
  status: 'idle' | 'pending' | 'error' | 'success';
  artworks: ArtworkResult[]; // every loaded batch, in API order
  total: number | null; // null while idle or before the first response
  isEmpty: boolean; // true only when the search succeeded with 0 results
  error: RijksApiError | null; // first search request failed (status: 'error')
  retry: () => void; // repeats the failed first search request
  hasMore: boolean; // false when every result is loaded
  loadMore: () => void; // shows PAGE_SIZE more artworks; after loadMoreError it retries
  isLoadingMore: boolean; // true while loadMore fetches a new API page
  loadMoreError: RijksApiError | null; // last loadMore search request failed
};
export function useArtwork(
  id: string,
  options?: { language?: Language }
): UseQueryResult<Artwork, RijksApiError>;

export type ArtworkResult =
  | { id: string; status: 'pending' }
  | { id: string; status: 'error'; error: RijksApiError; retry: () => void }
  | { id: string; status: 'success'; artwork: Artwork };

export type RijksApiErrorKind =
  'http' | 'network' | 'timeout' | 'parse' | 'invalid-id';

export class RijksApiError extends Error {
  readonly kind: RijksApiErrorKind;
  readonly status: number | null; // HTTP status for kind 'http', else null
  readonly url: string; // request URL
  readonly retryable: boolean; // see "Error handling"
  readonly cause?: unknown; // original error (TypeError, SyntaxError, ...)
}
```

The hook owns the number of visible artworks. The UI renders `artworks` and a "Load more" button
that calls `loadMore` and is hidden when `hasMore` is false. When `isEmpty` is true, the UI shows a
"no results" message instead of the list.

Image fallback has two cases, and the UI handles both the same way:

1. `imageUrl` / `thumbnailUrl` is `null`: the API layer could not resolve the image chain.
2. The URL exists but the browser fails to load it (`<img>` `onError`: 404, network error, broken
   file).

In both cases the UI shows a placeholder with the text "Image not available" instead of a broken
image. The API layer does not check that an image loads. That check happens in the browser.

## Error handling

### 1. One error type

Every failure in the API layer becomes a `RijksApiError`. `http.ts` (`fetchJson`) is the only place
that creates it. No raw `TypeError`, `SyntaxError` or `Response` reaches the hooks or the UI.

| `kind`       | When                                                                                                       | `status`    | `retryable`                     |
| ------------ | ---------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------- |
| `http`       | Response is not 2xx. Example: `400 {"detail":"Unsupported query parameter: foo"}`, unknown ID `400`, `500` | HTTP status | `true` only for `429` and `5xx` |
| `network`    | `fetch` rejects: offline, DNS, CORS, connection reset                                                      | `null`      | `true`                          |
| `timeout`    | No response within 15 s (`AbortSignal.timeout(15_000)`)                                                    | `null`      | `true`                          |
| `parse`      | Body is not JSON, or the search response lacks `partOf.totalItems` / `orderedItems`                        | `null`      | `false`                         |
| `invalid-id` | ID does not start with `https://id.rijksmuseum.nl/`. Thrown before any request                             | `null`      | `false`                         |

- For `http`, the message includes the API `detail` when the body has one.
- `message` is for developers (English, includes the URL). The UI never shows it. The UI picks
  its own text from `kind`.

### 2. Cancellation is not an error

A request cancelled by TanStack (input changed, component unmounted) is not turned into a
`RijksApiError`, not retried, and not shown to the user. `fetchJson` combines the caller signal and
the timeout with `AbortSignal.any([signal, AbortSignal.timeout(15_000)])`. It tells them apart by
`signal.aborted`: the caller signal aborted means cancellation, otherwise it is a `timeout`.

### 3. Automatic retry

The `QueryClient` retries with `retry: (count, error) => error.retryable && count < 2`. That is at
most 2 retries, with TanStack's exponential backoff (1 s, 2 s). Errors that are not retryable fail
at once: retrying a `400` or a bad body gives the same result.

### 4. Where each error ends up

| Failed request                             | Effect                                               | What the UI gets                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| First search page                          | Search fails. Nothing to show                        | `status: 'error'`, `error`, `artworks: []`, `retry()`                                                                  |
| Next search page (`loadMore`)              | Loaded artworks stay                                 | `status: 'success'`, `loadMoreError`. Next `loadMore()` retries the same page. `visibleCount` grows only after success |
| Object (`fetchArtwork`)                    | Only that artwork fails. The others are not affected | `artworks[i]` is `{ status: 'error', error, retry }`                                                                   |
| Artist                                     | Artwork still resolves                               | Missing name is left out of `artists`. `[]` when all fail                                                              |
| Image chain (visual item / digital object) | Artwork still resolves                               | `imageUrl: null`, `thumbnailUrl: null`                                                                                 |
| Image file in the browser                  | Outside the API layer                                | `<img onError>` shows the "Image not available" placeholder                                                            |

Artist and image sub-requests use the same retry policy before they fall back to `[]` / `null`.

### 5. What the UI shows (input for the UI spec)

- `status: 'error'`: an error message instead of the list, with a "Try again" button that calls
  `retry()`.
- `loadMoreError`: the list stays, and a short error appears next to "Load more". The button stays
  and retries.
- Item `error`: a card that says the artwork could not be loaded, with a retry action.
- Text by `kind`: `network` / `timeout` mean "check your connection". `http` 5xx / `429` mean "the
  museum service is not available, try later". Everything else means "something went wrong".

## Behavior and acceptance criteria

### Input validation (`normalizeSearchInput`)

- Both fields are optional. Accept `undefined`, `null` and `string`.
- Trim each field and collapse inner whitespace to one space.
- A field that is blank after trimming is removed.
- When both fields are blank, return `null`. **No request is ever sent for a `null` result.**
- Do not add wildcards or change case. The API matches whole words, and the UI spec owns the hint
  text for that.

### Search (`searchCollection`)

- Builds the URL with `URLSearchParams`. Sends `creator` and/or `title`, always
  `imageAvailable=true`, and `pageToken` when given. No other parameters.
- `imageAvailable` is not exposed as an option. Every result must have an image to display.
- Maps `partOf.totalItems` to `total` and `orderedItems[].id` to `ids`. `nextPageToken` is read
  from the `pageToken` of `next.id`, or is `null` when `next` is missing.
- Throws `RijksApiError` as described in "Error handling" (`http`, `network`, `timeout`, `parse`).

### Resolution (`fetchArtwork`)

- Fetches only URLs that start with `https://id.rijksmuseum.nl/`. Any other URL throws
  `invalid-id` and is not fetched. IDs come from a third-party response and must not be followed
  blindly.
- Sends `Accept: application/ld+json`.
- Language defaults to `en`.
- Title: the short title (AAT `300404670`) in the requested language, then any title in that
  language, then the short title in any language, then the first Name.
- Artists: resolves every artist ID in parallel. Picks the first name that does not contain a comma
  ("Rembrandt van Rijn" over "Rijn, Rembrandt van"), otherwise the first name. Removes duplicates.
- **Partial failure does not fail the artwork.** If the image chain or an artist request fails, the
  matching field is `null` / skipped. Only a failed object request fails the artwork.
  `imageAvailable=true` makes a missing image rare, but the code still handles it. The UI shows its
  "Image not available" placeholder for a `null` image.
- Missing fields map to `null` / `[]`, never throw.

### Hook (`useArtworkSearch`)

- `null` normalized input: `status: 'idle'`, `total: null`, `artworks: []`, `hasMore: false`, the
  queries are disabled, no network traffic.
- One `useInfiniteQuery` over API search pages. Query key: `['rijksmuseum', 'search', params]`.
  `getNextPageParam` returns `nextPageToken`, or `undefined` when it is `null`.
- `visibleCount` starts at `PAGE_SIZE` and resets to `PAGE_SIZE` when the normalized input changes.
- `loadMore()` adds `PAGE_SIZE` to `visibleCount`. When `needsNextApiPage` is true, it calls
  `fetchNextPage`. `isLoadingMore` is true while that request runs.
- `loadMore()` does nothing while `hasMore` is false or while a search request is running. A double
  click never skips or repeats a batch.
- `hasMore` is `visibleCount < total`.
- Resolves the IDs from `getVisibleIds`, with one `useQueries` entry per ID and key
  `['rijksmuseum', 'artwork', id, language]`. Earlier batches stay resolved from cache.
- Artist and image sub-requests go through `queryClient.fetchQuery` with their own keys
  (`['rijksmuseum', 'entity', id]`), so a shared artist is fetched once.
- `staleTime`: search 5 minutes, objects and entities `Infinity` (collection data rarely changes).
- Changing the input cancels in-flight requests of the old search (TanStack `signal`).
- `status` is `error` only when the first search request fails. `loadMore` and item errors do not
  change `status` (see "Error handling", section 4).
- Zero results: `status: 'success'`, `isEmpty: true`, `artworks: []`, `total: 0`, `hasMore: false`.
  `isEmpty` is false in every other state (idle, pending, error, results found). The UI uses it to
  show a "no results" message, so it never confuses "no results" with "not searched yet" or "still
  loading".
- A failed `loadMore` search request sets `loadMoreError`, keeps the artworks already loaded, and
  does not grow `visibleCount`. Calling `loadMore` again retries and clears `loadMoreError` on
  success.

## Tech Stack

Existing: React 19.3 (React Compiler), TypeScript 6.0, Vite 8, Tailwind 4, ESLint 10, Prettier 3,
pnpm 12.8.1, Node 24.18.0.

New dependencies (approved by this spec, latest stable at install time):

- `@tanstack/react-query` (runtime)
- `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `msw` (dev)

## Commands

```sh
pnpm install
pnpm start                  # Vite dev server
pnpm test                   # vitest run
pnpm test:watch             # vitest
pnpm test:coverage          # vitest run --coverage
pnpm lint                   # eslint 'src/**/*.{ts,tsx}'
pnpm build                  # tsc -b && vite build (type check included)
```

`test`, `test:watch` and `test:coverage` are new scripts. Vitest config goes in `vite.config.ts`
(`test.environment: 'jsdom'`, `test.setupFiles: ['src/test/setup.ts']`).

## Project Structure

```
src/api/rijksmuseum/
  index.ts            → public exports only
  constants.ts        → base URLs, AAT IDs, PAGE_SIZE, API_PAGE_SIZE, thumbnail width
  types.ts            → public domain types + minimal raw Linked Art types
  errors.ts           → RijksApiError
  normalize.ts        → normalizeSearchInput
  pagination.ts       → getVisibleIds, needsNextApiPage (pure)
  http.ts             → fetchJson(url, signal): status/network/parse error mapping, id allowlist
  search.ts           → searchCollection
  parse.ts            → pure JSON-LD → domain functions (title, artists ids, date, image chain links)
  artwork.ts          → fetchArtwork (orchestrates http + parse)
  queries.ts          → query key factory, useArtworkSearch, useArtwork
  *.test.ts(x)        → co-located tests
src/test/
  setup.ts            → MSW server lifecycle
  msw/handlers.ts     → handlers for search + id.rijksmuseum.nl
  fixtures/           → real JSON captured from the API (Night Watch object, Rembrandt person,
                        visual item, digital object, search pages incl. empty, multi-page and last page)
src/main.tsx          → wrap <App> in QueryClientProvider
```

## Code Style

Follows the existing Prettier/ESLint setup: single quotes, semicolons, 2-space indent, sorted
imports. Named exports in `src/api`. Pure functions take parsed JSON and return domain values.
Fetching stays out of `parse.ts` and `pagination.ts`.

```ts
import { AAT } from './constants';
import type { LinkedArtName, LinkedArtObject } from './types';

const hasClass = (name: LinkedArtName, aat: string): boolean =>
  name.classified_as?.some((c) => c.id === aat) ?? false;

export function pickTitle(
  object: LinkedArtObject,
  language: Language
): string | null {
  const names = object.identified_by?.filter((n) => n.type === 'Name') ?? [];
  const inLanguage = names.filter((n) =>
    n.language?.some((l) => l.id === AAT.language[language])
  );

  return (
    inLanguage.find((n) => hasClass(n, AAT.shortTitle))?.content ??
    inLanguage[0]?.content ??
    names.find((n) => hasClass(n, AAT.shortTitle))?.content ??
    names[0]?.content ??
    null
  );
}
```

- No `any`. Raw API types are partial (`?`) on purpose: never trust third-party shape.
- No default exports in `src/api`.
- Comments only for non-obvious API quirks (e.g. whole-word matching, cursor pagination).

## Testing Strategy

- **Unit (Vitest)**: `normalize.ts`, `pagination.ts`, `parse.ts`, using real fixtures. Cover each
  title fallback, artist name choice, missing fields, and the date range. Cover `getVisibleIds` and
  `needsNextApiPage` at 10, 100 and 110 visible, across 2 ID pages, on the last partial batch, and
  with total 0.
- **Integration (Vitest + MSW)**: `searchCollection` and `fetchArtwork` against MSW handlers. Cover
  `imageAvailable=true` always sent, pagination token, empty result, invalid-id rejection, and
  partial failure (image or artist 500, the artwork still resolves). Cover every row of the error
  table: `400` with `detail` in the message, `500` / `429` retryable, network failure, timeout (fake
  timers), non-JSON body, and caller abort that is not reported as an error.
- **Hook (Testing Library `renderHook` + MSW)**: idle on blank input with zero requests; first load
  resolves 10 items; `loadMore` 1–9 times makes no new search request; the 10th `loadMore` fetches
  API page 2 exactly once; loaded artworks stay in the list; double `loadMore` during a fetch adds
  only one batch; `hasMore` false after the last batch; first search `500` retried 2 times then
  `status: 'error'`, and `retry()` recovers; `400` not retried; failed `loadMore` sets
  `loadMoreError`, keeps loaded artworks and retries; one failed object gives one item error while
  the others succeed; shared artist fetched once; input change resets to 10 and cancels the old
  search.
- No test hits the real API. Fixtures are refreshed by hand when the API changes.
- Coverage: ≥ 90% lines for `src/api/rijksmuseum/**`.

## Boundaries

- **Always:** run `pnpm lint`, `pnpm test` and `pnpm build` before each commit. Validate input before
  any request. Send `imageAvailable=true` on every search. Allowlist `https://id.rijksmuseum.nl/`
  before following an ID. Pass `AbortSignal` through every fetch.
- **Ask first:** dependencies beyond the list above. Adding search filters (`type`, …). A backend or
  proxy. Changes outside `src/api`, `src/test`, `src/main.tsx`, `vite.config.ts`, `package.json`.
- **Never:** send a request with blank `creator` and `title`. Decode or build `pageToken` values.
  Follow URLs from responses outside the allowlist. Commit `.env.local`. Hit the real API in tests.
  Skip or delete failing tests to get green.

## Success Criteria

- [ ] `normalizeSearchInput({ creator: '  ', title: null })` returns `null`, and the hook makes 0
      requests.
- [ ] Every search URL contains `imageAvailable=true`.
- [ ] `searchCollection({ creator: 'Rembrandt', title: 'Nachtwacht' })` returns `total: 1` and the ID
      `https://id.rijksmuseum.nl/200107928` (fixture).
- [ ] `fetchArtwork` for that ID returns `objectNumber: 'SK-C-5'`, the English title, artists
      `['Rembrandt van Rijn']`, date 1642, and the IIIF image and thumbnail URLs.
- [ ] Image or artist failure still gives an `Artwork` with `null` / `[]` in that field.
- [ ] Non-allowlisted ID throws `RijksApiError` with kind `invalid-id`, and no fetch happens.
- [ ] Every failure that reaches a hook is a `RijksApiError` with the `kind` and `retryable` from
      the error table. A cancelled request never shows as an error.
- [ ] `5xx`, `429`, `network` and `timeout` are retried at most 2 times. `4xx`, `parse` and
      `invalid-id` are not retried.
- [ ] First search failure gives `status: 'error'` and `retry()`. `loadMore` failure gives
      `loadMoreError` and keeps the list. Object failure affects only its own item.
- [ ] With one loaded ID page of 100 and a `nextPageToken`: `needsNextApiPage` is false at 100
      visible and true at 110.
- [ ] `useArtworkSearch` shows 10 artworks first. Each `loadMore` adds 10 and keeps the previous
      ones. `loadMore` 1–9 sends no search request. The 10th sends exactly one.
- [ ] A search with 0 results gives `status: 'success'` and `isEmpty: true`. Idle, pending and
      error states give `isEmpty: false`.
- [ ] With 1423 results: after 142 `loadMore` calls, 1423 artworks are listed, the last batch has 3,
      and `hasMore` is false.
- [ ] `pnpm lint`, `pnpm test` (coverage ≥ 90% in `src/api/rijksmuseum`) and `pnpm build` pass.

## Decisions

- No API key. The README no longer asks for `VITE_API_KEY`, and `.env.local.example` is deleted.
- When a search has no results, the UI must show a "no results" message. The API layer exposes
  `isEmpty` for this. The message text and design belong to the UI spec.
- When an image is missing (`imageUrl: null`) or fails to load (`onError`), the UI shows a
  placeholder that says "Image not available". The placeholder design belongs to the UI spec.
- Default title language is English (`en`), with Dutch as fallback.
- `imageAvailable=true` is always sent. `type` is not supported.
- "Load more" button with `useInfiniteQuery`, 10 artworks per click. No page numbers. The API layer
  owns the mapping to the 100-item cursor pages.

## Open Questions

None.
