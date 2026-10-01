# Artwork search

This project is searching and viewing interface for the Rijksmuseum collection, built on the public
Rijksmuseum Linked Art API.

## Stack

- React `19.3` with [React Compiler](https://react.dev/learn/react-compiler)
- TypeScript `6.0`
- Vite `8`
- Tailwind CSS `4`, with semantic color and radius tokens in `src/index.css`
- [Base UI](https://base-ui.com/react) `1.8`, used only behind the wrappers in `src/components/ui`
- TanStack Query `5`
- ESLint `10` and Prettier `3`

## Requirements

This project requires to run:

- NodeJS version `24.18.0` (see `.nvmrc`)
- pnpm version `12.8.1` (pinned in the `packageManager` field of `package.json`)

The Rijksmuseum search API is public and does not need an API key.

## Setup

```sh
nvm use
corepack enable
pnpm install
```

pnpm only installs package versions published at least 10 days ago
(`minimumReleaseAge`). Dependencies are pinned to exact versions
(`saveExact: true` in `pnpm-workspace.yaml`).

## Available Scripts

In the project directory, you can run:

### `pnpm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.

### `pnpm build`

Type-checks the project and builds the app for production to the `dist`
folder.

### `pnpm preview`

Serves the production build from `dist` locally.

### `pnpm lint`

Lints the `src` folder with ESLint.

### `pnpm test`

Runs the tests once with Vitest. Tests use jsdom and mock the Rijksmuseum API with MSW, so they
never call the real API.

### `pnpm test:watch`

Runs the tests in watch mode.

### `pnpm test:coverage`

Runs the tests with coverage. It fails when line coverage of `src/api/rijksmuseum`,
`src/features/search` or `src/components` is below 90%.

## Search UI

Run `pnpm start` and search by artist name. The API matches whole words, so use a full name
("Rembrandt", not "Rembr"). Results load 10 at a time with "Load more".

UI library components are never imported directly: feature code uses the wrappers in
`src/components/ui`, and ESLint rejects `@base-ui/*` imports anywhere else.

## Documentation

- API spec: [`docs/specs/SPEC-artwork-search-api.md`](docs/specs/SPEC-artwork-search-api.md)
- API plan: [`docs/plans/PLAN-artwork-search-api.md`](docs/plans/PLAN-artwork-search-api.md)
- UI spec: [`docs/specs/SPEC-artwork-search-ui.md`](docs/specs/SPEC-artwork-search-ui.md)
- UI plan: [`docs/plans/PLAN-artwork-search-ui.md`](docs/plans/PLAN-artwork-search-ui.md)

## Notes

- TypeScript stays on `6.0` because `typescript-eslint` does not support
  TypeScript 7 yet
  ([typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)).
- React Compiler runs through Babel (`@rolldown/plugin-babel` with
  `reactCompilerPreset`), configured in `vite.config.ts`.
- A pre-commit hook runs `lint-staged` (Prettier and ESLint) on staged files.
