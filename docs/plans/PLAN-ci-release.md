# Plan: CI and release automation

- Created: 2026-10-01
- Status: **in progress**
- Spec: [SPEC-ci-release.md](../specs/SPEC-ci-release.md)

The task list lives in this file. Check off tasks here as they are done.

## Overview

Add two workflows and the release-please config described in the spec:

- `ci.yml`: parallel jobs `lint`, `test` (no coverage), `build` and `pr-title`.
- `release.yml`: release-please opens the release PR, and merging it creates the tag and the
  GitHub Release.

The work runs on branch `ci-release-workflows` and lands in one PR titled
`ci: add CI and release workflows`. Part of the verification can only happen on GitHub: CI runs
on the PR, and release-please runs after the merge. The repository settings are manual steps
for the maintainer.

No change to `src/`, `package.json` scripts or `vite.config.ts`.

## Dependency graph

```
T1 resolve action SHAs ──┬──► T2 ci.yml: lint, test, build ──► T3 ci.yml: pr-title
                         │                                          │
                         └──► T4 release.yml + release-please config│
                                         │                          │
                                         └────────────┬─────────────┘
                                                      ▼
                                          T5 README "Contributing and releases"
                                                      │
                                                      ▼
                                      Checkpoint 1: local checks pass, open PR
                                                      │
                                                      ▼
                         T6 verify CI on GitHub (happy path, failures, title check)
                                                      │
                                                      ▼
                         T7 repository settings (maintainer, manual)
                                                      │
                                                      ▼
                         T8 merge, first release PR, release v0.1.0
                                                      │
                                                      ▼
                         T9 docs-only merge creates no release, spec status
```

Can run in parallel: T2/T3 with T4.

## Architecture decisions

- **SHAs resolved with `gh`, not copied from blogs.** For each action:
  `gh release view --repo <owner/repo> --json tagName` gives the latest tag, then
  `gh api repos/<owner/repo>/commits/<tag> --jq .sha` gives the commit SHA. That second call
  also resolves annotated tags to the commit. The latest release must be the latest major.
- **Setup steps copied in each CI job.** Three short copies of checkout, pnpm, node and install.
  No composite action (spec, Code Style).
- **`pr-title` runs only on `pull_request`.** Job-level `if: github.event_name == 'pull_request'`.
  On `push` to `main` the job is skipped, not failed.
- **The PR title is never put into a `run:` script.** `amannn/action-semantic-pull-request`
  reads it from the event payload, and no `run:` step references it.
- **Allow Actions to create PRs before the merge.** Setting 2 (T7) must be on before the
  workflows PR is merged. Otherwise the first `release.yml` run fails to open the release PR.

## Task list

### Phase 1: Files (local)

- [x] **T1: Resolve action versions and SHAs**
  - Use the two `gh` calls from "Architecture decisions" for `actions/checkout`,
    `pnpm/action-setup`, `actions/setup-node`, `amannn/action-semantic-pull-request` and
    `googleapis/release-please-action`.
  - Check each action's README for the latest major's inputs. In particular, check that
    `pnpm/action-setup` reads `packageManager` when `version` is not set, and check the
    release-please-action inputs and outputs (`config-file`, `manifest-file`,
    `release_created`, `tag_name`, `version`).
  - Acceptance: a list of `action@sha # vX.Y.Z` lines, written in this task's "Done" note.
  - Verify: each SHA is 40 hex characters and `gh api repos/<repo>/commits/<sha>` returns it.
  - Files: none (this plan only).
  - Size: XS.
  - Done: SHAs resolved on 2026-10-01 and confirmed by `gh api repos/<repo>/commits/<sha>`:
    - `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`
    - `pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0`
    - `actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0`
    - `amannn/action-semantic-pull-request@48f256284bd46cdaab1048c3721360e808335d50 # v6.1.1`
    - `googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0`

    Findings: `pnpm/action-setup` v6 reads `packageManager` when `version` is not set and
    supports pnpm v12. Its README also mentions `pnpm/setup`, which can replace
    `actions/setup-node`, but the spec keeps `pnpm/action-setup` + `actions/setup-node`.
    `actions/setup-node` v7 caches pnpm only with `cache: pnpm`, and pnpm must be installed
    first. `amannn/action-semantic-pull-request` documents `pull-requests: read` at job level.
    release-please-action v5 keeps `config-file`, `manifest-file` and the root outputs
    `release_created`, `tag_name`, `version`. Its README grants `issues: write` as well as
    `contents: write` and `pull-requests: write`; the spec grants only the last two (see T4).

