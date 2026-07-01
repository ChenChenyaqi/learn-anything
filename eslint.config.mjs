import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
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
      'packages/learn-agent/mock/',
    ],
  },
  {
    rules: {
      // TypeScript / vue-tsc already catch undefined references; eslint's core
      // no-undef rule misfires on browser/Node globals (document, HTMLElement…).
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      // The root component (App.vue) is intentionally a single word.
      'vue/multi-word-component-names': 'off',
    },
  },
);
