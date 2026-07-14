import { defineConfig } from 'vitest/config';

export const baseConfig = defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/dist/**', '**/build/**', '**/node_modules/**'],
    passWithNoTests: false,
  },
});

export default baseConfig;
