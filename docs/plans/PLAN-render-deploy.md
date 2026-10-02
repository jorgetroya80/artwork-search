# Plan: Deploy to Render

- Created: 2026-10-02
- Status: **implemented** (2026-10-02), PR #13, release v0.3.0. Revised 2026-10-02 after the spec dropped the deploy hook (see "Design
  change").
- Spec: [SPEC-render-deploy.md](../specs/SPEC-render-deploy.md)

The task list lives in this file. Check off tasks here as they are done.

## Overview

Add the files described in the spec:

- `render.yaml`: a Render Static Site that builds with pnpm through Corepack, publishes `dist/`,
  auto-deploys after the GitHub checks pass when a `buildFilter` path changes, and sends the same
  headers as `nginx.conf`.
- README section "Deploy".

No workflow change and no GitHub secret. No change to `src/`, `package.json`, `Dockerfile` or
`nginx.conf`.

Spec, plan and implementation land in one PR from `feat/render-deploy`, titled
`feat: deploy to Render`. Render reads `render.yaml` from `main`, so the Blueprint is created
after the merge.

Local tools: Docker 29.7.2 and `actionlint` are installed. Nothing new is installed.

## Design change

The first version of the spec deployed only on releases, through a deploy hook called by a
`render-deploy` job in `release.yml`, with the hook URL in a GitHub secret.
T1–T4 were built for it (commits `a235036`, `1952f1a`, `8244410`, `27c0706`). On 2026-10-02 the
maintainer chose Render auto-deploy instead: simpler, no workflow job, no secret, and every merge
that changes the app deploys. T2–T4 are reopened below; T1 still holds.

## Dependency graph

```
T1 clean build (done) ──► T2 render.yaml: checksPass + buildFilter
                          T3 revert the render-deploy job ──┐
                          T2 ───────────────────────────────┼──► T4 README "Deploy"
                                                            ▼
                                     Checkpoint 1: local checks pass, open PR
                                                            │
                                                            ▼
                                     T5 merge PR (no deploy yet: no site)
                                                            │
                                                            ▼
                                     T6 Render Blueprint (maintainer, manual)
                                                            │
                                                            ▼
                                     T7 live checks on the first deploy
                                                            │
                                                            ▼
                                     T8 docs PR: live URL, statuses; no deploy on docs
                                                            │
                                                            ▼
                                     T9 an app change deploys after checks
```

T2 and T3 can run in parallel.

## Architecture decisions

- **Facts from the source, not from memory.** Render behavior checked in the Render docs on
  2026-10-02 (spec, assumptions). Where the docs are silent (header precedence, default
  `Cache-Control`, `buildFilter` on Static Sites, Blueprint sync deploys), the spec avoids relying
  on it and checks it live.
- **Clean-clone build check.** Render runs the build command with `SKIP_INSTALL_DEPS=true`, so
  there is no `node_modules`. T1 ran the same command in a fresh clone.
- **Tests guard drift.** The `render.yaml` check reads the headers from `nginx.conf` and checks
  `buildFilter` against `git ls-files`, so a new build input or a header change in one file shows
  up.
- **Revert, not rewrite history.** T3 uses `git revert` on the branch. The PR is squash-merged, so
  `main` gets one clean commit either way.
- **The live URL is unknown until T6.** Render picks the `onrender.com` subdomain when the site is
  created. The README gets the URL in T8.

## Task list

### Phase 1: Files (local)

- [x] **T1: Verify the clean build**
  - In a fresh clone in the session scratchpad (no `node_modules`), with Node from `.nvmrc`, run
    `corepack enable && pnpm install --frozen-lockfile && pnpm build`.
  - Acceptance: the build passes, pnpm reports `12.8.1`, and `dist/` has `index.html` and
    `assets/`.
  - Verify: the commands above and `ls dist dist/assets`.
  - Files: none (this plan only).
  - Size: XS.
  - Done: 2026-10-02. `git clone` of the repository into the session scratchpad (no
    `node_modules`), Node `v24.18.0`. `corepack enable && pnpm install --frozen-lockfile &&
pnpm build` passes: "Done … using pnpm v12.8.1", `tsc -b` and `vite build` with no errors.
    `dist/` has `index.html`, `vite.svg` and `assets/` (one CSS and one JS file with content
    hashes). The local pnpm store made the install fast; Render starts with an empty store, so
    its first build is slower. Whether `corepack enable` works on Render is checked in T7. (Also
    checked then, for the hook design: `release-please-action` v5.0.0 has output `sha`. No longer
    used.)

