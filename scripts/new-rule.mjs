#!/usr/bin/env node
// Usage: npm run new-rule <rule-name>
// Creates the rule, test and docs files and registers the rule in src/rules/index.ts.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const name = process.argv[2];

if (!name || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
  console.error('Usage: npm run new-rule <kebab-case-rule-name>');
  process.exit(1);
}

const camel = name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const files = {
  [`src/rules/${name}.ts`]: `import type { TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils/create-rule';

export const RULE_NAME = '${name}';

export type MessageIds = 'default';
export type Options = [];

export default createRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: 'TODO: describe what this rule disallows',
      recommended: false,
      upstreamIssues: [],
    },
    messages: {
      default: 'TODO: explain the React Compiler bug and the workaround.',
    },
    // JSON Schema for options. If you add options, also set
    // \`defaultOptions: [{ ... }]\` here and update the Options type.
    schema: [],
  },

  create(context) {
    return {
      // TODO: replace with a selector that matches the bug pattern.
      'CallExpression[callee.name="TODO"]'(node: TSESTree.CallExpression) {
        context.report({ node, messageId: 'default' });
      },
    };
  },
});
`,
  [`tests/rules/${name}.test.ts`]: `import rule, { RULE_NAME } from '../../src/rules/${name}';
import { ruleTester } from '../rule-tester';

ruleTester.run(RULE_NAME, rule, {
  valid: [
    \`
      function Component() {
        return null;
      }
    \`,
  ],
  invalid: [
    {
      code: \`
        function Component() {
          TODO();
          return null;
        }
      \`,
      errors: [{ messageId: 'default' }],
    },
  ],
});
`,
  [`docs/rules/${name}.md`]: `# \`@wellspot/${name}\`

TODO: describe what this rule disallows.

- 🐛 Upstream issue(s): TODO

## Rule details

Examples of **incorrect** code:

\`\`\`tsx
\`\`\`

Examples of **correct** code:

\`\`\`tsx
\`\`\`

## When not to use it

When the upstream React Compiler bug is fixed and you've upgraded to a release
that includes the fix.
`,
};

for (const path of Object.keys(files)) {
  if (existsSync(`${root}/${path}`)) {
    console.error(`${path} already exists; nothing was written.`);
    process.exit(1);
  }
}

const indexPath = `${root}/src/rules/index.ts`;
const IMPORT_MARKER = '// new-rule:imports';
const ENTRY_MARKER = '  // new-rule:entries';
const index = readFileSync(indexPath, 'utf8');
if (!index.includes(IMPORT_MARKER) || !index.includes(ENTRY_MARKER)) {
  console.error('Markers missing from src/rules/index.ts; register the rule manually.');
  process.exit(1);
}

for (const [path, content] of Object.entries(files)) {
  writeFileSync(`${root}/${path}`, content);
  console.log(`created  ${path}`);
}

writeFileSync(
  indexPath,
  index
    .replace(IMPORT_MARKER, `import ${camel} from './${name}';\n${IMPORT_MARKER}`)
    .replace(ENTRY_MARKER, `  '${name}': ${camel},\n${ENTRY_MARKER}`),
);
console.log('updated  src/rules/index.ts');
console.log(`\nNext: add a row for ${name} to the README rules table, then run \`npm run test:watch\`.`);
