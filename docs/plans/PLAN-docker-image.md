# Plan: Docker image published to GHCR

- Created: 2026-10-02
- Status: **approved** (2026-10-02), not started
- Spec: [SPEC-docker-image.md](../specs/SPEC-docker-image.md)

The task list lives in this file. Check off tasks here as they are done.

## Overview

Add the files described in the spec:

- `Dockerfile`, `nginx.conf`, `.dockerignore`: a multi-stage image that serves `dist/` with
  `nginx-unprivileged` on `PORT` (default `8080`).
- Job `docker-publish` in `release.yml`: on release, build for `linux/amd64` and `linux/arm64`
  and push to `ghcr.io/jorgetroya80/artwork-search` with tags `X.Y.Z`, `X.Y`, `latest`.
- README section "Docker".

Spec, plan and implementation land in one PR. The branch `docs/docker-image-spec` is renamed to
`feat/docker-image` before T2. The PR is titled `feat: publish Docker image to GHCR`, so its
merge leads to release `0.2.0`, which runs `docker-publish` for the first time. Part of the
verification can only happen on GitHub after that release. Making the package public is a manual
step for the maintainer.

No change to `src/`, `package.json` or `vite.config.ts`.

Local tools: Docker 29.7.2 (arm64) and `actionlint` are installed. Nothing new is installed.

## Dependency graph

```
T1 resolve versions and SHAs ──┬──► T2 Dockerfile + .dockerignore + minimal nginx.conf
                               │              │
                               │              ▼
                               │    T3 nginx.conf: caching, gzip, headers
                               │              │
                               └──► T4 docker-publish job ◄┘ (needs a working image)
                                              │
                                              ▼
                                    T5 README "Docker"
                                              │
                                              ▼
                        Checkpoint 1: local checks pass, open PR
                                              │
                                              ▼
                        T6 merge, release PR 0.2.0, merge, docker-publish runs
                                              │
                                              ▼
                        T7 package public (maintainer, manual), anonymous pull
                                              │
                                              ▼
                        T8 docs-only merge runs no docker-publish, spec status
```

Can run in parallel: T3 with the YAML part of T4. T4's multi-platform build check needs T2.

## Architecture decisions

- **Versions resolved from the source, not from memory.** Action SHAs with the `gh` commands
  from PLAN-ci-release (T1). Base image tags checked on Docker Hub with
  `docker buildx imagetools inspect <image>:<tag>`, which also shows that both `amd64` and
  `arm64` exist.
- **Thin vertical slice first.** T2 produces a runnable image with the smallest `nginx.conf`
  (`listen`, `root`, `try_files`). T3 adds caching and headers on top. If T3 goes wrong, T2 still
  works.
- **Local multi-platform build before publishing.** `docker buildx build --platform
linux/amd64,linux/arm64 .` without `--push` checks on the Mac (arm64) that the `amd64` variant
  builds without QEMU. That is the opposite direction of the runner (amd64 building arm64), and
  the same property: the final stage has only `COPY`.
- **pnpm through Corepack.** `corepack enable` reads `packageManager` (`pnpm@12.8.1`) and
  downloads pnpm during the build. Fallback if Corepack fails in the container:
  `npm install -g pnpm@12.8.1`. Not a spec change, but asked first because it duplicates the
  version.
- **Build from the release commit.** `actions/checkout` with
  `ref: ${{ needs.release-please.outputs.tag_name }}`. `tag_name` is `vX.Y.Z`;
  `metadata-action` strips the `v` (`{{version}}` → `X.Y.Z`, verified 2026-10-02 in its README).
- **No untrusted input in `run:`.** The job has no `run:` steps. `tag_name` comes from
  release-please, and is only passed to action inputs.

## Task list

### Phase 1: Files (local)

- [ ] **T1: Resolve versions and SHAs**
  - Action SHAs for `docker/setup-buildx-action`, `docker/login-action`,
    `docker/metadata-action`, `docker/build-push-action` (latest major of each), and the current
    major tag of `actions/checkout` (already `@v7` in the repo).
  - Latest stable `nginxinc/nginx-unprivileged:<X.Y.Z>-alpine` tag.
  - `node:24.18.0-alpine` exists.
  - Check each action README for the inputs used in the spec (`registry`, `username`,
    `password`, `images`, `tags`, `context`, `platforms`, `push`, `labels`).
  - Acceptance: a list of `action@sha # vX.Y.Z` lines and the two image tags, in this task's
    "Done" note.
  - Verify: each SHA is 40 hex characters and `gh api repos/<repo>/commits/<sha>` returns it.
    `docker buildx imagetools inspect` lists `linux/amd64` and `linux/arm64` for both images.
  - Files: none (this plan only).
  - Size: XS.

- [ ] **T2: Runnable image**
  - Rename the branch: `git branch -m feat/docker-image`.
  - `Dockerfile` and `.dockerignore` as in the spec, with the base image tags from T1.
  - Minimal `nginx.conf`: `listen ${PORT};`, `root /usr/share/nginx/html;`,
    `location / { try_files $uri $uri/ =404; }`.
  - Acceptance: spec local checks 1, 2, 5, 6, 7, 8, 9 pass.
  - Verify: in a fresh clone in the session scratchpad (no `node_modules`, no `.env*`):
    `docker build -t artwork-search .`, then the `docker run` / `curl` commands of those checks.
  - Files: `Dockerfile`, `.dockerignore`, `nginx.conf`.
  - Size: S.

