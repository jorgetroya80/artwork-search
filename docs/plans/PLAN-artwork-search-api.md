# Plan: Rijksmuseum artwork search — API layer

- Created: 2026-10-01
- Status: **approved** (2026-10-01)
- Spec: [SPEC-artwork-search-api.md](../specs/SPEC-artwork-search-api.md)

The task list lives in this file. Check off tasks here as they are done.

## Overview

Build the data layer in `src/api/rijksmuseum/` described in the spec: input validation, a fetch
wrapper with typed errors, the search and artwork fetchers, JSON-LD parsing, and the
`useArtworkSearch` / `useArtwork` hooks on TanStack Query with "Load more" pagination. No UI work.
Each task ends with green `pnpm lint`, `pnpm test` and `pnpm build`.

## Dependency graph

```
T1 test tooling ──┐
T2 fixtures ──────┤
                  ▼
T3 constants, types, normalize
                  │
                  ▼
T4 errors + fetchJson ───────────────┐
   │                                 │
   ├──► T5 searchCollection          │
   │                                 │
   └──► T6 parse (pure) ──► T7 fetchArtwork
                                     │
T8 pagination (pure, needs T3) ──┐   │
                                 ▼   ▼
                  T9 QueryClient + useArtwork
                                 │
                                 ▼
                  T10 useArtworkSearch (first batch)
                                 │
                                 ▼
                  T11 loadMore
                                 │
                                 ▼
                  T12 public index + coverage gate
```

Can run in parallel: T5 with T6, and T8 at any time after T3.

## Architecture decisions

- **Typed error at one point.** Only `http.ts` creates `RijksApiError`. Every fetcher goes through
  `fetchJson`, so error mapping, timeout, abort handling and the ID allowlist are tested once.
- **Injectable timeout.** `fetchJson` takes `timeoutMs` (default `15_000`). Tests pass a small
  value with a delayed MSW handler. Fake timers do not control `AbortSignal.timeout`, which runs on
  a native timer.
- **Entity cache through an injected fetcher.** `fetchArtwork` takes an internal option
  `fetchEntity(url, signal)`, which defaults to `fetchJson`. The hooks pass a function that calls
  `queryClient.fetchQuery(['rijksmuseum', 'entity', id])`, so a shared artist is fetched once. The
  public signature in the spec stays the same, and `fetchArtwork` stays testable without React.
- **One `QueryClient` factory.** `createQueryClient()` sets the retry policy and stale times from
  the spec. Tests use the same factory with `retryDelay: 0`, so tests run the real policy without
  waiting 1 s / 2 s.
- **`visibleCount` reset without an effect.** State is stored as `{ key, count }`, where `key` is
  the serialized normalized params. When the key does not match, the hook uses the default `count`.
  This works with React Compiler and does not need `useEffect`.
- **Fixtures.** Real API responses for the parse and fetcher tests. A generated search page factory
  (`makeSearchPage(total, pageIndex)`) for hook tests that need 1423 results, so we do not store 15
  real pages.

## Task list

### Phase 1: Foundation

