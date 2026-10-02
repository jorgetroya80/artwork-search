# Spec: Deploy to Render

- Created: 2026-10-02
- Status: **implemented** (2026-10-02), PR #13, release v0.3.0. Approved 2026-10-02. Revised the same day: Render auto-deploy replaces the deploy
  hook (see "Decisions").
- Extension: not-found page, **in progress** (2026-10-02).
- Plan: [PLAN-render-deploy.md](../plans/PLAN-render-deploy.md)
- Depends on: [SPEC-ci-release.md](SPEC-ci-release.md) (implemented)
- Related: [SPEC-docker-image.md](SPEC-docker-image.md) (implemented). Its "Next phases" planned a
  Docker web service on Render, deployed on release. This spec replaces that with a Static Site
  that deploys on every push to `main` (see "Decisions").

## Objective

Publish the app on Render as a Static Site. Render deploys it by itself every time `main` gets a
commit that changes the app and that commit's CI checks pass.

User: the maintainer of this repository, and anyone who visits the public URL. Success:

- A Render Static Site builds the app from this repository with `pnpm build` and serves `dist/`
  from Render's CDN. Its configuration lives in `render.yaml` (Blueprint).
- A push to `main` that changes the app deploys after its GitHub checks pass. A push that only
  changes docs, workflows or other files that do not affect the build deploys nothing. Pull
  requests deploy nothing.
- The public URL serves the app with the same caching and security headers as `nginx.conf`, and a
  search returns results.

### Scope

`render.yaml`, the one-time setup in the Render dashboard, and a README section. No change to the
workflows, `src/`, `package.json`, the Docker image or `nginx.conf`. No GitHub secrets. The Docker
image and `docker-publish` stay as they are, for anyone who wants to run the app with
`docker run`.

### Assumptions

1. The app is a static SPA with no router and no runtime configuration. `pnpm build` writes
   everything to `dist/`, and the build needs no environment variables (SPEC-docker-image,
   assumptions 1–3).
2. Static Sites have no compute plan and no region: Render serves them from a global CDN, with
   Brotli compression and TLS. They are free and do not spin down. They count against the monthly
   free bandwidth and build minutes. (Render docs, checked 2026-10-02.)
3. Render picks the Node version from `.nvmrc` (`v24.18.0`) when neither `NODE_VERSION` nor
   `.node-version` exist (Render docs, checked 2026-10-02).
4. The Render docs do not say how Render picks pnpm or its version. So Render's automatic install
   is turned off (`SKIP_INSTALL_DEPS=true`), and the build command installs with pnpm through
   Corepack, which reads `packageManager` (`pnpm@12.8.1`), the same as the `Dockerfile`.
5. `autoDeployTrigger: checksPass` (Render docs, checked 2026-10-02): Render waits for the
   commit's GitHub checks, including GitHub Actions. A check passes if its conclusion is
   `success`, `neutral` or `skipped`. Render does not deploy if any check fails or if it finds no
   checks. Every push to `main` runs `ci.yml` (`lint`, `test`, `build`) and `release.yml`, so
   there are always checks.
6. `buildFilter.paths` (Render docs, checked 2026-10-02): an auto-deploy happens only if the push
   changes a file that matches one of the globs, relative to the repository root. `*` does not
   cross `/`, `**` does. The docs list `buildFilter` among the Blueprint fields but do not say
   explicitly that Static Sites support it, so this is checked live.
7. The Render docs do not say which rule wins when two header rules set the same header on the
   same path, nor which `Cache-Control` Render sends by default. So no two rules set the same
   header on overlapping paths, and the headers are checked with `curl` on the live site.

## Render service

### `render.yaml`

```yaml
services:
  - type: web
    name: artwork-search
    runtime: static
    branch: main
    buildCommand: corepack enable && pnpm install --frozen-lockfile && pnpm build
    staticPublishPath: ./dist
    autoDeployTrigger: checksPass
    buildFilter:
      paths:
        - src/**
        - public/**
        - index.html
        - package.json
        - pnpm-lock.yaml
        - pnpm-workspace.yaml
        - vite.config.ts
        - tsconfig*.json
        - .nvmrc
        - render.yaml
    envVars:
      - key: SKIP_INSTALL_DEPS
        value: 'true'
    headers:
      - path: /*
        name: X-Content-Type-Options
        value: nosniff
      - path: /*
        name: X-Frame-Options
        value: DENY
      - path: /*
        name: Referrer-Policy
        value: strict-origin-when-cross-origin
      - path: /
        name: Cache-Control
        value: no-cache
      - path: /index.html
        name: Cache-Control
        value: no-cache
      - path: /assets/*
        name: Cache-Control
        value: public, max-age=31536000, immutable
```

