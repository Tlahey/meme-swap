import baseConfig from '../../eslint.config.base.mjs';

export default [
  ...baseConfig,
  {
    // CommonJS electron-builder build hooks legitimately use require().
    files: ['scripts/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
