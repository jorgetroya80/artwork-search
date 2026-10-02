# Plan: Deploy to Render

- Created: 2026-10-02
- Status: **in progress**. Revised 2026-10-02 after the spec dropped the deploy hook (see "Design
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

### Checkpoint 1: Local checks pass, open PR

- [x] T1 build, T2 and T4 check scripts pass. `git diff main -- .github/` is empty.
- [x] `actionlint` and Prettier pass on the changed files.
- [x] `pnpm lint`, `pnpm test` (169 tests) and `pnpm build` pass (unchanged app).
- [x] Spec status **in progress**.
- [ ] Review with the user, then push `feat/render-deploy` and open the PR titled
      `feat: deploy to Render`. CI (`lint`, `test`, `build`, `pr-title`) passes.

### Phase 2: Render

- [ ] **T5: Merge the PR**
  - Squash-merge the PR. No site exists yet, so nothing deploys. release-please opens a release
    PR; it can wait.
  - Acceptance: `main` has `render.yaml`.
  - Files: none by hand.
  - Size: XS.

- [ ] **T6: Render Blueprint (maintainer)**
  - Spec setup step 1: New → Blueprint from `main`.
  - Acceptance: spec check 5 (Blueprint preview accepts `render.yaml`). The site exists, with
    auto-deploy "After CI checks pass" and the build filter visible in its settings.
  - Files: none.
  - Size: XS.

- [ ] **T7: Live checks on the first deploy**
  - Acceptance: spec checks 6, 7 and 8 on the deploy that the Blueprint created.
  - Verify: Render build log (Node `24.18.0`, pnpm `12.8.1`). `curl -I` on `/`, `/index.html`,
    one file under `/assets/` and `/missing`. A search in the browser.
  - If Corepack fails on Render: stop and ask (fallback in the spec's "Ask first"). If a header
    is missing or `Cache-Control` differs: fix `render.yaml` in a `fix:` PR, after asking.
  - Files: none.
  - Size: XS.

- [ ] **T8: Live URL, no deploy on `docs:`**
  - In a `docs:` PR: the live URL in the README (Deploy section and top of the file), remove "No
    public deployment yet" from the limitations, spec status **implemented**, this plan's status,
    spec success criteria checked.
  - Acceptance: after the merge, Render shows no new deploy (spec check 10).
  - Files: `README.md`, `docs/specs/SPEC-render-deploy.md`, `docs/plans/PLAN-render-deploy.md`.
  - Size: XS.

- [ ] **T9: An app change deploys after checks**
  - Merge the open release PR (close and reopen it first so CI runs). It changes `package.json`,
    a `buildFilter` path.
  - Acceptance: spec check 9. Render's deploy of that commit starts only after its checks
    (`ci.yml`, `release.yml`) finish, and goes live.
  - Verify: Render events (deploy start time) against `gh run list --commit <sha>` (finish times).
  - Files: none by hand.
  - Size: XS.

### Checkpoint 2: Complete

- [ ] All spec success criteria are checked.
- [ ] The live URL serves the current `main`.

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
| Free bandwidth or build minutes run out                                           | Low for a portfolio                          | Accepted in the spec                                                                                      |
