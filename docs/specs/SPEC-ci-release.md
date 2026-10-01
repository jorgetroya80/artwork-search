# Spec: CI and release automation

- Created: 2026-10-01
- Status: **approved** (2026-10-01)
- Plan: [PLAN-ci-release.md](../plans/PLAN-ci-release.md)

## Objective

Add GitHub Actions workflows that check every pull request and automate versioning and the
changelog with [release-please](https://github.com/googleapis/release-please).

User: the maintainer of this repository, who merges PRs into `main`. Success:

- Every PR to `main` runs lint, unit tests, type check and build, in parallel. A PR cannot be
  merged while any of these fail.
- Every PR title is a Conventional Commit. With squash merge, the PR title becomes the commit
  on `main`, and release-please reads those commits.
- After each merge to `main`, release-please opens or updates one release PR. The release PR
  bumps `package.json`, updates `.release-please-manifest.json` and writes `CHANGELOG.md`.
- Merging the release PR creates the tag `vX.Y.Z` and a GitHub Release with the changelog notes.

### Scope

This spec covers **CI and release only**. No deploy. Deploy is a later phase (see "Next
phases"). Its trigger is already decided: production deploys only when a release is created.

### Assumptions

1. Repository: `jorgetroya80/artwork-search` on github.com, public, single package at the root.
2. One maintainer. PRs come from branches in this repository, not from forks.
3. Runners: `ubuntu-latest`, GitHub-hosted.
4. Node from `.nvmrc` (`v24.18.0`), pnpm from the `packageManager` field (`pnpm@12.8.1`).
5. No secrets needed. All workflows use the built-in `GITHUB_TOKEN`.

## Workflows

### `.github/workflows/ci.yml`

Triggers: `pull_request` to `main` (types `opened`, `edited`, `synchronize`, `reopened`) and
`push` to `main`.

Concurrency: group `ci-${{ github.ref }}`, `cancel-in-progress: true`.

Top-level `permissions: contents: read`. Jobs get no extra permissions.

| Job id     | Runs on             | Steps after setup                                            |
| ---------- | ------------------- | ------------------------------------------------------------ |
| `lint`     | PR and push         | `pnpm lint`                                                  |
| `test`     | PR and push         | `pnpm test` (unit tests, no coverage)                        |
| `build`    | PR and push         | `pnpm build` (type check + Vite build)                       |
| `pr-title` | `pull_request` only | `amannn/action-semantic-pull-request` validates the PR title |

The four jobs have no `needs`, so GitHub runs them in parallel on separate runners. Wall-clock
time is the slowest job, not the sum.

Setup, repeated in `lint`, `test` and `build`: checkout → `pnpm/action-setup` →
`actions/setup-node` (`node-version-file: .nvmrc`, `cache: pnpm`) → `pnpm install
--frozen-lockfile`. The pnpm store cache makes the repeated install cheap. Each job installs on
its own; jobs share no files. The cost is three installs instead of one, accepted for faster
feedback and one clear failing check per concern.

Tests run without coverage. The coverage thresholds in `vite.config.ts` stay for local use
(`pnpm test:coverage`) but are not enforced in CI.

`edited` is needed so `pr-title` re-runs when the title changes. `lint`, `test` and `build` also
run on `edited`. The cost is one extra run per title or body edit, which is acceptable.

Allowed PR title types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`,
`chore`, `revert`. Scope optional. Subject must not start with an uppercase letter. Breaking
change marked with `!` (`feat!: …`).

### `.github/workflows/release.yml`

Trigger: `push` to `main`.

Concurrency: group `release`, `cancel-in-progress: false` (never cancel a release in progress).

One job `release-please`:

- Top-level `permissions: {}`. Job-level `permissions: contents: write, issues: write,
pull-requests: write`. `issues: write` is needed because release-please creates and sets the
  `autorelease: pending` / `autorelease: tagged` labels it uses to find the merged release PR
  (release-please-action README). Added during T4 (2026-10-01).
- Step `googleapis/release-please-action` with `config-file: release-please-config.json` and
  `manifest-file: .release-please-manifest.json`.
- Exposes the outputs `release_created`, `tag_name`, `version` as job outputs. Nothing consumes
  them yet. The deploy phase will add a job with
  `if: needs.release-please.outputs.release_created == 'true'`.

## Release strategy

### Versioning

Semantic Versioning, driven by commit types on `main`:

| Commit on `main`                                   | While `0.x` | From `1.0.0` |
| -------------------------------------------------- | ----------- | ------------ |
| `fix:`, `perf:`                                    | patch       | patch        |
| `feat:`                                            | minor       | minor        |
| `feat!:` / `BREAKING CHANGE:` footer               | minor       | major        |
| `docs`, `test`, `refactor`, `build`, `ci`, `chore` | no release  | no release   |

`bump-minor-pre-major: true` gives the `0.x` column. Going to `1.0.0` is a manual decision: a
commit with the footer `Release-As: 1.0.0`.

### `release-please-config.json`

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "node",
      "include-component-in-tag": false,
      "bump-minor-pre-major": true,
      "changelog-sections": [
        { "type": "feat", "section": "Features" },
        { "type": "fix", "section": "Bug Fixes" },
        { "type": "perf", "section": "Performance" },
        { "type": "revert", "section": "Reverts" },
        { "type": "refactor", "section": "Refactors", "hidden": true },
        { "type": "docs", "section": "Documentation", "hidden": true },
        { "type": "test", "section": "Tests", "hidden": true },
        { "type": "build", "section": "Build", "hidden": true },
        { "type": "ci", "section": "CI", "hidden": true },
        { "type": "chore", "section": "Miscellaneous", "hidden": true }
      ]
    }
  }
}
```

`include-component-in-tag: false` gives tags `v0.1.0` instead of `artwork-search-v0.1.0`.

### `.release-please-manifest.json`

```json
{ ".": "0.0.1" }
```

Holds the last released version. Only release-please edits it after setup.

### First release

There are no tags yet. release-please reads the full history of `main` on its first run. The
`feat:` commits from PRs #1–#3 are already there, so the first release PR proposes **`0.1.0`**,
and its changelog lists the features built so far. This is intended: `0.1.0` documents the
current app.

### Release PR and CI

The release PR is opened and updated with `GITHUB_TOKEN`. GitHub does not start workflows for
events caused by `GITHUB_TOKEN`, so the CI jobs do not run on the release PR, and the
required checks stay pending.

Procedure before merging a release PR: **close it and reopen it** in the GitHub UI. The
`reopened` event comes from the maintainer, so CI runs. Merge when green. The release PR only
touches `package.json`, `CHANGELOG.md` and `.release-please-manifest.json`, so CI there is a
sanity check.

## Repository settings (manual, one time)

Done by the maintainer in the GitHub UI. Not code, so the spec lists them for the success
criteria:

1. Settings → General → Pull Requests: allow **squash merging only**. Default commit message:
   **"Pull request title"** (or "Pull request title and description"). Turn on "Automatically
   delete head branches".
2. Settings → Actions → General → Workflow permissions: **"Read repository contents and packages
   permissions"** (default read). Turn on **"Allow GitHub Actions to create and approve pull
   requests"** (release-please needs it).
3. Settings → Branches (or Rulesets) for `main`: require a pull request, require status checks
   `lint`, `test`, `build` and `pr-title`, require branches up to date, block force pushes and deletion.

## Project Structure

```
.github/workflows/
  ci.yml                         → lint, test, build, pr-title jobs (parallel)
  release.yml                    → release-please job
release-please-config.json       → release-please package config
.release-please-manifest.json    → last released version
CHANGELOG.md                     → generated by release-please, never edited by hand
README.md                        → add "Contributing and releases" section
```

## Tech Stack

GitHub Actions. Actions used, each pinned to a full commit SHA with the version tag in a
trailing comment:

| Action                                | Version (at implementation time) |
| ------------------------------------- | -------------------------------- |
| `actions/checkout`                    | latest major                     |
| `pnpm/action-setup`                   | latest major                     |
| `actions/setup-node`                  | latest major                     |
| `amannn/action-semantic-pull-request` | latest major                     |
| `googleapis/release-please-action`    | latest major                     |

The implementer checks each action's release page and pins the latest release of the latest
major. No new npm dependencies.

## Commands

CI runs exactly the local commands:

```sh
pnpm install --frozen-lockfile   # fails if pnpm-lock.yaml is out of date
pnpm lint                        # eslint 'src/**/*.{ts,tsx}'
pnpm test                        # vitest run, no coverage
pnpm build                       # tsc -b && vite build
```

Optional local check of workflow syntax (not a project dependency):

```sh
actionlint                       # brew install actionlint
```

## Code Style

YAML formatted by Prettier (lint-staged already covers `*.yml`). Two-space indent. Every job
and every step that is not obvious has a `name`. Permissions declared explicitly, at the lowest
level that works. Example:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
    types: [opened, edited, synchronize, reopened]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  lint:
    name: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha> # vX.Y.Z
      - uses: pnpm/action-setup@<sha> # vX.Y.Z
      - uses: actions/setup-node@<sha> # vX.Y.Z
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  test:
    name: test
    runs-on: ubuntu-latest
    steps:
      # same setup steps as lint
      - run: pnpm test

  build:
    name: build
    runs-on: ubuntu-latest
    steps:
      # same setup steps as lint
      - run: pnpm build
```

The setup steps are written out in each job. No composite action for three short copies.

Job ids `lint`, `test`, `build` and `pr-title` are stable: branch protection refers to them by
name.

## Testing Strategy

Workflows have no unit tests. They are verified by running them on GitHub:

1. **CI happy path.** The PR that adds the workflows runs `lint`, `test`, `build` and `pr-title`
   in parallel (same start time in the Actions run view), and all pass.
2. **CI failure.** On a throwaway branch, a lint error makes only `lint` fail. `test` and
   `build` still finish. The branch is deleted after the check.
3. **Title check.** Editing the PR title to `Add workflows` makes `pr-title` fail. Changing it
   back to `ci: add CI and release workflows` makes it pass.
4. **Release PR.** After the workflows PR is merged, `release.yml` runs and opens a release PR
   titled `chore(main): release 0.1.0`.
5. **Release.** Close and reopen the release PR, CI passes, merge. Tag `v0.1.0` and a GitHub
   Release exist. `package.json` and the manifest say `0.1.0`.
6. **No release for non-release types.** A later `docs:` PR merged to `main` creates no release
   PR (or leaves an existing one unchanged).

The app test suite and `vite.config.ts` stay as they are. CI does not run coverage.

## Boundaries

- **Always:** least-privilege `permissions` on every workflow. Pin every action to a full commit
  SHA. Use `--frozen-lockfile`. Keep CI steps identical to the local commands.
- **Ask first:** adding secrets, a PAT or a GitHub App. New actions beyond the table above. A
  deploy job. Dependabot or Renovate. Matrix builds (several Node versions or OSes). Caching
  beyond `setup-node`'s pnpm cache. Adding coverage to CI. Any change to `src/`.
- **Never:** use `pull_request_target`. Interpolate untrusted input (`github.event.pull_request.title`,
  branch names) directly into `run:` scripts. Edit `CHANGELOG.md` or the manifest by hand. Push
  tags by hand. Weaken or skip checks to get a green build.

## Success Criteria

- [ ] `.github/workflows/ci.yml` and `.github/workflows/release.yml` exist and pass `actionlint`.
- [ ] Every `uses:` is pinned to a 40-character SHA with a version comment.
- [ ] `ci.yml` has top-level `permissions: contents: read`. `release.yml` grants only
      `contents: write`, `issues: write` and `pull-requests: write`, at job level.
- [ ] A PR to `main` runs `lint`, `test`, `build` and `pr-title` as parallel jobs (no `needs`).
- [ ] `test` runs `pnpm test` without coverage.
- [ ] A lint error fails `lint`. A failing test fails `test`. A type error fails `build`. An
      outdated lockfile fails all three at install.
- [ ] A PR title that is not a Conventional Commit makes `pr-title` fail.
- [ ] Repository settings 1–3 are applied. A PR with a failing required check cannot be merged.
- [ ] After merging the workflows PR, a release PR for `0.1.0` opens with a `CHANGELOG.md` that
      lists features and fixes only.
- [ ] Merging the release PR creates tag `v0.1.0` and a GitHub Release with the same notes.
- [ ] A `docs:`-only merge creates no release.
- [ ] README has a "Contributing and releases" section: PR title format, squash merge, how the
      release PR works, the close/reopen step.

## Decisions

- Release tool: release-please, manifest mode, `release-type: node`.
- Merge strategy: squash merge only. PR title = commit message on `main`, validated in CI.
- Token: `GITHUB_TOKEN`. CI on the release PR is started by close/reopen. No PAT, no App.
- Pre-1.0: breaking changes bump minor, `feat` bumps minor, `fix` bumps patch.
- Changelog shows Features, Bug Fixes, Performance, Reverts. Other types hidden.
- Tags without component: `v0.1.0`.
- First release `0.1.0` includes the full existing history.
- No deploy in this phase. Production will deploy only on release creation.
- CI jobs `lint`, `test`, `build` run in parallel, each with its own install.
- CI runs unit tests only, without coverage.
- No Dependabot or Renovate in this phase. SHA pins are updated by hand.
- Local commit messages are not checked (no commitlint). Only the PR title reaches `main`.

## Next phases (out of scope here)

**Deploy.** Target not chosen (GitHub Pages, Vercel, Netlify, …). Already decided: production
deploys only when release-please creates a release. With GitHub Pages, this is a `deploy` job in
`release.yml` gated on `release_created`, and `vite.config.ts` needs `base: '/artwork-search/'`.
With Vercel or Netlify, their Git integration needs "deploy on tag" or a deploy hook called from
`release.yml`. That spec also decides PR preview deploys.

**Dependency updates.** Dependabot (or Renovate) for `github-actions`, to keep SHA pins current,
and maybe for `npm`. Not in this phase.

**Token upgrade.** If close/reopen becomes annoying, a GitHub App token lets CI run on the
release PR automatically.

## Open Questions

None.