- [x] **T2: `render.yaml` with `checksPass` and `buildFilter`**
  - First version (hook design, commit `1952f1a`): `autoDeployTrigger: 'off'`, headers, a check
    script with 24 assertions that reads the headers from `nginx.conf`.
  - Change `autoDeployTrigger` to `checksPass`. Add `buildFilter.paths` as in the spec. Update the
    comments in `render.yaml` (no hook).
  - Update the check script: `autoDeployTrigger == "checksPass"`, `buildFilter` has only `paths`
    with exactly the spec list, and every file from `git ls-files` that the build reads (`src/`,
    `public/`, `index.html`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
    `vite.config.ts`, `tsconfig*.json`, `.nvmrc`) matches a path (`File.fnmatch` with
    `FNM_PATHNAME`, so `*` does not cross `/`, as on Render). Files that must not match:
    `README.md`, `CHANGELOG.md`, `docs/**`, `.github/**`, `Dockerfile`, `nginx.conf`.
  - Acceptance: the updated script fails on the current `render.yaml` and passes after the change.
  - Verify: the script, `pnpm exec prettier --check render.yaml`, and mutations (drop a path,
    `autoDeployTrigger: commit`).
  - Files: `render.yaml`.
  - Size: S.
  - Done: the check script now asserts `checksPass`, a `buildFilter` with only `paths` equal to
    the spec list, that all 66 tracked build inputs match a path and that no tracked file under
    `docs/`, `.github/`, `README.md`, `CHANGELOG.md`, `Dockerfile` or `nginx.conf` does. It
    failed on the hook version (no `buildFilter`, `'off'`) and passes now. Found while testing:
    Ruby's `File.fnmatch` with `FNM_PATHNAME` treats `src/**` as one level, unlike Render, where
    `**` crosses `/`. The script uses its own glob-to-regex (`**` → any, `*` and `?` → no `/`)
    instead. Mutations caught: `commit` instead of `checksPass`, `index.html` or `tsconfig*.json`
    removed, `src/*` instead of `src/**`, `**` (matches docs), a changed header. The script reads
    `RENDER_YAML` to test a mutated copy. The `autoDeployTrigger` comment now explains the deploy
    rule. Prettier passes.

- [x] **T3: Remove the `render-deploy` job**
  - `git revert 8244410` (adds the `sha` output and the `render-deploy` job to `release.yml`).
  - Acceptance: `git diff main -- .github/` is empty (spec check 4).
  - Verify: that diff, and `actionlint .github/workflows/*.yml`.
  - Files: `.github/workflows/release.yml`.
  - Size: XS.
  - Done: before, `git diff main -- .github/` showed the 17 added lines. `git revert --no-commit
8244410` reverted `release.yml` cleanly; it conflicted on this plan (that commit also checked off
    the old T3), resolved by keeping the current plan. Now `git diff main -- .github/` is empty and
    `actionlint` passes on both workflows.

