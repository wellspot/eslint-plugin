import { RuleTester } from '@typescript-eslint/rule-tester';

/**
 * Shared RuleTester: parses with @typescript-eslint/parser and JSX enabled, so
 * test cases can be written as TSX (the default filename becomes `react.tsx`).
 */
export const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});