- **`checksPass`.** A commit that breaks `lint`, `test` or `build` never reaches production.
- **`buildFilter.paths`.** Every file the build reads: the app source and static files, the
  dependency manifests, the Vite and TypeScript config, the Node version, and `render.yaml`
  itself. A merge that only touches `docs/`, `README.md`, `CHANGELOG.md`, `.github/`, `Dockerfile`
  or lint config deploys nothing. A release PR merge changes `package.json` (version bump), so it
  deploys, with the same app.
- **Same headers as `nginx.conf`.** `index.html` is always revalidated, so a new deploy is picked
  up. Files under `/assets/` have content hashes, so they are cached for a year. The three
  security headers go on every path.
- **No `routes`.** There is no client-side router, so no SPA rewrite to `index.html`. Unknown
  paths return Render's 404, as in the Docker image.
- **No `plan` or `region`.** They do not apply to Static Sites (assumption 2).
- **`'true'` is quoted.** Environment variable values are strings.

### Not-found page

Added 2026-10-02 (maintainer), to resolve the "Headers on 404" follow-up.

- **File.** `public/404.html`. Vite copies `public/` as is, so the build writes `dist/404.html`.
  Render serves `/404.html` for paths that do not exist and match no redirect or rewrite rule
  (Render community forum; the Render docs do not cover it). The response status stays `404`.
- **Headers.** The `/*` rules should then apply to the not-found response, as it is a file Render
  serves. Not documented: checked live with `curl`. If Render still drops them, `render.yaml`
  cannot fix it, and the follow-up stays open.
- **nginx parity.** `nginx.conf` gets `error_page 404 /404.html;` at `server` level, so the Docker
  image serves the same page with status `404`. Its headers do not change (server-level
  `add_header ... always`, `Cache-Control: no-cache` from the `map` default).
- **Self-contained.** One HTML file with inline CSS; the frame, wire and nail are drawn in CSS.
  No JavaScript, no SVG, no web fonts, no images, no
  requests to other origins. Every link and asset path is absolute (`/`, `/favicon.svg`), because the
  page is served at any unknown path, including nested ones like `/a/b`.
- **Design.** Playful and on theme: the artwork is missing. An empty gilded frame hangs slightly
  crooked from a nail on a gallery wall, next to a museum wall label for the missing piece
  ("Untitled (404)", unknown artist, object number in the Rijksmuseum style). One short swing of the
  frame on load, off when `prefers-reduced-motion` is set. The label explains that no page exists
  at this address and links to the search (`/`). Responsive down to phone width, visible keyboard
  focus, text contrast at least WCAG AA.

### App icon

Added with the not-found page (maintainer, 2026-10-02). `public/favicon.svg` replaces Vite's
default `public/vite.svg` in `index.html` and `404.html`: a gilded frame, as on the not-found page,
holding a mountain landscape with a low sun. Readable at 16 px on light and dark tab bars.

### One-time setup in Render (manual, maintainer)

1. Render dashboard → **New → Blueprint** → connect the GitHub repository → branch `main`. Render
   reads `render.yaml`, creates the static site `artwork-search` and deploys the current `main`.

Render needs access to the repository through its GitHub app. Nothing is stored in GitHub.

## Project Structure

```
render.yaml                       → Blueprint: static site, build, auto-deploy rules, headers
public/404.html                   → not-found page (Render and nginx)
public/favicon.svg                → app icon (replaces public/vite.svg)
nginx.conf                        → error_page 404 /404.html
README.md                         → add "Deploy" section (Render Static Site) and the live URL
```

## Tech Stack

- Render Static Site (free). Node from `.nvmrc`, pnpm `12.8.1` from `packageManager` via
  Corepack.
- No new GitHub Actions, workflows or secrets. No new npm dependencies.

## Commands

```sh
pnpm exec prettier --check render.yaml README.md
curl -I https://<site>.onrender.com/                          # live app headers
```

## Code Style

- YAML: Prettier (single quotes, as the project config). Only the fields above; Render defaults
  are not repeated.

## Testing Strategy

No unit tests. The app test suite does not change.

**Local, before merging the PR:**

1. Prettier passes.
2. A check script: `render.yaml` has exactly the fields above, the headers match `nginx.conf`, no
   two rules set the same header on overlapping paths, and every tracked file the build reads
   matches a `buildFilter` path.
