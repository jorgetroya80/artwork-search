# Spec: Docker image published to GHCR

- Created: 2026-10-02
- Status: **implemented** (2026-10-02), PR #10, release v0.2.0
- Plan: [PLAN-docker-image.md](../plans/PLAN-docker-image.md)
- Depends on: [SPEC-ci-release.md](SPEC-ci-release.md) (implemented)

## Objective

Package the app as a Docker image and publish it to the GitHub Container Registry (GHCR) every
time release-please creates a release.

User: the maintainer of this repository, and anyone who wants to run the app with one
`docker run`. Success:

- `docker build` at the repository root produces a small image that serves the app with nginx,
  running as a non-root user, on a port set by the `PORT` environment variable.
- When release-please creates release `vX.Y.Z`, a job in `release.yml` builds the image from that
  release commit and pushes it to `ghcr.io/jorgetroya80/artwork-search` for `linux/amd64` and
  `linux/arm64`.
- The package is public. Anyone can pull it without logging in.

### Scope

This spec covers **the image and its publication only**. No deploy. Render is a later phase (see
"Next phases"). The image is designed so that phase needs no changes to it (`PORT`, non-root).

### Assumptions

1. The app is a static SPA. `pnpm build` writes everything it needs to `dist/`. No server-side
   code, no runtime configuration.
2. The build needs no environment variables. Verified 2026-10-02: no `VITE_*`,
   `import.meta.env` or `process.env` in `src/`, `vite.config.ts`, `index.html` or the
   workflows. API URLs and page sizes are constants in `src/api/rijksmuseum/constants.ts`, and the
   API needs no key. The leftover `.env.local` was deleted.
3. No client-side router. Every page is `/`.
4. Repository and package names: `jorgetroya80/artwork-search` →
   `ghcr.io/jorgetroya80/artwork-search` (GHCR requires lowercase).
5. Node `24.18.0` from `.nvmrc`. pnpm `12.8.1` from `packageManager`, activated with Corepack
   (bundled with Node 24).
6. Images are built only on release. Pull requests do not build the image (decided by the
   maintainer, see "Decisions").

## Image

### Multi-stage build

| Stage   | Base                                                                  | Platform             | Does                                           |
| ------- | --------------------------------------------------------------------- | -------------------- | ---------------------------------------------- |
| `build` | `node:24.18.0-alpine`                                                 | `$BUILDPLATFORM`     | `pnpm install --frozen-lockfile`, `pnpm build` |
| final   | `nginxinc/nginx-unprivileged:alpine` (version pinned, see Tech Stack) | each target platform | copies `dist/` and the nginx template          |

`dist/` is the same for every CPU architecture, so the `build` stage runs once, natively, on the
runner (`--platform=$BUILDPLATFORM`). The final stage has no `RUN` steps, only `COPY`, so building
the `arm64` variant needs no QEMU emulation.

### `Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1