- [x] **T4: README "Deploy"**
  - First version (hook design, commit `27c0706`): `## Deploy` after "Docker", a Render line in
    "Tech stack", a check script with 12 assertions.
  - Rewrite for auto-deploy: Render deploys each push to `main` that changes the app, after the
    GitHub checks pass; docs-only changes do not deploy (`buildFilter`); no hook, no secret.
    "Tech stack": "Render Static Site, deployed on each push to `main`". The live URL stays a
    TODO until T8.
  - Update the check script: mentions `checksPass` or "checks pass", `buildFilter`, `main`; no
    "deploy hook", secret or `render-deploy`.
  - Acceptance: the updated script fails on the current README and passes after the change.
  - Verify: the script, `pnpm exec prettier --check README.md`.
  - Files: `README.md`.
  - Size: XS.
  - Done: the second paragraph of "Deploy" now says Render deploys each push to `main` after the
    checks pass, `buildFilter` skips pushes that only change docs, workflows or other files
    outside it, a failed build keeps the previous version, and pull requests do not deploy. "Tech
    stack": "Render Static Site, deployed on each push to `main`". The check script (13
    assertions) now requires those points and rejects "deploy hook", the hook secret and
    `render-deploy`. It failed on the hook version of the README (6 failures) and passes now. One assertion was too narrow ("does not" missing from
    its negation list) and was fixed. Prettier passes.
  - Revised after review (maintainer, 2026-10-02): the section says only "The app is deployed on
    Render as a Static Site", plus the live URL TODO. The check script now requires exactly that
    sentence; it fails on the previous two-paragraph section and passes now. "Tech stack" keeps
    its Render line.

### Checkpoint 1: Local checks pass, open PR

- [x] T1 build, T2 and T4 check scripts pass. `git diff main -- .github/` is empty.
- [x] `actionlint` and Prettier pass on the changed files.
- [x] `pnpm lint`, `pnpm test` (169 tests) and `pnpm build` pass (unchanged app).
- [x] Spec status **in progress**.
- [x] Review with the user, then push `feat/render-deploy` and open the PR titled
      `feat: deploy to Render`. CI (`lint`, `test`, `build`, `pr-title`) passes.
      PR #13, all four checks green (run 37017205461).

### Phase 2: Render

- [x] **T5: Merge the PR**
  - Squash-merge the PR. No site exists yet, so nothing deploys. release-please opens a release
    PR; it can wait.
  - Acceptance: `main` has `render.yaml`.
  - Files: none by hand.
  - Size: XS.
  - Done: PR #13 squash-merged as `9c72596` (14:09 UTC). CI run 37017862074 and Release run
    37017862001 green; `docker-publish` skipped (no release). release-please opened #14
    `chore(main): release 0.3.0`.

- [x] **T6: Render Blueprint (maintainer)**
  - Spec setup step 1: New → Blueprint from `main`.
  - Acceptance: spec check 5 (Blueprint preview accepts `render.yaml`). The site exists, with
    auto-deploy "After CI checks pass" and the build filter visible in its settings.
  - Files: none.
  - Size: XS.
  - Done: the maintainer created the Blueprint from `main`. Site `artwork-search` at Render. Settings show
    auto-deploy "After CI checks pass" and the build filter.

