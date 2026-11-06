/**
 * BOILERPLATE RULE — replace the detection logic with the real bug pattern.
 *
 * As a working example it reports hook calls inside `try` / `catch` / `finally`
 * blocks of components and custom hooks. React's Rules of Hooks forbid this, and
 * it is a convenient pattern for showing every part of a rule: selectors, ancestor
 * walking, options, message data and tests.
 *
 * When you target an actual React Compiler bug:
 *   1. Rename the file/rule after the pattern (e.g. `no-<pattern>`), or run
 *      `npm run new-rule <name>` and delete this one.
 *   2. Put the upstream issue link(s) in `meta.docs.upstreamIssues`.
 *   3. Write the smallest snippets that reproduce the bug as `invalid` tests first.
 */
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils/create-rule';
import {
  getCalleeName,
  getFunctionName,
  isComponentOrHook,
  isFunctionNode,
  isHookName,
  type FunctionNode,
} from '../utils/react';

export const RULE_NAME = 'no-react-compiler-bug';

export type MessageIds = 'hookInTryStatement';
export type Options = [
  {
    /** Hook names to skip, e.g. `["useMyLegacyHook"]`. */
    ignore?: string[];
  },
];

export default createRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow code patterns that trigger known React Compiler bugs (boilerplate: hooks inside try/catch/finally)',
      recommended: true,
      upstreamIssues: [],
    },
    messages: {
      hookInTryStatement:
        'Hook `{{hook}}` is called inside a try/catch/finally block in `{{fn}}`. ' +
        'Move the hook call to the top level of the component or hook.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          ignore: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true,
            description: 'Hook names to skip.',
          },
        },
        additionalProperties: false,
      },
    ],
    // Deep-merged into the user's options before `create` receives them.
    defaultOptions: [{ ignore: [] }],
  },

  create(context, [{ ignore = [] }]) {
    const ignored = new Set(ignore);

    /**
     * Walks up from `node` to its enclosing function.
     * Returns that function if a TryStatement sits between the two, else null.
     * (A try block in an *outer* function doesn't count.)
     */
    function findFunctionWithTryBetween(node: TSESTree.Node): FunctionNode | null {
      let sawTry = false;
      for (let current = node.parent; current; current = current.parent) {
        if (isFunctionNode(current)) return sawTry ? current : null;
        if (current.type === AST_NODE_TYPES.TryStatement) sawTry = true;
      }
      return null;
    }

    return {
      // ESLint selectors work like CSS selectors over the AST. This one matches
      // every CallExpression that has a TryStatement ancestor, so the handler
      // runs only for calls that could matter.
      // Use https://typescript-eslint.io/play (AST tab) to explore node shapes.
      'TryStatement CallExpression'(node: TSESTree.CallExpression) {
        const hook = getCalleeName(node);
        if (!hook || !isHookName(hook) || ignored.has(hook)) return;

        const fn = findFunctionWithTryBetween(node);
        if (!fn || !isComponentOrHook(fn)) return;

        context.report({
          node,
          messageId: 'hookInTryStatement',
          data: { hook, fn: getFunctionName(fn) ?? '<anonymous>' },
        });
      },
    };
  },
});
