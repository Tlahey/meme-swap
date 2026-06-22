import nextConfig from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextConfig,
  {
    ignores: ['.next/**', 'node_modules/**', 'build/**'],
  },
];

export default config;
