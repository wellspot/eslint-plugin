// Lint config for this repository itself (not the config shipped to consumers).
import js from '@eslint/js';
import eslintPlugin from 'eslint-plugin-eslint-plugin';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/', 'coverage/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly' },
    },
  },
  {
    // Checks that rules follow ESLint authoring best practices
    // (meta.messages, schema, docs URLs, test-case hygiene, ...).
    files: ['src/rules/**/*.ts', 'tests/rules/**/*.ts'],
    extends: [eslintPlugin.configs.recommended],
  },
);
