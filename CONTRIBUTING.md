# Contributing

## Setup

Development needs **Node ≥ 22.18** (for tsup and Vitest). The published plugin
supports every Node version ESLint 9 supports (≥ 18.18).

```sh
npm install      # also installs the git commit-msg hook (husky)
npm run check    # typecheck + lint + test + build + package checks (same as CI)
```

| Script | What it does |
| --- | --- |
| `npm test` / `npm run test:watch` | Vitest + RuleTester |
| `npm run build` / `npm run dev` | tsup build to `dist/` (ESM + CJS + `.d.ts`); `dev` rebuilds on change |
| `npm run typecheck` | `tsc --noEmit` over `src/` and `tests/` |
| `npm run lint` | Lints this repo, including `eslint-plugin-eslint-plugin` checks on the rules |
| `npm run new-rule <name>` | Creates the rule, test and docs files and registers the rule |
| `npm run lint:package` | `publint` and `attw` check the `exports` map and types for ESM/CJS consumers |

## Project layout

```
src/
  index.ts              plugin object: meta, rules, configs
  meta.ts               package name/version and the "@wellspot" namespace
  rules/
    index.ts            rule registry (name -> rule module)
    <rule-name>.ts      one file per rule
  configs/
    recommended.ts      built from rules whose meta.docs.recommended is true
  utils/
    create-rule.ts      typed RuleCreator (sets docs URLs automatically)
    react.ts            component/hook detection helpers
tests/
  setup.ts              connects RuleTester to Vitest
  rule-tester.ts        shared RuleTester (TSX enabled)
  rules/<rule-name>.test.ts
  plugin.test.ts        every rule has docs, a README entry and a test
  integration.test.ts   runs real ESLint with configs.recommended
docs/rules/<rule-name>.md
```

## Writing a rule

### 1. Scaffold it

```sh
npm run new-rule no-mutation-in-use-memo
```

This creates `src/rules/no-mutation-in-use-memo.ts`, its test and its docs page,
and registers it in `src/rules/index.ts`. Add a row to the README rules table
yourself (`tests/plugin.test.ts` fails until you do).

### 2. Reproduce first, then write the test

Start with the smallest snippet that triggers the React Compiler bug. The
[React Compiler Playground](https://playground.react.dev) is useful for confirming
the bug. Put that snippet in the rule's `invalid` tests and the closest correct
variants in `valid`.

### 3. Find the AST shape

Paste the snippet into the [typescript-eslint playground](https://typescript-eslint.io/play)
and open the **ESTree** tab to see node types and property names. Then pick a
[selector](https://eslint.org/docs/latest/extend/selectors) that matches as
narrowly as possible:

```ts
create(context) {
  return {
    // Every hook call by name (regex attribute selector).
    'CallExpression[callee.name=/^use[A-Z]/]'(node: TSESTree.CallExpression) {},

    // Arrow functions passed as the first argument to useMemo.
    'CallExpression[callee.name="useMemo"] > ArrowFunctionExpression:first-child'(
      node: TSESTree.ArrowFunctionExpression,
    ) {},

    // Runs after the subtree is done; good for "collect, then report" rules.
    'FunctionDeclaration:exit'(node: TSESTree.FunctionDeclaration) {},
  };
}
```

Useful context APIs:

- `context.sourceCode.getAncestors(node)`, or follow `node.parent` upward
- `context.sourceCode.getScope(node)` for variables and references
  (e.g. "is this identifier a prop or state?")
- `context.sourceCode.getText(node)` for the source text of a node
- `context.report({ node, messageId, data, fix, suggest })`

Shared helpers belong in `src/utils/`; `react.ts` already has `isHookName`,
`isComponentName`, `getFunctionName` and `isComponentOrHook`.

### 4. Fill in the meta

```ts
meta: {
  type: 'problem',                          // or 'suggestion' / 'layout'
  docs: {
    description: '...',
    recommended: true,                      // adds the rule to configs.recommended
    upstreamIssues: ['https://github.com/facebook/react/issues/XXXXX'],
  },
  messages: { someId: 'Explain the bug and the workaround. {{name}}' },
  schema: [],                               // JSON Schema for options; [] = no options
  // fixable: 'code',                       // only if you add a `fix`
  // hasSuggestions: true,                  // only if you add `suggest`
},
```

Only auto-fix when the rewrite is guaranteed to keep behavior the same.
Otherwise offer a suggestion (`suggest`), which the user applies in their
editor.

## Testing

Tests use `@typescript-eslint/rule-tester` (ESLint's `RuleTester` with TS/TSX
support), connected to Vitest in `tests/setup.ts`. Each case becomes its own
Vitest test.

```ts
ruleTester.run(RULE_NAME, rule, {
  valid: ['const ok = 1;', { code: '...', options: [{ ignore: ['useX'] }] }],
  invalid: [
    {
      code: '...',
      errors: [{ messageId: 'someId', data: { name: 'x' }, line: 3 }],
      // output: '...fixed code...',   // required when the rule fixes
    },
  ],
});
```

- Run a single case: add `only: true` to it.
- The default test filename is `react.tsx`; set `filename` on a case to change it.

## Using a local build in another project

Build first. In both approaches the consumer loads `dist/`, not `src/`.

### Option A: `npm link` (symlink)

```sh
# in this repo
npm run build
npm link                      # registers a global symlink to this folder

# in the consumer project
npm link @wellspot/eslint-plugin
```

Keep `npm run dev` running in this repo so `dist/` rebuilds when you save.
Things to watch for:

- Running `npm install` in the consumer can remove the link. Run `npm link @wellspot/eslint-plugin` again afterwards.
- The VS Code ESLint extension caches plugins. After a rebuild, run
  **"ESLint: Restart ESLint Server"** from the command palette.
- If you use `eslint --cache`, delete `.eslintcache` or results may be stale.
- Undo it: `npm unlink @wellspot/eslint-plugin` in the consumer, then
  `npm rm -g @wellspot/eslint-plugin`.

### Option B: `yalc` (closest to a real npm install)

[yalc](https://github.com/wclr/yalc) copies the packed files (only what `files`
includes) into the consumer. This avoids symlink problems like duplicate
`node_modules` or bundlers that don't follow symlinks.

```sh
npm i -g yalc

# in this repo
npm run build
yalc publish --no-scripts     # --no-scripts skips prepublishOnly (the full check)

# in the consumer project
yalc add @wellspot/eslint-plugin
npm install

# after each change, from this repo: rebuild and update every consumer
npm run build && yalc push

# or rebuild and push automatically on every save
npx tsup --watch --onSuccess "yalc push"
```

Undo it: `yalc remove @wellspot/eslint-plugin && npm install` in the consumer.
Add `.yalc/` and `yalc.lock` to the consumer's `.gitignore`.

### Option C: tarball (closest to a real release)

```sh
npm pack                                  # creates wellspot-eslint-plugin-<version>.tgz
cd ../consumer && npm i -D ../eslint-wellspot/wellspot-eslint-plugin-<version>.tgz
```

## Commits

This repo follows [Conventional Commits](https://www.conventionalcommits.org/),
enforced by commitlint in a husky `commit-msg` hook:

```
feat(rules): add no-mutation-in-use-memo
fix(no-react-compiler-bug): handle memo-wrapped components
docs: document yalc workflow
chore(deps): bump typescript-eslint
```

Use `feat` for a new rule or option and `fix` for false positives or negatives.
Mark a change as breaking (`feat!:` or a `BREAKING CHANGE:` footer) when it can
make existing code fail lint, such as adding a rule to `recommended` or removing
an option.
