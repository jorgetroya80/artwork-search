# Spec: Deploy to Render on release

- Created: 2026-10-02
- Status: **approved** (2026-10-02)
- Plan: [PLAN-render-deploy.md](../plans/PLAN-render-deploy.md)
- Depends on: [SPEC-ci-release.md](SPEC-ci-release.md) (implemented)
- Related: [SPEC-docker-image.md](SPEC-docker-image.md) (implemented). Its "Next phases" planned a
  Docker web service on Render. This spec replaces that with a Static Site (see "Decisions").

## Objective

Publish the app on Render as a Static Site, and deploy a new version every time release-please
creates a release. Nothing else deploys.

User: the maintainer of this repository, and anyone who visits the public URL. Success:

- A Render Static Site builds the app from this repository with `pnpm build` and serves `dist/`
  from Render's CDN. Its configuration lives in `render.yaml` (Blueprint).
- When release-please creates release `vX.Y.Z`, a job in `release.yml` tells Render to build and
  deploy the release commit.
- Pushes to `main` without a release, and pull requests, deploy nothing.
- The public URL serves the app with the same caching and security headers as `nginx.conf`, and a
  search returns results.

### Scope

`render.yaml`, one new job in `release.yml` (plus one output of the `release-please` job), one
GitHub secret, the one-time setup in the Render dashboard, and a README section. No change to
`src/`, `package.json`, the Docker image or `nginx.conf`. The Docker image and `docker-publish`
stay as they are, for anyone who wants to run the app with `docker run`.

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
5. `autoDeployTrigger: off` turns off deploys on push. A deploy hook call with `ref=<commit SHA>`
   builds and deploys that commit. (Render docs, checked 2026-10-02: "This method disables
   automatic deploys for the service", which is what this spec wants anyway.)
6. Deploy hook responses (Render docs): `200` deploy started, `202` queued behind another deploy,
   `400` bad parameter, `401` bad key, `404` commit not found in the repository.
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
    autoDeployTrigger: 'off'
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

- **Same behavior as `nginx.conf`.** `index.html` is always revalidated, so a new release is picked
  up. Files under `/assets/` have content hashes, so they are cached for a year. The three
  security headers go on every path.
- **No `routes`.** There is no client-side router, so no SPA rewrite to `index.html`. Unknown
  paths return Render's 404, as in the Docker image.
- **No `plan` or `region`.** They do not apply to Static Sites (assumption 2).
- **`branch: main`.** The release commit is on `main`.
- **`'off'` is quoted.** YAML 1.1 parsers read a bare `off` as the boolean `false`, not the
  string Render expects.

### One-time setup in Render (manual, maintainer)

1. Render dashboard → **New → Blueprint** → connect the GitHub repository → branch `main`. Render
   reads `render.yaml`, creates the static site `artwork-search` and deploys the current `main`.
2. Static site → **Settings → Deploy Hook** → copy the URL
   (`https://api.render.com/deploy/srv-…?key=…`).
3. GitHub → repository → **Settings → Secrets and variables → Actions** → new repository secret
   `RENDER_DEPLOY_HOOK_URL` with that URL.

The hook URL contains a key: anyone with it can start a deploy of this site. It lives only in the
GitHub secret and in Render. If it leaks, regenerate it in Render and update the secret.

## Workflow

### `release-please` job: new output `sha`

```yaml
outputs:
  release_created: ${{ steps.release.outputs.release_created }}
  tag_name: ${{ steps.release.outputs.tag_name }}
  version: ${{ steps.release.outputs.version }}
  sha: ${{ steps.release.outputs.sha }}
```

`sha` is the commit release-please tagged. Only this line changes in that job.

### Job `render-deploy` in `release.yml`

```yaml
render-deploy:
  name: render-deploy
  needs: release-please
  if: needs.release-please.outputs.release_created == 'true'
  runs-on: ubuntu-latest
  timeout-minutes: 5
  permissions: {}
  steps:
    - name: Trigger the Render deploy hook with the release commit
      env:
        DEPLOY_HOOK_URL: ${{ secrets.RENDER_DEPLOY_HOOK_URL }}
        RELEASE_SHA: ${{ needs.release-please.outputs.sha }}
      run: curl --fail-with-body --silent --show-error --get --data-urlencode "ref=$RELEASE_SHA" "$DEPLOY_HOOK_URL"
```

- **Independent from `docker-publish`.** Render builds from the repository, not from the image.
  Both jobs run in parallel after `release-please`. A failure in one does not stop the other.
- **Release commit.** Render builds exactly the tagged commit, not whatever `main` has when the
  build starts.
- **Encoding.** `--get --data-urlencode` appends `&ref=<sha>` to the hook URL, which already has
  `?key=…`.
- **Failure.** `--fail-with-body` makes the step fail on `4xx`/`5xx` (missing secret, `401`, `404`)
  and prints Render's answer. `200` and `202` pass.
- **No secrets in logs.** Actions masks the secret. No `set -x`.
- **No untrusted input in `run:`.** The SHA comes from release-please and the URL from the
  repository secrets. Both reach the shell through `env:`.
- **Permissions `{}`.** The job reads nothing from GitHub. No checkout.
- **Trigger only.** The job ends when Render accepts the deploy. It does not wait for the build. If
  the build fails, Render keeps the previous version live and shows the failure.

## Project Structure

```
render.yaml                       → Blueprint: static site, build, headers, auto-deploy off
.github/workflows/release.yml     → output sha on release-please, add job render-deploy
README.md                         → add "Deploy" section and the live URL
```

## Tech Stack

- Render Static Site (free). Node from `.nvmrc`, pnpm `12.8.1` from `packageManager` via
  Corepack.
- GitHub Actions. No new actions: the job only runs `curl`, preinstalled on `ubuntu-latest`.
- No new npm dependencies.

## Commands

```sh
actionlint .github/workflows/release.yml
pnpm exec prettier --check render.yaml .github/workflows/release.yml README.md
curl -I https://<site>.onrender.com/                          # live app headers
gh run list --workflow release.yml --limit 3                  # release runs
```

## Code Style

- YAML: as in SPEC-ci-release (Prettier, explicit permissions at the lowest level, named jobs). Job
  id `render-deploy` is stable.
- `render.yaml`: only the fields above. Render defaults are not repeated.

## Testing Strategy

No unit tests. The app test suite does not change.

**Local, before merging the PR:**

1. `actionlint` and Prettier pass.
2. A structure check of `release.yml`: `render-deploy` has `needs: release-please`, the
   `release_created` condition, `permissions: {}`, the secret and SHA only in `env:`.
   `release-please` only gains the `sha` output. `docker-publish` does not change.
3. The build command works from a clean clone with `SKIP_INSTALL_DEPS` behavior (no
   `node_modules`): `corepack enable && pnpm install --frozen-lockfile && pnpm build`.
4. `render.yaml` validates in the Render Blueprint preview (setup step 1).

**On Render and GitHub:**

5. After setup step 1, the first build log shows Node `24.18.0` and pnpm `12.8.1`, and the site
   is live.
6. `curl -I https://<site>.onrender.com/` → `200`, `Cache-Control: no-cache`, the three security
   headers. A file under `/assets/` → `Cache-Control: public, max-age=31536000, immutable` and the
   three headers. `/missing` → `404`.
7. A search on the live URL returns results.
8. Merging the PR leads to a release PR. Merging that runs `release-please`, then
   `docker-publish` and `render-deploy`, all green.
9. Render shows a deploy of the release commit started by the hook, and it goes live.
10. A `docs:`-only merge creates no release and skips `render-deploy`. Render shows no new deploy.

## Boundaries

- **Always:** deploy only on release, only the release commit. Keep the hook URL in the GitHub
  secret. Pass secrets and outputs through `env:`. Least privilege `permissions`. Keep the
  headers in `render.yaml` equal to `nginx.conf`.
- **Ask first:** waiting for the deploy to finish (needs a Render API key). A manual
  `workflow_dispatch` deploy or rollback job. Pull request previews. A custom domain. A
  Content-Security-Policy header. SPA rewrites. Changing the pnpm install method (fallback
  `npm install -g pnpm@12.8.1` duplicates the version).
- **Never:** commit the hook URL or any Render key. Turn on deploys for every push to `main`.
  Deploy from a laptop.

## Success Criteria

- [ ] `render.yaml` exists at the root with the static site above.
- [ ] The Render static site `artwork-search` exists from the Blueprint and serves the app on its
      public URL, with the headers of check 6.
- [ ] Secret `RENDER_DEPLOY_HOOK_URL` exists in the repository.
- [ ] `release.yml` has job `render-deploy` as above. `actionlint` passes.
- [ ] A release deploys its commit to Render.
- [ ] A non-release merge deploys nothing.
- [ ] README has a "Deploy" section with the live URL and how releases reach Render.

## Decisions

- Render **Static Site**, not a Docker web service (maintainer's choice, 2026-10-02). Free static
  sites do not spin down (no cold start), are served from a CDN, and the app has no server-side
  code. Cost: production does not run the GHCR image, and the headers in `nginx.conf` are repeated
  in `render.yaml`.
- Trigger: deploy hook with `ref=<release sha>`, stored as a GitHub secret. No Render API key.
- `render-deploy` does not depend on `docker-publish`.
- The job triggers the deploy and does not wait for it.
- The PR is titled `feat: …`: a live site is a new deliverable, and the `feat` title triggers the
  release that verifies `render-deploy` end to end (same as SPEC-docker-image).

## Open Questions

None.