# Keep in sync with .nvmrc
FROM --platform=$BUILDPLATFORM node:24.18.0-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginxinc/nginx-unprivileged:<X.Y.Z>-alpine
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
```

Manifests are copied before the source, so the dependency layer is reused while only `src/`
changes.

### `nginx.conf`

The nginx image renders `/etc/nginx/templates/*.template` with `envsubst` at startup and writes
the result to `/etc/nginx/conf.d/`. It only substitutes variables that exist in the environment,
so `${PORT}` is replaced and nginx variables like `$uri` are left alone.

Requirements:

- `listen ${PORT};`
- `root /usr/share/nginx/html;`
- `/` → `try_files $uri $uri/ =404;`. No SPA fallback to `index.html`: there is no router, so
  unknown paths return 404.
- `index.html`: `Cache-Control: no-cache` (always revalidated, so a new release is picked up).
- `/assets/` (Vite output with content hashes): `Cache-Control: public, max-age=31536000,
immutable`.
- `gzip on` and `gzip_vary on` (`Vary: Accept-Encoding` for caches) for `text/css`, `application/javascript`, `application/json`, `image/svg+xml`.
- `server_tokens off`.
- Security headers on every response: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

nginx does not inherit `add_header` from `server` into a `location` that has its own
`add_header`. So every `add_header` lives at `server` level, with `always` (headers also on
`404`), and `Cache-Control` takes its value from a `map $uri $cache_control` (the template is
included in the `http` block, where `map` is allowed). No `location` has its own `add_header`.

### `.dockerignore`

```
node_modules
dist
coverage
.git
.github
.husky
.claude
docs
.env*
.DS_Store
```

`node_modules` from macOS would overwrite the Linux install. `.env*` keeps any local env file out
of the build context and the image, in case one is added later.

### Non-root

`nginxinc/nginx-unprivileged` runs every nginx process as UID 101. It cannot bind ports below
1024, so the default is `8080`. If nginx is compromised, the attacker has no root inside the
container. The risk is low for a static site; this is defense in depth (CIS Docker Benchmark 4.1),
at no cost to this app.

## Publication

### Job `docker-publish` in `.github/workflows/release.yml`

Runs after `release-please`, only when it created a release:

```yaml
docker-publish:
  name: docker-publish
  needs: release-please
  if: needs.release-please.outputs.release_created == 'true'
  runs-on: ubuntu-latest
  timeout-minutes: 20
  permissions:
    contents: read
    packages: write
  steps:
    - uses: actions/checkout@vN
      with:
        ref: ${{ needs.release-please.outputs.tag_name }}
    - uses: docker/setup-buildx-action@<sha> # vX.Y.Z
    - uses: docker/login-action@<sha> # vX.Y.Z
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    - id: meta
      uses: docker/metadata-action@<sha> # vX.Y.Z
      with:
        images: ghcr.io/jorgetroya80/artwork-search
        tags: |
          type=semver,pattern={{version}},value=${{ needs.release-please.outputs.tag_name }}
          type=semver,pattern={{major}}.{{minor}},value=${{ needs.release-please.outputs.tag_name }}
          type=raw,value=latest
    - uses: docker/build-push-action@<sha> # vX.Y.Z
      with:
        context: .
        platforms: linux/amd64,linux/arm64
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
```

- **Tags.** Release `v0.2.0` → `0.2.0`, `0.2`, `latest`. No `v` prefix (Docker convention).
  `type=raw` is needed for `latest` because the workflow runs on `push` to `main`, not on a tag
  event, so `metadata-action` does not add `latest` on its own.
- **Labels.** `metadata-action` adds the OCI labels, including
  `org.opencontainers.image.source`, which links the package to the repository on GitHub.
- **Token.** `GITHUB_TOKEN` with `packages: write`. No PAT.
- **No build cache.** Releases are rare; a cold build is acceptable.
- **Provenance.** `build-push-action` defaults (minimal provenance attestation) stay as they are.

### Repository settings (manual, one time)

After the first publish, in GitHub → Packages → `artwork-search` → Package settings:

1. Change visibility to **Public**. New packages start private.
2. Check that the package is linked to the `artwork-search` repository and that the repository
   has **write** access under "Manage Actions access", so later releases can push.

## Project Structure

```
Dockerfile                        → multi-stage build (node → nginx-unprivileged)
nginx.conf                        → nginx server template (envsubst on PORT)
.dockerignore                     → build context exclusions
.github/workflows/release.yml     → add job docker-publish
README.md                         → add "Docker" section (build, run, pull from GHCR)
```

No changes to `src/` or `package.json`.

## Tech Stack

- Docker with BuildKit (Buildx). Locally: Docker Desktop or OrbStack.
- Base images, pinned to an exact version tag (no digest):
  - `node:24.18.0-alpine`, same version as `.nvmrc`. Updated together.
  - `nginxinc/nginx-unprivileged:<X.Y.Z>-alpine`, latest stable at implementation time.
- GitHub Actions, pinned by the rule in SPEC-ci-release:

| Action                       | Owner       | Reference                         |
| ---------------------------- | ----------- | --------------------------------- |
| `actions/checkout`           | GitHub      | major tag (`@vN`)                 |
| `docker/setup-buildx-action` | third party | full commit SHA + version comment |
| `docker/login-action`        | third party | full commit SHA + version comment |
| `docker/metadata-action`     | third party | full commit SHA + version comment |
| `docker/build-push-action`   | third party | full commit SHA + version comment |

The implementer uses the latest major of each action. No new npm dependencies.

## Commands

```sh
docker build -t artwork-search .                              # build for the local platform
docker run --rm -p 8080:8080 artwork-search                   # serve on http://localhost:8080
docker run --rm -p 9000:9000 -e PORT=9000 artwork-search      # other port
docker pull ghcr.io/jorgetroya80/artwork-search:latest        # published image
docker buildx imagetools inspect ghcr.io/jorgetroya80/artwork-search:latest   # list platforms
```

Optional local check (not a project dependency):

```sh
actionlint                       # workflow syntax
```

## Code Style

- Dockerfile: one instruction per line, stages named in lowercase (`build`), a comment only
  where the reason is not obvious (Node version sync with `.nvmrc`).
- nginx config: two-space indent, one directive per line.
- YAML: as in SPEC-ci-release (Prettier, explicit permissions at the lowest level, named jobs).
  Job id `docker-publish` is stable.

## Testing Strategy

No unit tests. The app test suite does not change. Verification:

**Local, before merging the PR** (CI does not build the image):

1. `docker build -t artwork-search .` succeeds from a clean clone (no `node_modules`, no
   `.env*` files).
2. `docker run --rm -p 8080:8080 artwork-search` → http://localhost:8080 shows the app, and a
   search returns results.
3. `curl -I http://localhost:8080/` → `200`, `Cache-Control: no-cache`, the three security
   headers, no nginx version in `Server`.
4. `curl -I` on a file under `/assets/` → `Cache-Control: public, max-age=31536000, immutable`.
5. `curl -I http://localhost:8080/missing` → `404`.
6. `-e PORT=9000 -p 9000:9000` → the app answers on port 9000.
7. `docker run --rm --entrypoint id artwork-search` → `uid=101`.
8. `docker images artwork-search` → under 50 MB.
9. `docker run --rm --entrypoint ls artwork-search /usr/share/nginx/html` shows no `.env*` file.

**On GitHub, after merging:**

10. The PR is titled `feat: …` (see "Decisions"), so merging it leads to a release PR. Merging
    the release PR runs `docker-publish`, which succeeds.
11. `docker buildx imagetools inspect ghcr.io/jorgetroya80/artwork-search:<version>` lists
    `linux/amd64` and `linux/arm64`. Tags `<version>`, `<major>.<minor>` and `latest` exist.
12. After the package is made public: `docker logout ghcr.io && docker pull
ghcr.io/jorgetroya80/artwork-search:latest` works.
13. A `docs:`-only merge creates no release and does not run `docker-publish`.

## Boundaries

- **Always:** build from the release commit (`tag_name`). Keep the Node version equal to
  `.nvmrc`. Keep `.env*` out of the build context. Least-privilege `permissions` on the job. Pin
  third-party actions to a full commit SHA. Run the local checks 1–9 before merging any PR that
  touches `Dockerfile`, `nginx.conf` or `.dockerignore`.
- **Ask first:** a Docker build job on pull requests. Build cache (`type=gha`). Digest-pinned base
  images. Dependabot for Docker images. A `HEALTHCHECK`. A Content-Security-Policy header. Image
  signing (cosign) or SBOM. Other registries (Docker Hub). More platforms. `RUN` steps in the
  final stage (they need QEMU for `arm64`). Any change to `src/` or `package.json`. Any deploy.
- **Never:** copy `.env*` or secrets into the image or pass them as build args. Run the container
  as root. Push images from a laptop. Publish images for non-release commits. Overwrite an
  existing version tag by hand.

## Success Criteria

- [x] `Dockerfile`, `nginx.conf` and `.dockerignore` exist at the root.
- [x] Local checks 1–9 pass. (Check 2: page and bundle served, API allows any origin; a search
      in the browser was not confirmed.)
- [x] `release.yml` has job `docker-publish` with `needs: release-please`, the
      `release_created` condition and only `contents: read` and `packages: write`. `actionlint`
      passes.
- [x] Every third-party `uses:` is pinned to a 40-character SHA with a version comment.
- [x] A release publishes `ghcr.io/jorgetroya80/artwork-search` with tags `X.Y.Z`, `X.Y`,
      `latest`, for `linux/amd64` and `linux/arm64`.
- [x] The package is public and linked to the repository. Anonymous `docker pull` works.
- [x] A non-release merge does not run `docker-publish`.
- [x] README has a "Docker" section: build and run locally, pull from GHCR, `PORT`.

## Decisions

- Image: multi-stage, Node stage on the build platform, final stage
  `nginxinc/nginx-unprivileged:alpine` (non-root, port 8080).
- Port set by `PORT` (default `8080`) through the nginx template.
- No SPA fallback: unknown paths return 404.
- Publish only on release, to GHCR, public, tags `X.Y.Z`, `X.Y`, `latest`.
- Platforms `linux/amd64` and `linux/arm64`.
- No image build on pull requests (maintainer's choice). Risk: a broken `Dockerfile` is found at
  release time. Mitigated by the local checks before merge.
- The PR that adds the image is titled `feat: …`: a published image is a new deliverable, and the
  `feat` title triggers the release that verifies `docker-publish` end to end.
- Docker publication and deploy are decoupled. Render does not use this job.

## Next phases (out of scope here)

**Deploy to Render.** Already decided by the maintainer:

- Render Docker **Web Service**, plan **Free**, region **Frankfurt**.
- Production deploys only when a release is created, not on every push. Render auto-deploy off.
- Configuration as code in `render.yaml` (Blueprint).
- Independent from `docker-publish`. Two options for that spec: Render builds the `Dockerfile`
  from the release commit (deploy hook with `ref=<sha>`), or pulls the GHCR image (deploy hook
  with `imgURL=ghcr.io/...:<version>`). Both need the hook URL as a GitHub secret.

**Image updates.** Dependabot for the `docker` ecosystem to bump base images.

## Open Questions

None.
