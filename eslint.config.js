import js from '@eslint/js';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      react.configs.flat.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      eslintPluginPrettier,
      betterTailwindcss.configs['recommended-error'],
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: { project: ['./tsconfig.app.json', './tsconfig.node.json'] },
    },
    settings: {
      react: { version: 'detect' },
      'better-tailwindcss': { entryPoint: 'src/index.css' },
    },
    rules: {
      'no-console': 'error', // https://eslint.org/docs/latest/rules/no-console
      'no-tabs': 'off', // https://eslint.org/docs/latest/rules/no-tabs
      quotes: 'off', // https://eslint.org/docs/latest/rules/quotes
      // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-boolean-value.md
      'react/jsx-boolean-value': 'error',

      // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/self-closing-comp.md
      'react/self-closing-comp': 'error',

      // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/react-in-jsx-scope.md
      'react/react-in-jsx-scope': 'off',

      // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-curly-brace-presence.md
      'react/jsx-curly-brace-presence': [
        'error',
        { props: 'never', children: 'never', propElementValues: 'always' },
      ],

      // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-useless-fragment.md
      'react/jsx-no-useless-fragment': 'error',

      // https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/prop-types.md
      'react/prop-types': 'off',

      // https://github.com/facebook/react/blob/main/packages/eslint-plugin-react-hooks/src/rules/ExhaustiveDeps.ts
      'react-hooks/exhaustive-deps': 'error',

      'better-tailwindcss/enforce-consistent-class-order': 'off',
      'better-tailwindcss/enforce-consistent-line-wrapping': 'off',

      // https://typescript-eslint.io/rules/no-unused-vars
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true },
      ],

      // https://typescript-eslint.io/rules/restrict-template-expressions
      '@typescript-eslint/restrict-template-expressions': 'off',

      // https://typescript-eslint.io/blog/consistent-type-imports-and-exports-why-and-how
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',

      // https://typescript-eslint.io/rules/unbound-method/
      '@typescript-eslint/unbound-method': 'error',

      // https://typescript-eslint.io/rules/naming-convention
      '@typescript-eslint/naming-convention': [
        'error',
        // Enforce type parameters to be in PascalCase and start with a `T` prefix
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
          prefix: ['T'],
        },
        // Enforce interfaces to be in PascalCase and NOT start with an `I` prefix
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: {
            regex: '^I[A-Z]',
            match: false,
          },
          leadingUnderscore: 'allow',
        },
        // Enforce types to be in PascalCase and NOT start with a `T` prefix
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
          custom: {
            regex: '^T[A-Z]',
            match: false,
          },
          leadingUnderscore: 'allow',
        },
      ],

      'no-restricted-syntax': [
        'error',

        // Ban all enums:
        {
          selector: 'TSEnumDeclaration',
          message: 'Use `as const` or string union instead.',
        },
      ],

      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            'React.FC': {
              message:
                '`React.FC` is unnecessary and has many downsides, as explained in https://github.com/facebook/create-react-app/pull/8177',
            },
          },
        },
      ],

      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              importNames: ['FC'],
              message:
                '`FC` is unnecessary and has many downsides, as explained in https://github.com/facebook/create-react-app/pull/8177',
            },
          ],
        },
      ],
    },
  },
]);
