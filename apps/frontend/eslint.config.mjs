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
    ignores: ['.next/**', 'node_modules/**', 'build/**'],
  },
];

export default config;