- [x] **T7: Live checks on the first deploy**
  - Acceptance: spec checks 6, 7 and 8 on the deploy that the Blueprint created.
  - Verify: Render build log (Node `24.18.0`, pnpm `12.8.1`). `curl -I` on `/`, `/index.html`,
    one file under `/assets/` and `/missing`. A search in the browser.
  - If Corepack fails on Render: stop and ask (fallback in the spec's "Ask first"). If a header
    is missing or `Cache-Control` differs: fix `render.yaml` in a `fix:` PR, after asking.
  - Files: none.
  - Size: XS.
  - Done: build log (checked by the maintainer) shows Node `24.18.0` and pnpm `12.8.1`, so
    Corepack works on Render. `curl -I`: `/` and `/index.html` → `200`, `Cache-Control: no-cache`
    and the three security headers; `/assets/index-Cvb7WFEF.js` → `200`,
    `Cache-Control: public, max-age=31536000, immutable`, the three headers, `Content-Encoding: br`
    with `Accept-Encoding: br`. `/missing` → `404`, but with only `X-Content-Type-Options`:
    Render's 404 page does not get the `/*` rules for `X-Frame-Options` and `Referrer-Policy`.
    Recorded as a spec follow-up; the maintainer will handle it later. The Rijksmuseum API
    answers the site's origin with `access-control-allow-origin: *`, and a search in the browser
    returns results (maintainer).

- [ ] **T8: Live URL, no deploy on `docs:`**
  - In a `docs:` PR: the live URL in the README (Deploy section and top of the file), remove "No
    public deployment yet" from the limitations, spec status **implemented**, this plan's status,
    spec success criteria checked.
  - Acceptance: after the merge, Render shows no new deploy (spec check 10).
  - Files: `README.md`, `docs/specs/SPEC-render-deploy.md`, `docs/plans/PLAN-render-deploy.md`.
  - Size: XS.
  - Done after T9 (order swapped so this PR closes the spec with everything else verified): live
    URL at the top of the README and in "Deploy", "No public deployment yet" removed, spec
    **implemented** with the 404 follow-up, this plan **implemented**. `gh secret list` is empty.
    Check 10 happens when this PR merges; it is the one criterion left unchecked in the spec.

- [x] **T9: An app change deploys after checks**
  - Merge the open release PR (close and reopen it first so CI runs). It changes `package.json`,
    a `buildFilter` path.
  - Acceptance: spec check 9. Render's deploy of that commit starts only after its checks
    (`ci.yml`, `release.yml`) finish, and goes live.
  - Verify: Render events (deploy start time) against `gh run list --commit <sha>` (finish times).
  - Files: none by hand.
  - Size: XS.
  - Done: #14 squash-merged as `4aa5f0b` at 14:23:37 UTC (tag `v0.3.0`; changes `package.json`,
    `CHANGELOG.md`, the manifest). Checks on that commit: CI run 37019551518 (`build`, `lint`,
    `test` green, last at 14:24:39) and Release run 37019551669 (`release-please`, and
    `docker-publish` green at 14:25:08, publishing image `0.3.0`). Render shows a deploy of
    `4aa5f0b` starting at 16:25 CEST (14:25 UTC), the minute the last check finished and about
    90 seconds after the push, and it went live. The JS hash did not change, as expected: only
    the version changed.

### Checkpoint 2: Complete

- [x] All spec success criteria are checked, except check 10, which this PR's merge verifies.
- [x] The live URL serves the current `main` (`4aa5f0b`, v0.3.0).

### Phase 3: Not-found page (spec extension, 2026-10-02)

Branch `fix/not-found-page`, one PR titled `feat: add custom 404 page and app icon` (it
also adds the app icon, T11b). It changes `public/`, a `buildFilter` path, so its merge deploys.
The `feat` title leads to a minor release.

- [x] **T10: Check script (RED)**
  - Script in the session scratchpad for spec check 11, plus the `error_page` line in
    `nginx.conf`.
  - Acceptance: it fails before the page exists.
  - Files: none.
  - Size: XS.
  - Done: 17 assertions (doctype, `lang`, title, viewport, link to `/`, "404", no script, no
    absolute or protocol-relative URL, absolute `href`/`src` only, no CSS `@import`/`url()`,
    reduced motion, `:focus-visible`, `error_page` in `nginx.conf`, `dist/404.html` equal to the
    source). Failed with "public/404.html missing".

- [x] **T11: `public/404.html` and `nginx.conf`**
  - The page as in the spec ("Not-found page"). `error_page 404 /404.html;` in `nginx.conf`.
  - Acceptance: spec checks 11, 12 and 13. The `render.yaml` check still passes (headers equal to
    `nginx.conf`).
  - Verify: the T10 script; `pnpm build`; Docker build and `curl` on `/`, `/missing`, `/a/b`;
    headless Chrome screenshots at 1280 and 390 px wide, with and without reduced motion.
  - Files: `public/404.html`, `nginx.conf`.
  - Size: S.
  - Done: an empty gilded frame (CSS gradients and inset shadows) hangs crooked from a nail and
    wire on a slate gallery wall under a soft spotlight, next to a paper wall label:
    "Untitled (404)", "Artist unknown", "Date unknown", "Empty frame, 0 × 0 cm", "SK-A-404", a
    sentence on what happened, and "Search the collection" (`/`). The frame swings once on load
    (2.8 s) and settles at -2°; no motion with reduced motion. System font stack starting with
    Gill Sans, no web fonts. Below 40rem the label goes under the frame. T10 script and the
    `render.yaml` check pass, and `pnpm build` writes an identical `dist/404.html`. Docker:
    `/missing` and `/a/b` → `404` with the page and all four headers (`no-cache` plus the three
    security headers); `/` and `/404.html` → `200`; no nginx errors. Screenshots (headless Chrome)
    at 1280×800 and, through iframes of the local file, at 390 and 320 px wide. The live-site
    iframe attempt showed `X-Frame-Options: DENY` working: the browser refused to frame it.
    Revised after review (maintainer): the wire is CSS too (two half-width boxes, each with a
    diagonal `linear-gradient` line from the frame to the nail), replacing an inline SVG. The
    check script now also rejects `<svg>` and `<img>`.

