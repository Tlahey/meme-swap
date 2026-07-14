import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const baseConfig = tseslint.config(
  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/bundle/**', '**/out/**'],
  },
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      // Pre-existing code (Electron IPC bridges, MCP SDK interop, etc.) leans on `any` in
      // ~19 spots that would need real type design to fix, not a mechanical rename. Turning
      // this on would recreate the "large, out-of-scope violation backlog" that recommended
      // (vs. strict/type-checked) was chosen to avoid. Left off intentionally; revisit as a
      // separate, deliberate pass.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);

export default baseConfig;
