# Plan: Deploy to Render on release

- Created: 2026-10-02
- Status: **approved**, not started
- Spec: [SPEC-render-deploy.md](../specs/SPEC-render-deploy.md)

The task list lives in this file. Check off tasks here as they are done.

## Overview

Add the files described in the spec:

- `render.yaml`: a Render Static Site that builds with pnpm through Corepack, publishes `dist/`,
  has auto-deploy off, and sends the same headers as `nginx.conf`.
- Output `sha` on the `release-please` job and job `render-deploy` in `release.yml`: on release,
  call the deploy hook with `ref=<release sha>`.
- README section "Deploy".

Spec, plan and implementation land in one PR. The branch `docs/render-deploy-spec` is renamed to
`feat/render-deploy` before T2. The PR is titled `feat: deploy to Render on release`, so its merge
leads to release `0.3.0`.

Order matters: Render reads `render.yaml` from `main`, so the Blueprint can only be created after
the PR is merged. The release PR that follows is merged only after the maintainer has created the
site and the secret. Otherwise `render-deploy` would fail with no secret.

No change to `src/`, `package.json`, `Dockerfile` or `nginx.conf`.

Local tools: Docker 29.7.2 and `actionlint` are installed. Nothing new is installed.

## Dependency graph

```
T1 verify facts + clean build ──► T2 render.yaml ──┐
                                                    ├──► T4 README "Deploy"
                                 T3 release.yml ────┘          │
                                                               ▼
                                         Checkpoint 1: local checks pass, open PR
                                                               │
                                                               ▼
                                         T5 merge PR, release PR 0.3.0 opens (not merged)
                                                               │
                                                               ▼
                                         T6 Render Blueprint + secret (maintainer, manual)
                                                               │
                                                               ▼
                                         T7 live checks on the first deploy
                                                               │
                                                               ▼
                                         T8 merge release PR, render-deploy runs
                                                               │
                                                               ▼
                                         T9 docs PR: live URL, statuses, no deploy on docs
```

T2 and T3 can run in parallel.

## Architecture decisions

- **Facts from the source, not from memory.** The `sha` output of `release-please-action` was
  checked in the README at the pinned SHA `45996ed…` (v5.0.0): "`sha` | SHA that a GitHub release
  was tagged at". Render behavior was checked in the Render docs on 2026-10-02 (spec,
  assumptions).
- **Clean-clone build check.** Render runs the build command with `SKIP_INSTALL_DEPS=true`, so
  there is no `node_modules`. T1 runs the same command in a fresh clone in the session
  scratchpad, so a missing step shows up before Render.
- **Header parity is tested, not eyeballed.** A script compares the headers in `render.yaml` with
  the `add_header` and `map` lines in `nginx.conf`.
- **No untrusted input in `run:`.** The only `run:` step reads the secret and the SHA from `env:`.
- **The live URL is unknown until T6.** Render picks the `onrender.com` subdomain when the site is
  created. The README gets the URL in T9, not before.

## Task list

### Phase 1: Files (local)

- [x] **T1: Verify facts and the clean build**
  - Confirm `release-please-action` v5.0.0 has output `sha` (done while planning, see
    "Architecture decisions").
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
    its first build is slower. Whether `corepack enable` works on Render is still checked in T7.