- [x] **T1: Test tooling**
  - Install `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `msw` (dev) and
    `@tanstack/react-query`.
  - Add the `test`, `test:watch` and `test:coverage` scripts. Add a `test` block to
    `vite.config.ts` (import `defineConfig` from `vitest/config`): `environment: 'jsdom'`,
    `setupFiles`, and coverage for `src/api/rijksmuseum/**` with a 90% lines threshold.
  - Add `src/test/setup.ts` (MSW `setupServer`, `onUnhandledRequest: 'error'`, listen / reset /
    close).
  - Write a smoke test: a `fetch` with an `AbortSignal.any([...])` signal to an MSW handler,
    under jsdom. This checks the early risk "jsdom AbortSignal vs Node fetch".
  - Acceptance: `pnpm test` runs the smoke test green. An unhandled request fails a test.
    `pnpm build` and `pnpm lint` pass with test files inside `src`.
  - Verify: `pnpm test && pnpm lint && pnpm build`.
  - Files: `package.json`, `vite.config.ts`, `src/test/setup.ts`, `src/test/smoke.test.ts`.
  - Size: S.
  - Done: jsdom + `AbortSignal.any` + MSW work together, so the main risk is gone. The MSW server
    lives in `src/test/msw/server.ts` so tests can call `server.use`. The `msw` postinstall
    script is denied (`allowBuilds: { msw: false }` in `pnpm-workspace.yaml`). It only copies the
    browser service worker, and tests use `msw/node`.

- [x] **T2: Fixtures**
  - Save real responses in `src/test/fixtures/`, captured with `curl` (exact commands in
    `src/test/fixtures/README.md`):
    - `search-rembrandt-nachtwacht.json`: `creator=Rembrandt&title=Nachtwacht&imageAvailable=true` (1 result).
    - `search-rembrandt-page1.json`: `creator=Rembrandt&imageAvailable=true` (100 IDs + `next`).
    - `search-empty.json`: `title=zzqqxx&imageAvailable=true`.
    - `object-200107928.json` (Night Watch), `person-2103429.json` (Rembrandt),
      `visual-202107928.json`, `digital-500711199912110510799100.json`.
  - Add `makeSearchPage({ total, pageIndex })` in `src/test/msw/factories.ts` to generate pages,
    and default MSW handlers in `src/test/msw/handlers.ts`.
  - Enable `resolveJsonModule` in `tsconfig.app.json` if fixture imports need it.
  - Acceptance: handlers serve the fixtures by URL. The factory gives correct `total`, IDs and
    `next` / no `next` on the last page.
  - Verify: `pnpm test` (factory test), `pnpm build`.
  - Files: `src/test/fixtures/*`, `src/test/msw/handlers.ts`, `src/test/msw/factories.ts`,
    `src/test/msw/factories.test.ts`, maybe `tsconfig.app.json`.
  - Size: S.
  - Done: `tsconfig.app.json` did not need `resolveJsonModule`, because JSON imports already pass
    `pnpm build`. Added `handlers.test.ts`. The default handlers are registered in
    `server.ts`. A search with no fixture answers `404` and an unknown ID answers `400`, like the
    real API. The search handler for generated pages (`pageToken`) is left for T10, when the hook
    tests need it.

- [x] **T3: Constants, types, input normalization**
  - `constants.ts`: base URLs, ID allowlist prefix, AAT IDs, `PAGE_SIZE = 10`,
    `API_PAGE_SIZE = 100`, thumbnail width 400, timeout 15 000 ms.
  - `types.ts`: public types from the spec, plus partial raw Linked Art types.
  - `normalize.ts`: `normalizeSearchInput`.
  - Acceptance: `{ creator: '  ', title: null }` gives `null`. `'  Rembrandt   van  Rijn '` gives
    `'Rembrandt van Rijn'`. One blank field is removed and the other is kept. Case and wildcards
    are unchanged.
  - Verify: `pnpm test normalize`, `pnpm build`.
  - Files: `constants.ts`, `types.ts`, `normalize.ts`, `normalize.test.ts`.
  - Size: S.
  - Done: `types.ts` has only the public types that need no other module. Each raw Linked Art type
    is added by the task that uses it (search in T5, entities in T6), and `ArtworkResult` comes
    with T10, after `RijksApiError` exists (T4). The test helpers in `src/test/msw/` now import
    `SEARCH_URL`, `ENTITY_URL_PREFIX` and `API_PAGE_SIZE` from `constants.ts` instead of copying
    them.

- [x] **T4: `RijksApiError` and `fetchJson`**
  - `errors.ts`: the class with `kind`, `status`, `url`, `retryable`, `cause`.
  - `http.ts`: `fetchJson(url, { signal, timeoutMs, accept })`, with the ID allowlist check, the
    error table from the spec, `detail` in the `http` message, and caller abort rethrown as is (not
    wrapped).
  - Acceptance: every row of the error table has a test (`400` with detail, `404`, `429`, `500`,
    network, timeout, non-JSON, invalid ID with zero requests). A caller abort is not a
    `RijksApiError`.
  - Verify: `pnpm test http`, `pnpm build`.
  - Files: `errors.ts`, `http.ts`, `http.test.ts`.
  - Size: S.
  - Done: the allowlist accepts the entity prefix and `SEARCH_URL?`. It rejects other hosts,
    look-alike hosts (`id.rijksmuseum.nl.evil.com`) and `http://`. `fetchJson` reads the body as
    text inside the same `try` as `fetch`. Because of this, an abort or timeout while the body
    downloads is reported as `timeout` / cancellation, not as `parse`. Coverage of `http.ts` and
    `errors.ts` is 100% lines.

### Checkpoint 1: Foundation

- [x] `pnpm lint`, `pnpm test` and `pnpm build` pass.
- [x] jsdom + `AbortSignal.any` + MSW work together (T1 smoke test). If not, decide the fallback
      before T5 (see Risks).
- [x] Review with the user.

### Phase 2: Fetchers

- [x] **T5: `searchCollection`**
  - Builds the URL with `URLSearchParams`, always adds `imageAvailable=true`, and adds `pageToken`
    when given. Maps the response to `SearchPage`. Reads `nextPageToken` from `next.id`. Checks the
    response shape (`parse` error).
  - Acceptance: the Rembrandt + Nachtwacht fixture gives `total: 1` and ID
    `https://id.rijksmuseum.nl/200107928`. The empty fixture gives `total: 0`, `ids: []`,
    `nextPageToken: null`. Page 1 gives the token from `next.id`. Each request URL contains
    `imageAvailable=true` and no other parameters.
  - Verify: `pnpm test search`, `pnpm build`.
  - Files: `search.ts`, `search.test.ts`.
  - Size: S.
  - Done: the shape check (`parse` error) lives in `search.ts`, because only the fetcher knows the
    expected shape. The spec "Error handling" section now says so. Checked against the real API:
    `URLSearchParams` encodes spaces as `+`, and the API accepts it (`Rembrandt+van+Rijn` and
    `Rembrandt%20van%20Rijn` both return 1423). The token is read with `URL.parse`, so a broken
    `next.id` gives `nextPageToken: null` instead of an exception.

- [ ] **T6: JSON-LD parsing (pure)**
  - `parse.ts`: `pickTitle`, `pickObjectNumber`, `pickDateRange`, `pickArtistIds`,
    `pickArtistName`, `pickVisualItemIds`, `pickDigitalObjectIds`, `pickImageUrl`, `toThumbnailUrl`.
  - Acceptance: with the Night Watch fixture, the English short title, `SK-C-5`, 1642 dates, artist
    ID `2103429`, and the IIIF URLs are correct. Each title fallback step and the comma-free artist
    name rule have a test. An object with missing fields gives `null` / `[]` and never throws.
  - Verify: `pnpm test parse`, `pnpm build`.
  - Files: `parse.ts`, `parse.test.ts`.
  - Size: S.

- [ ] **T7: `fetchArtwork`**
  - Fetches the object, then resolves artists and the image chain in parallel with
    `Promise.allSettled`. Takes the internal `fetchEntity` option.
  - Acceptance: the Night Watch result matches the spec success criterion. An artist `500` gives
    `artists: []`. A visual item or digital object `500` gives `imageUrl: null`. An object `500`
    rejects with `RijksApiError`. A shared artist goes through `fetchEntity` once per ID.
  - Verify: `pnpm test artwork`, `pnpm build`.
  - Files: `artwork.ts`, `artwork.test.ts`.
  - Size: S.

### Checkpoint 2: Fetchers

- [ ] `pnpm lint`, `pnpm test` and `pnpm build` pass.
- [ ] Manual check: call `searchCollection` and `fetchArtwork` against the real API once (dev
      console or a temporary script, not committed) and compare with the fixtures.
- [ ] Review with the user.

### Phase 3: Hooks

- [ ] **T8: Pagination helpers (pure)**
  - `pagination.ts`: `getVisibleIds`, `needsNextApiPage`.
  - Acceptance: tests at 10, 100 and 110 visible, across 2 pages, on the last partial batch (1423 →
    3), and with total 0. With 100 IDs loaded plus a token, `needsNextApiPage` is false at 100 and
    true at 110.
  - Verify: `pnpm test pagination`.
  - Files: `pagination.ts`, `pagination.test.ts`.
  - Size: XS.

- [ ] **T9: `QueryClient`, query keys, `useArtwork`**
  - `queryClient.ts`: `createQueryClient()` with the retry policy (`error.retryable && count < 2`)
    and default stale times.
  - `queries.ts`: query key factory, entity fetcher on `fetchQuery`, `useArtwork`.
  - `src/test/render.tsx`: `renderHookWithClient` helper (new client per test, `retryDelay: 0`).
  - `main.tsx`: wrap `<App>` in `QueryClientProvider`.
  - Acceptance: `useArtwork` resolves the Night Watch. A `500` is retried 2 times and then becomes
    an error. A `400` is not retried. Two artworks with the same artist give one artist request.
  - Verify: `pnpm test queries`, `pnpm build`, and `pnpm start` shows the app without console
    errors.
  - Files: `queryClient.ts`, `queries.ts`, `queries.test.tsx`, `src/test/render.tsx`, `src/main.tsx`.
  - Size: M.

- [ ] **T10: `useArtworkSearch`, first batch**
  - Idle state for `null` input. `useInfiniteQuery` for the search. `useQueries` for the visible
    IDs. Maps the result to `ArtworkResult[]` with item `retry`. Sets `total`, `isEmpty`, `error`,
    `retry`.
  - Acceptance: blank input gives `status: 'idle'` and zero requests. The first load gives 10
    artworks. Zero results give `isEmpty: true`. `isEmpty` is false when idle, pending or in error.
    A first search `500` gives `status: 'error'` after 2 retries, and `retry()` recovers. One failed
    object gives one item error while the others succeed. An input change cancels the old search.
  - Verify: `pnpm test queries`, `pnpm build`.
  - Files: `queries.ts`, `queries.test.tsx`, `src/test/msw/handlers.ts`.
  - Size: S.

- [ ] **T11: `loadMore`**
  - `{ key, count }` state, `loadMore`, `hasMore`, `isLoadingMore`, `loadMoreError`.
  - Acceptance: `loadMore` 1–9 times sends no new search request. The 10th sends exactly one. Loaded
    artworks stay in the list. A double `loadMore` during a fetch adds one batch. With 1423 results,
    142 calls list 1423 artworks, the last batch has 3, and `hasMore` is false. A failed next page
    sets `loadMoreError`, keeps the list and keeps `visibleCount`. The next call retries and clears
    the error. An input change resets to 10.
  - Verify: `pnpm test queries`, `pnpm build`.
  - Files: `queries.ts`, `queries.test.tsx`.
  - Size: S.

- [ ] **T12: Public index and coverage gate**
  - `index.ts` exports only the spec interface. Nothing else imports internal files from outside
    `src/api/rijksmuseum`.
  - README: document `pnpm test`, `pnpm test:watch`, `pnpm test:coverage`.
  - Spec: set status to "implemented" and check the success criteria.
  - Acceptance: `pnpm test:coverage` is ≥ 90% lines for `src/api/rijksmuseum/**`. Every spec
    success criterion maps to a passing test.
  - Verify: `pnpm lint && pnpm test:coverage && pnpm build`.
  - Files: `index.ts`, `README.md`, `docs/specs/SPEC-artwork-search-api.md`.
  - Size: XS.

### Checkpoint 3: Complete

- [ ] All spec success criteria are checked.
- [ ] `pnpm lint`, `pnpm test:coverage` and `pnpm build` pass.
- [ ] Review with the user, then open the PR from `feat-build-api`.

## Risks and mitigations

| Risk                                                                                                     | Impact                                 | Mitigation                                                                                                                             |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| jsdom `AbortSignal` is not accepted by Node `fetch` (`Expected signal to be an instance of AbortSignal`) | High: blocks every fetcher test        | T1 smoke test catches it first. Fallback: `// @vitest-environment node` in non-React tests, or `happy-dom` (ask first: new dependency) |
| `AbortSignal.timeout` not controlled by fake timers                                                      | Medium: slow or flaky timeout tests    | Injectable `timeoutMs`, a small value in tests, and a delayed MSW handler                                                              |
| TanStack retry backoff (1 s, 2 s) slows hook tests                                                       | Medium                                 | Test client with `retryDelay: 0` and the same `retry` function                                                                         |
| React Compiler and the `visibleCount` reset                                                              | Medium: stale count after a new search | `{ key, count }` state derived during render. A test for input change                                                                  |
| pnpm `minimumReleaseAge` (10 days) blocks the newest versions                                            | Low                                    | Use the newest version it allows                                                                                                       |
| TypeScript 6 vs Vitest / TanStack types                                                                  | Low                                    | Checked in T1 with `pnpm build`                                                                                                        |
| Real API shape changes after the fixtures were captured                                                  | Low                                    | Manual check at Checkpoint 2. Fixture README with the capture commands                                                                 |

## Open questions

None.
