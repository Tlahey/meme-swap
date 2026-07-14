import eslintConfigPrettier from 'eslint-config-prettier';
import nextConfig from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextConfig,
  eslintConfigPrettier,
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    // @typescript-eslint is only registered (by eslint-config-next's
    // 'next/typescript' config object, above) for .ts/.tsx files, so this
    // rule must be scoped the same way — applying it repo-wide would error
    // on any non-TS file (e.g. this config file itself) with "could not
    // find plugin '@typescript-eslint'".
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'build/**'],
  },
];

export default config;
