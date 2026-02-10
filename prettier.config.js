/** @type {import("@ianvs/prettier-plugin-sort-imports").PrettierConfig} */
export default {
  plugins: [
    '@ianvs/prettier-plugin-sort-imports',
    'prettier-plugin-packagejson',

    // Tailwind plugin MUST be last in the list
    // https://github.com/tailwindlabs/prettier-plugin-tailwindcss#compatibility-with-other-prettier-plugins
    'prettier-plugin-tailwindcss',
  ],

  singleQuote: true,
  trailingComma: 'es5',

  // tailwind classname sorting
  tailwindFunctions: ['classNames', 'cn'],

  // import sorting options
  importOrder: [
    '^(react/(.*)$)|^(react$)',
    '<THIRD_PARTY_MODULES>',
    '',
    '^~/(.*)$',
    '',
    '^[./]',
  ],
  importOrderParserPlugins: [
    'decorators-legacy',
    'importAttributes',
    'jsx',
    'typescript',
  ],
  importOrderTypeScriptVersion: '5.0.0',
};