3. The build command works from a clean clone (no `node_modules`):
   `corepack enable && pnpm install --frozen-lockfile && pnpm build`.
4. `.github/workflows/` is identical to `main`.
5. `render.yaml` validates in the Render Blueprint preview (setup step 1).

**On Render and GitHub:**

6. After setup step 1, the first build log shows Node `24.18.0` and pnpm `12.8.1`, and the site
   is live.
7. `curl -I https://<site>.onrender.com/` → `200`, `Cache-Control: no-cache`, the three security
   headers. A file under `/assets/` → `Cache-Control: public, max-age=31536000, immutable` and the
   three headers. `/missing` → `404`.
8. A search on the live URL returns results.
9. A merge to `main` that changes a `buildFilter` path deploys, and Render starts the build only
   after the commit's checks finish.
10. A `docs:`-only merge (only files outside `buildFilter`) deploys nothing.

**Not-found page:**

11. A check script: `public/404.html` exists, has `lang`, a `<title>`, a link to `/`, no
    `<script>`, no `http(s)://` or protocol-relative URLs, and only absolute `href`/`src` paths.
    After `pnpm build`, `dist/404.html` equals `public/404.html`.
12. Docker image: `/missing` and `/a/b` → `404` with the page body and the three security headers.
    `/` still serves the app.
13. The page looks right on desktop and phone width (headless browser screenshots), and with
    reduced motion the frame does not move.
14. Live, after the deploy: `/missing` and `/a/b` → `404` with the page body. The
    `X-Frame-Options` and `Referrer-Policy` headers are present, or the follow-up stays open.

## Boundaries

- **Always:** deploy only through Render auto-deploy after checks pass. Keep the headers in
  `render.yaml` equal to `nginx.conf`. Add any new file the build reads to `buildFilter.paths`.
- **Ask first:** deploying only on releases (needs a deploy hook or a release branch). Pull
  request previews. A custom domain. A Content-Security-Policy header. SPA rewrites. Changing the
  pnpm install method (fallback `npm install -g pnpm@12.8.1` duplicates the version). Any
  workflow change for Render.
- **Never:** commit a Render API key or deploy hook URL. Set `autoDeployTrigger: commit` (deploys
  before CI). Deploy from a laptop.

## Success Criteria

- [x] `render.yaml` exists at the root with the static site above.
- [x] The Render static site `artwork-search` exists from the Blueprint and serves the app on its
      public URL, with the headers of check 7. (Exception: Render's own 404 page carries only
      `X-Content-Type-Options`; see "Follow-ups".)
- [x] A merge that changes the app deploys after its checks pass.
- [ ] A merge that changes only files outside `buildFilter` deploys nothing. (Checked on the merge
      of the `docs:` PR that closes this spec; see the plan, T8.)
- [x] The workflows are unchanged and the repository has no Render secret.
- [ ] `/missing` on the live site returns `404` with the custom page, and the three security
      headers (checks 11–14).
- [x] README has a "Deploy" section that says only that the app is deployed on Render as a
      Static Site, with the live URL.

## Decisions

- Render **Static Site**, not a Docker web service (maintainer's choice, 2026-10-02). Free static
  sites do not spin down (no cold start), are served from a CDN, and the app has no server-side
  code. Cost: production does not run the GHCR image, and the headers in `nginx.conf` are repeated
  in `render.yaml`.
- **Render auto-deploy, no deploy hook** (maintainer's choice, 2026-10-02, replacing the first
  version of this spec). No workflow job, no secret. Cost: `main` is production. Every merge that
  changes the app deploys, not only releases, and a deployed version can be newer than the latest
  release tag.
- **`checksPass`**, so CI guards production. Cost: a failing check on `main`, in any workflow,
  blocks the deploy of that commit.
- **`buildFilter`** (maintainer's choice), so docs and CI changes do not rebuild the site. Cost:
  a new file the build reads must be added to the list, or a change to it alone does not deploy.
- The PR is titled `feat: …`: a live site is a new deliverable.

## Follow-ups

- **Headers on 404.** Render's 404 page for unknown paths returns only
  `X-Content-Type-Options: nosniff`; the `X-Frame-Options` and `Referrer-Policy` rules on `/*` are
  not applied to it. nginx sends them on 404 too. Low risk (plain-text page, no app content).
  Being addressed with a custom not-found page (see "Not-found page", 2026-10-02).

## Open Questions

None.