- [ ] **T3: nginx caching, gzip and headers**
  - `index.html` → `Cache-Control: no-cache`. `/assets/` →
    `Cache-Control: public, max-age=31536000, immutable`.
  - `gzip on` for the four types in the spec. `server_tokens off`.
  - The three security headers on every response, including `/assets/` and `index.html`
    (`add_header` is not inherited into a `location` with its own `add_header`).
  - Acceptance: spec local checks 3 and 4 pass. Check 5 (404) still passes.
  - Verify: rebuild, then `curl -I` on `/`, `/index.html`, one file under `/assets/` and
    `/missing`. `curl -sI -H 'Accept-Encoding: gzip'` on the JS file shows
    `Content-Encoding: gzip`.
  - Files: `nginx.conf`.
  - Size: S.

- [ ] **T4: `docker-publish` job**
  - Add the job from the spec to `release.yml`, with the SHAs from T1.
  - Job-level `permissions: contents: read, packages: write`. `timeout-minutes: 20`.
  - Acceptance: `needs: release-please`, `if` on `release_created == 'true'`, tags and
    platforms as in the spec. The `release-please` job does not change.
  - Verify: `actionlint .github/workflows/release.yml`,
    `pnpm exec prettier --check .github/workflows/release.yml`, the SHA grep from
    PLAN-ci-release Checkpoint 1, and locally
    `docker buildx build --platform linux/amd64,linux/arm64 .` (no push) succeeds.
  - Files: `.github/workflows/release.yml`.
  - Size: S.

- [ ] **T5: README "Docker"**
  - Build and run locally, `PORT`, pull from GHCR, available tags, platforms. Note that images
    are published only on release.
  - Acceptance: the commands in the section are the ones in the spec's "Commands" and work as
    written (the GHCR pull only after T7).
  - Verify: `pnpm exec prettier --check README.md`.
  - Files: `README.md`.
  - Size: XS.

### Checkpoint 1: Local checks pass, open PR

- [ ] Spec local checks 1–9 pass on the final files.
- [ ] `actionlint` and Prettier pass.
- [ ] `pnpm lint`, `pnpm test` and `pnpm build` pass (unchanged app).
- [ ] Spec status set to **in progress** and this plan to **in progress**.
- [ ] Review with the user, then push `feat/docker-image` and open the PR titled
      `feat: publish Docker image to GHCR`. CI (`lint`, `test`, `build`, `pr-title`) passes.

### Phase 2: First publication

- [ ] **T6: Release 0.2.0 and `docker-publish`**
  - Squash-merge the PR. `release.yml` opens `chore(main): release 0.2.0`. Its changelog lists
    the `feat` entry.
  - Close and reopen the release PR so CI runs, then squash-merge it.
  - `docker-publish` runs after `release-please` and succeeds.
  - Acceptance: spec checks 10 and 11. `docker buildx imagetools inspect
ghcr.io/jorgetroya80/artwork-search:0.2.0` lists both platforms. Tags `0.2.0`, `0.2` and
    `latest` point to the same digest.
  - Files: none by hand.
  - Size: XS.

- [ ] **T7: Package settings (maintainer)**
  - In GitHub → Packages → `artwork-search` → Package settings: visibility **Public**. Check the
    repository link and that `artwork-search` has **write** under "Manage Actions access".
  - Acceptance: spec check 12. `docker logout ghcr.io`, then
    `docker pull ghcr.io/jorgetroya80/artwork-search:latest` and `docker run` of it serve the
    app.
  - Files: none.
  - Size: XS.

- [ ] **T8: No publish for `docs:`, close the spec**
  - In a `docs:` PR: set the spec status to **implemented**, set this plan's status, and check
    off the spec success criteria.
  - Acceptance: after the merge, the `release.yml` run shows `docker-publish` as skipped (spec
    check 13), and no new image tag appears.
  - Files: `docs/specs/SPEC-docker-image.md`, `docs/plans/PLAN-docker-image.md`.
  - Size: XS.

### Checkpoint 2: Complete

- [ ] All spec success criteria are checked.
- [ ] `ghcr.io/jorgetroya80/artwork-search:0.2.0` is public and runs on amd64 and arm64.

## Risks and mitigations

| Risk                                                                       | Impact                                  | Mitigation                                                                                                                                                      |
| -------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No image build on PRs: a broken `Dockerfile` is found only at release time | Medium: release exists without an image | Spec checks 1–9 before merging any PR that touches Docker files. If `docker-publish` fails: fix in a `fix:` PR, which makes a new release                       |
| `docker-publish` fails for a transient reason (registry, network)          | Low                                     | Re-run the failed job. It checks out the same tag                                                                                                               |
| First push cannot create the package (`403`)                               | Medium: no image for `0.2.0`            | Check job `permissions` and the repository's Actions settings, then re-run the job. Package Actions access (T7) only exists after the first push                |
| New package is private                                                     | Low: anonymous pull fails               | T7                                                                                                                                                              |
| Corepack cannot download pnpm 12 in the container                          | Medium: build fails                     | Found in T2. Fallback `npm install -g pnpm@12.8.1`, after asking                                                                                                |
| `envsubst` cannot write `conf.d` as UID 101                                | Medium: container does not start        | Found in T2. `nginx-unprivileged` makes `conf.d` writable; if not, ask before changing the approach                                                             |
| Building `arm64` on the amd64 runner needs QEMU                            | Medium: job fails                       | Final stage has no `RUN`. Checked locally in T4 for the opposite direction. If it fails on GitHub: adding `docker/setup-qemu-action` is "ask first" in the spec |
| Release PR checks stay pending (`GITHUB_TOKEN` starts no workflows)        | Low: merge blocked                      | Close and reopen (as in PLAN-ci-release)                                                                                                                        |
| Base images get old (no Dependabot)                                        | Low                                     | Accepted in the spec. Update by hand, `node` together with `.nvmrc`                                                                                             |
