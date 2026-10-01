import eslintReact from '@eslint-react/eslint-plugin';
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const restrictedImportPaths = [
  {
    name: 'react',
    importNames: ['FC'],
    message:
      '`FC` is unnecessary and has many downsides, as explained in https://github.com/facebook/create-react-app/pull/8177',
  },
];

const restrictedUiLibrary = {
  group: ['@base-ui/*'],
  message:
    'Import UI components from src/components/ui, not from the UI library.',
};

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      eslintReact.configs['recommended-type-checked'],
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      eslintPluginPrettier,
      betterTailwindcss.configs['recommended-error'],
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json'],
      },
    },
    plugins: { '@stylistic': stylistic },
    settings: {
      'better-tailwindcss': { entryPoint: 'src/index.css' },
    },
    rules: {
      'no-console': 'error', // https://eslint.org/docs/latest/rules/no-console
      'no-tabs': 'off', // https://eslint.org/docs/latest/rules/no-tabs
      quotes: 'off', // https://eslint.org/docs/latest/rules/quotes
      // Overlap with eslint-plugin-react-hooks (official React Compiler rules); keep those
      '@eslint-react/error-boundaries': 'off',
      '@eslint-react/exhaustive-deps': 'off',
      '@eslint-react/purity': 'off',
      '@eslint-react/rules-of-hooks': 'off',
      '@eslint-react/set-state-in-effect': 'off',
      '@eslint-react/set-state-in-render': 'off',
      '@eslint-react/static-components': 'off',
      '@eslint-react/unsupported-syntax': 'off',
      '@eslint-react/use-memo': 'off',

      // https://eslint.style/rules/jsx-self-closing-comp
      '@stylistic/jsx-self-closing-comp': 'error',

      // https://eslint.style/rules/jsx-curly-brace-presence
      '@stylistic/jsx-curly-brace-presence': [
        'error',
        { props: 'never', children: 'never', propElementValues: 'always' },
      ],

      // https://www.eslint-react.xyz/docs/rules/jsx-no-useless-fragment
      '@eslint-react/jsx-no-useless-fragment': 'error',

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

        // Replaces react/jsx-boolean-value ('never'): ban `prop={true}`
        {
          selector:
            'JSXAttribute > JSXExpressionContainer > Literal[value=true]',
          message: 'Use the shorthand `prop` instead of `prop={true}`.',
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
        { paths: restrictedImportPaths, patterns: [restrictedUiLibrary] },
      ],
    },
  },
  {
    // UI wrappers are the only place allowed to import the UI library
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            ...restrictedImportPaths,
            {
              name: '@base-ui/react',
              message:
                'Import Base UI by subpath (e.g. @base-ui/react/button), so only used parts are bundled.',
            },
          ],
        },
      ],
    },
  },
]);