- [x] **T2: `ci.yml` with `lint`, `test`, `build`**
  - Triggers, concurrency and `permissions: contents: read` as in the spec.
  - Three jobs without `needs`, each with checkout → `pnpm/action-setup` → `actions/setup-node`
    (`node-version-file: .nvmrc`, `cache: pnpm`) → `pnpm install --frozen-lockfile` → its
    command (`pnpm lint` / `pnpm test` / `pnpm build`).
  - Acceptance: job ids `lint`, `test`, `build`. Every `uses:` is pinned to a SHA from T1. No
    coverage flag.
  - Verify: `actionlint .github/workflows/ci.yml` and
    `pnpm exec prettier --check .github/workflows/ci.yml`.
  - Files: `.github/workflows/ci.yml`.
  - Size: S.
  - Done: each job also has `timeout-minutes: 10` (not in the spec; stops a stuck run early).
    `actionlint` not run yet (not installed). Checked instead with a YAML structure script in the
    session scratchpad (job ids, no `needs`, SHA pins, setup order, commands, no coverage) and
    Prettier.

- [x] **T3: `pr-title` job**
  - Add job `pr-title` to `ci.yml`, with `if: github.event_name == 'pull_request'`.
  - Allowed types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`,
    `revert`. Scope optional. Subject must not start with an uppercase letter
    (`subjectPattern: ^(?![A-Z]).+$`).
  - The action needs `GITHUB_TOKEN` in `env`. `contents: read` is enough for public repos. Check
    in T1 whether the latest major needs `pull-requests: read`. If it does, grant it at job
    level only.
  - Acceptance: `release-please`'s own title `chore(main): release 0.1.0` matches the rules.
  - Verify: `actionlint` and Prettier, as in T2.
  - Files: `.github/workflows/ci.yml`.
  - Size: XS.
  - Done: job-level `permissions: pull-requests: read`, as the action README shows. Job-level
    permissions replace the top-level ones, so this job has no `contents` access; it does not
    check out code. The structure script checks that `release 0.1.0` matches `subjectPattern`
    and `Add workflows` does not. No `run:` step in the job.

- [x] **T4: `release.yml` and release-please config**
  - `.github/workflows/release.yml`: trigger, concurrency and job `release-please` with
    job-level `permissions: contents: write, issues: write, pull-requests: write`. Top-level `permissions: {}`.
    Expose job outputs `release_created`, `tag_name`, `version`.
  - `release-please-config.json` and `.release-please-manifest.json` copied from the spec.
  - Acceptance: tag format without component (`include-component-in-tag: false`). Manifest
    `0.0.1` matches `package.json`.
  - Verify: `actionlint .github/workflows/release.yml`, then
    `node -e "JSON.parse(require('fs').readFileSync('release-please-config.json'))"` (and the
    same for the manifest), then Prettier on the three files.
  - Files: `.github/workflows/release.yml`, `release-please-config.json`,
    `.release-please-manifest.json`.
  - Size: S.
  - Done: added `issues: write` after the user approved it (release-please needs it for its
    `autorelease: *` labels). Spec updated. Checked with the structure script (trigger,
    concurrency, permissions, outputs, inputs, config values, manifest = `package.json` version),
    `JSON.parse` and Prettier. `actionlint` still pending.

- [x] **T5: README "Contributing and releases"**
  - PR title format with examples. Squash merge only. What the release PR is. Close and reopen
    the release PR before merging it to start CI. Never edit `CHANGELOG.md` or the manifest by
    hand. How to go to `1.0.0` (`Release-As: 1.0.0` footer).
  - Acceptance: the section covers every point in the spec success criterion for README.
  - Verify: `pnpm exec prettier --check README.md`.
  - Files: `README.md`.
  - Size: XS.
  - Done before T4 (no dependency between them). Also links the new spec and plan under
    "Documentation".

### Checkpoint 1: Local checks pass, open PR

- [x] `actionlint` passes on both workflows (actionlint 1.7.12, installed with Homebrew after
      the user's OK).
- [x] `grep -nE 'uses: [^@]+@[0-9a-f]{40} # v' .github/workflows/*.yml` matches every `uses:`
      line.
- [x] `pnpm lint`, `pnpm test` and `pnpm build` pass (unchanged app).
- [x] Review with the user, then push `ci-release-workflows` and open the PR titled
      `ci: add CI and release workflows`.

### Phase 2: Verify on GitHub

- [ ] **T6: CI behavior**
  - Happy path: on the workflows PR, `lint`, `test`, `build` and `pr-title` start at the same
    time and pass. Check with `gh pr checks` and the run view.
  - Title check: `gh pr edit --title "Add workflows"` makes `pr-title` fail. Restoring
    `ci: add CI and release workflows` makes it pass.
  - Failures: throwaway branch `ci-check-failures` from the workflows branch, draft PR, one
    commit with a lint error, a failing test and a type error. Each job fails for its own
    reason: `lint` on the lint rule, `test` on the test, `build` on `tsc`. A second commit
    changes `package.json` without updating the lockfile. All three fail at
    `pnpm install --frozen-lockfile`. Close the draft PR and delete the branch.
  - Acceptance: the outcomes above, written in this task's "Done" note.
  - Files: none kept.
  - Size: S.

- [ ] **T7: Repository settings (maintainer)**
  - The maintainer applies spec settings 1–3 in the GitHub UI. Setting 2 ("Allow GitHub
    Actions to create and approve pull requests") is required before T8.
  - Required checks: `lint`, `test`, `build`, `pr-title`. They show up in the picker only
    after they ran once (T6).
  - Acceptance: `gh api repos/jorgetroya80/artwork-search --jq
'{squash: .allow_squash_merge, merge: .allow_merge_commit, rebase: .allow_rebase_merge}'`
    shows squash only. A PR with a failing check shows "Merging is blocked".
  - Files: none.
  - Size: XS.

### Checkpoint 2: Ready to merge

- [ ] All four checks are green on the workflows PR. Settings 1–3 are on.
- [ ] Review with the user, then squash-merge the workflows PR.

### Phase 3: First release

- [ ] **T8: Release PR and v0.1.0**
  - After the merge, `release.yml` runs on `main` and opens `chore(main): release 0.1.0`.
  - Check the release PR: `package.json` and the manifest say `0.1.0`. `CHANGELOG.md` has only
    Features and Bug Fixes sections, and the entries come from PRs #1–#3.
  - Close and reopen the release PR. The four checks run and pass. Squash-merge it.
  - Acceptance: `git ls-remote --tags origin v0.1.0` returns one tag, and
    `gh release view v0.1.0` shows the same notes as `CHANGELOG.md`.
  - Files: none by hand (release-please writes them).
  - Size: XS.

- [ ] **T9: No release for `docs:`, close the spec**
  - In a `docs:` PR: set the spec status to **implemented**, set this plan's status, and check
    off the spec success criteria. After the merge, `release.yml` runs and opens no release PR.
  - Acceptance: `gh pr list --label "autorelease: pending"` is empty after the `docs:` merge.
  - Files: `docs/specs/SPEC-ci-release.md`, `docs/plans/PLAN-ci-release.md`.
  - Size: XS.

### Checkpoint 3: Complete

- [ ] All spec success criteria are checked.
- [ ] Tag `v0.1.0` and its GitHub Release exist.

## Risks and mitigations

| Risk                                                                        | Impact                              | Mitigation                                                                                                                                |
| --------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| release-please reads its config from `main` on GitHub, not from the branch  | Medium: no dry run before the merge | Config copied from the spec and JSON-checked in T4. If the first run is wrong, fix the config in a `ci:` PR and close the bad release PR  |
| First changelog is noisy (all commits of PRs #1–#3, merge commits included) | Low                                 | Merge commits are not Conventional Commits and are skipped. Hidden types keep only `feat` / `fix`. Accepted in the spec ("First release") |
| Setting 2 is off when the workflows PR merges                               | Medium: first release run fails     | T7 before Checkpoint 2. If it happens anyway: turn it on and re-run the failed `release.yml` run                                          |
| Release PR checks stay pending (`GITHUB_TOKEN` starts no workflows)         | Low: merge blocked                  | Close and reopen before merge (spec, README)                                                                                              |
| `pnpm/action-setup` cannot read `packageManager` (`pnpm@12.8.1`)            | Medium: every CI job fails at setup | Checked in T1. Fallback: set `version: 12.8.1` in the action input                                                                        |
| `edited` events re-run `lint`, `test`, `build` on every title or body edit  | Low: extra runner minutes           | Accepted in the spec. `cancel-in-progress` stops the older run                                                                            |
| Pinned SHAs get old (no Dependabot)                                         | Low                                 | Accepted in the spec. Update by hand with the T1 commands                                                                                 |