- [x] **T11b: App icon** (requested by the maintainer before the PR)
  - `public/favicon.svg` as in the spec ("App icon"), linked from `index.html` and
    `public/404.html`; `public/vite.svg` deleted.
  - Verify: `git grep vite.svg` finds only history notes; `dist/` has `favicon.svg` and no
    `vite.svg`; headless Chrome render at 16, 32 and 96 px on light and dark backgrounds.
  - Files: `public/favicon.svg`, `public/vite.svg`, `index.html`, `public/404.html`.
  - Size: XS.
  - Done: a first version switched the glass stroke with `prefers-color-scheme`; on a dark tab bar
    the light lens and stroke merged into a blob. The final version draws a light outline under a
    dark stroke and a translucent lens, readable on both backgrounds at all three sizes.
    Revised after review (maintainer): the frame now holds a painting, a mountain landscape
    with a low gilt sun, still readable at 16 px.
    Second revision (maintainer): magnifying glass removed; the frame is centered and holds the
    landscape. Readable on light and dark backgrounds at 16, 32 and 96 px.

- [x] **Checkpoint 3: review and PR**
  - `pnpm lint`, `pnpm test`, `pnpm build`, Prettier pass. Screenshots reviewed with the user.
  - Push and open the PR. CI passes.

- [ ] **T12: Live check (after merge)**
  - Acceptance: spec check 14. If the headers are present, the follow-up is closed and the spec
    criterion checked in a `docs:` PR; if not, the follow-up stays open with the result.
  - Files: `docs/specs/SPEC-render-deploy.md`, `docs/plans/PLAN-render-deploy.md`.
  - Size: XS.

## Risks and mitigations

| Risk                                                                              | Impact                                       | Mitigation                                                                                                |
| --------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `corepack enable` fails on Render (no write access to the Node install)           | Medium: no build                             | Found in T7. Fallback `npm install -g pnpm@12.8.1`, after asking                                          |
| Render ignores `.nvmrc` or picks another Node                                     | Low                                          | T7 build log. Add a `NODE_VERSION` env var only after asking (duplicates `.nvmrc`)                        |
| Render header precedence or a default `Cache-Control` differs from what we assume | Medium: stale `index.html` after deploy      | No overlapping rules. T7 checks every header with `curl`                                                  |
| Static Sites ignore `buildFilter`                                                 | Low: docs-only merges rebuild the same app   | T8 shows it. If so, accept or ask                                                                         |
| `checksPass` does not wait for checks as documented                               | Medium: a broken commit could deploy         | T9 compares deploy start with check finish times. The Render build runs `tsc -b` and fails on type errors |
| A failing check on `main` (for example `docker-publish`) blocks the deploy        | Low: production stays on the previous commit | Fix the check; the next push deploys. Render can also deploy by hand from the dashboard                   |
| A new build input is not in `buildFilter`                                         | Low: a change to it alone does not deploy    | The T2 check lists build inputs; spec "Always" rule                                                       |
| Release PR checks stay pending (`GITHUB_TOKEN` starts no workflows)               | Low: merge blocked                           | Close and reopen (as in PLAN-ci-release)                                                                  |
| Render does not serve `/404.html` for unknown paths (only a forum source)         | Low: plain 404 stays                         | T12 shows it. Then ask: a rewrite rule cannot keep status `404`                                           |
| Render drops the `/*` headers on the not-found response too                       | Low                                          | T12 shows it. Nothing to change in `render.yaml`; follow-up stays open                                    |
| Free bandwidth or build minutes run out                                           | Low for a portfolio                          | Accepted in the spec                                                                                      |
