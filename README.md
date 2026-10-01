# Artwork search

This project is searching and viewing interface for the Rijksmuseum collection, built on the public
Rijksmuseum Linked Art API.

## Stack

- React `19.3` with [React Compiler](https://react.dev/learn/react-compiler)
- TypeScript `6.0`
- Vite `8`
- Tailwind CSS `4`
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

## Notes

- TypeScript stays on `6.0` because `typescript-eslint` does not support
  TypeScript 7 yet
  ([typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)).
- React Compiler runs through Babel (`@rolldown/plugin-babel` with
  `reactCompilerPreset`), configured in `vite.config.ts`.
- A pre-commit hook runs `lint-staged` (Prettier and ESLint) on staged files.
