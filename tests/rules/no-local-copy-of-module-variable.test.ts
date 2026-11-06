import rule, { RULE_NAME } from '../../src/rules/no-local-copy-of-module-variable';
import { buggy, harmless, unaffected } from '../fixtures/no-local-copy-of-module-variable';
import { ruleTester } from '../rule-tester';

ruleTester.run(RULE_NAME, rule, {
  valid: [...unaffected, ...harmless].map(({ name, code }) => ({ name, code })),

  invalid: buggy.map(({ name, code, copy = 'copy', source = 'pending' }) => ({
    name,
    code,
    errors: [{ messageId: 'localCopyOfModuleVariable' as const, data: { copy, source } }],
  })),
});

// Location and message details, checked once on the issue's own example.
ruleTester.run(`${RULE_NAME} (report location)`, rule, {
  valid: [],
  invalid: [
    {
      code: `
let pending = 'value';
export function Component() {
  const handleClick = () => {
    const copy = pending;
    pending = null;
    console.log(copy);
  };
  return <button onClick={handleClick}>Click</button>;
}
`,
      errors: [
        {
          messageId: 'localCopyOfModuleVariable',
          data: { copy: 'copy', source: 'pending' },
          line: 5,
          column: 11,
          endColumn: 15,
        },
      ],
    },
  ],
});
