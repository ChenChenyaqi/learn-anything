import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: [
      'packages/*/dist/',
      'packages/cli/site/dist/**',
      'packages/cli/site-dist/**',
      'packages/*/node_modules/',
      'packages/*/bin/',
      '.claude/',
      '.learn/',
      'packages/cli/site/topics/',
      'packages/cli/test/fixtures/',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