- [x] **T2: `render.yaml`**
  - Rename the branch: `git branch -m feat/render-deploy`.
  - `render.yaml` at the root, as in the spec.
  - Acceptance: the YAML parses, has exactly the spec fields, and the headers match `nginx.conf`.
  - Verify: a check script in the session scratchpad (Ruby, stdlib YAML) that parses
    `render.yaml`, checks `runtime: static`, `branch`, `buildCommand`, `staticPublishPath`,
    `autoDeployTrigger: off`, `SKIP_INSTALL_DEPS`, no `routes`, no `plan`/`region`, no two rules
    with the same header on overlapping paths, and compares the header names and values with
    `nginx.conf`. It fails before the file exists. `pnpm exec prettier --check render.yaml`.
  - Files: `render.yaml`.
  - Size: S.
  - Done: branch renamed to `feat/render-deploy`. The check script (24 assertions) failed before
    the file existed ("render.yaml missing") and passes now ("6 header rules"). It reads the
    three security headers and both `Cache-Control` values from `nginx.conf`, so the two files
    cannot drift apart unnoticed. Mutations it catches: a bare `off` (parsed as `false`), a
    changed `X-Frame-Options`, a changed `/assets/*` path, and `/index.html` widened to `/*`
    (overlapping `Cache-Control` rules). Found while writing: Ruby's YAML (1.1) reads a bare
    `off` as `false`, so `autoDeployTrigger` is quoted (`'off'`, single quotes from the
    project's Prettier config); spec updated. Short comments in `render.yaml` explain the
    quoting, `SKIP_INSTALL_DEPS` and the header parity. Prettier passes.

- [x] **T3: `render-deploy` job**
  - Add `sha: ${{ steps.release.outputs.sha }}` to the `release-please` job outputs.
  - Add job `render-deploy` as in the spec.
  - Acceptance: `needs: release-please`, the `release_created` condition, `permissions: {}`,
    `timeout-minutes: 5`, one `run:` step with the secret and SHA only in `env:` and no `${{ }}`
    in the script. `docker-publish` unchanged. `release-please` changes only by the new output.
  - Verify: a structure test in the session scratchpad (Ruby, stdlib YAML) for the properties
    above, failing before the job exists. `git diff` on `release.yml` shows only the two
    additions. `actionlint .github/workflows/release.yml`,
    `pnpm exec prettier --check .github/workflows/release.yml`.
  - Files: `.github/workflows/release.yml`.
  - Size: S.
  - Done: the structure test (Ruby, stdlib YAML, 20 assertions) compares with
    `main:.github/workflows/release.yml`: top level, `docker-publish` and `release-please` are
    unchanged except the new `sha` output, and `render-deploy` has exactly the spec's keys,
    `needs`, `if`, `permissions: {}`, timeout, one step with no `uses:`, only the secret and the
    SHA in `env:`, no `${{ }}` and no tracing flags in `run:`. It failed before the change (14
    failures) and passes now. `git diff` shows 17 insertions and no deletions. `actionlint` (both
    workflows) and Prettier pass. The `curl` command was run against a local server: the URL
    becomes `…?key=k&ref=<sha>`, `200` and `202` exit `0`, `401` exits `22` and prints the
    body, and an empty secret exits `2`. curl's error line does not print the URL. One comment
    on the step says why the hook is the only deploy trigger.

- [x] **T4: README "Deploy"**
  - After "Docker": the site is a Render Static Site from `render.yaml`. Only releases deploy, the
    release commit, through a deploy hook stored in `RENDER_DEPLOY_HOOK_URL`. The Docker image
    stays for local use. A placeholder for the live URL, filled in T9.
  - Acceptance: the section matches the spec. No hook URL or key in the text.
  - Verify: `pnpm exec prettier --check README.md`.
  - Files: `README.md`.
  - Size: XS.
  - Done: new `## Deploy` section after "Docker", with a TODO comment for the live URL (T9), and
    a Render line in "Tech stack". A check script in the session scratchpad (12 assertions)
    asserts the section's place and that it names the Static Site, `render.yaml`, `pnpm build`
    and `dist`, the release-only rule, the release commit, the deploy hook, the secret name,
    `render-deploy` and the header parity with `nginx.conf`, and that the README has no hook URL
    or key. It failed before the section existed and passes now. Prettier passes. The top-of-file
    TODO and the "No public deployment yet" limitation stay until T9, when the site exists.

### Checkpoint 1: Local checks pass, open PR

- [ ] T1 build, T2 check script and T3 structure test pass on the final files.
- [ ] `actionlint` and Prettier pass on the changed files.
- [ ] `pnpm lint`, `pnpm test` and `pnpm build` pass (unchanged app).
- [ ] Spec status **in progress**, this plan **in progress**.
- [ ] Review with the user, then push `feat/render-deploy` and open the PR titled
      `feat: deploy to Render on release`. CI (`lint`, `test`, `build`, `pr-title`) passes.

### Phase 2: Render setup and first release

- [ ] **T5: Merge the PR, release PR opens**
  - Squash-merge the PR. The `release.yml` run skips `docker-publish` and `render-deploy` (no
    release yet). release-please opens `chore(main): release 0.3.0`.
  - Do **not** merge the release PR yet.
  - Acceptance: the run shows both jobs skipped. The release PR exists.
  - Files: none by hand.
  - Size: XS.

- [ ] **T6: Render Blueprint and secret (maintainer)**
  - Spec setup steps 1–3: New → Blueprint from `main`, copy the deploy hook URL, add the GitHub
    secret `RENDER_DEPLOY_HOOK_URL`.
  - Acceptance: spec check 4 (Blueprint preview accepts `render.yaml`). The site exists with
    auto-deploy off. `gh secret list` shows `RENDER_DEPLOY_HOOK_URL`.
  - Files: none.
  - Size: XS.

- [ ] **T7: Live checks on the first deploy**
  - Acceptance: spec checks 5, 6 and 7 on the deploy that the Blueprint created.
  - Verify: Render build log (Node `24.18.0`, pnpm `12.8.1`). `curl -I` on `/`, `/index.html`,
    one file under `/assets/` and `/missing`. A search in the browser.
  - If Corepack fails on Render: stop and ask (fallback in the spec's "Ask first"). If a header
    is missing or `Cache-Control` differs: fix `render.yaml` in a `fix:` PR, after asking.
  - Files: none.
  - Size: XS.

- [ ] **T8: Release 0.3.0 and `render-deploy`**
  - Close and reopen the release PR so CI runs, then squash-merge it.
  - Acceptance: spec checks 8 and 9. `release-please`, `docker-publish` and `render-deploy` are
    green. Render shows a hook deploy of the release commit, and it goes live.
  - Verify: `gh run view <run>`, the Render events list, and `git rev-parse v0.3.0` equal to the
    commit Render deployed.
  - Files: none by hand.
  - Size: XS.

- [ ] **T9: Live URL, no deploy on `docs:`, close the spec**
  - In a `docs:` PR: the live URL in the README (Deploy section and top of the file), spec status
    **implemented**, this plan's status, spec success criteria checked.
  - Acceptance: after the merge, the `release.yml` run skips `render-deploy` and Render shows no
    new deploy (spec check 10).
  - Files: `README.md`, `docs/specs/SPEC-render-deploy.md`, `docs/plans/PLAN-render-deploy.md`.
  - Size: XS.

### Checkpoint 2: Complete

- [ ] All spec success criteria are checked.
- [ ] The live URL serves release `0.3.0`, deployed by `render-deploy`.

## Risks and mitigations

| Risk                                                                              | Impact                                    | Mitigation                                                                                               |
| --------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Release PR merged before T6                                                       | Low: `render-deploy` fails with no secret | Order in this plan. If it happens: do T6, then re-run the failed job (same SHA)                          |
| `corepack enable` fails on Render (no write access to the Node install)           | Medium: no build                          | Found in T7, before any release deploy. Fallback `npm install -g pnpm@12.8.1`, after asking              |
| Render ignores `.nvmrc` or picks another Node                                     | Low                                       | T7 build log. Add a `NODE_VERSION` env var only after asking (duplicates `.nvmrc`)                       |
| Render header precedence or a default `Cache-Control` differs from what we assume | Medium: stale `index.html` after release  | No overlapping rules. T7 checks every header with `curl`                                                 |
| Blueprint sync deploys on a push to `main` that changes `render.yaml`             | Low: a non-release commit goes live       | Check after T9 and on any later `render.yaml` change. If it deploys, document it or ask how to handle it |
| Deploy hook leaks                                                                 | Medium: anyone can redeploy               | Only in the secret. Regenerate in Render and update the secret                                           |
| `render-deploy` fails for a transient reason (Render API)                         | Low                                       | Re-run the job. It sends the same SHA                                                                    |
| Release PR checks stay pending (`GITHUB_TOKEN` starts no workflows)               | Low: merge blocked                        | Close and reopen (as in PLAN-ci-release)                                                                 |
| Free bandwidth or build minutes run out                                           | Low for a portfolio                       | Accepted in the spec                                                                                     |
