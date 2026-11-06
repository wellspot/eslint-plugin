/**
 * Guards against https://github.com/react/react/issues/37888
 *
 * React Compiler replaces a local copy of a module-level variable with the
 * variable itself:
 *
 *   let pending = 'value';
 *   function Component() {
 *     const onClick = () => {
 *       const copy = pending;   // dropped by the compiler...
 *       pending = null;
 *       console.log(copy);      // ...so this becomes console.log(pending) -> null
 *     };
 *   }
 *
 * The replacement is harmless unless the variable can change between the copy
 * and a read of the copy. This rule reports a copy when some read of it could
 * see a different value:
 *   - the read happens inside a closure (it can run at any later time), or
 *   - a reassignment of the variable, a function call, `await`, `yield` or a
 *     tagged template sits between the copy and the read (or in a loop around both).
 *
 * The behavior below was confirmed against babel-plugin-react-compiler 1.0.0
 * (see tests/compiler/no-local-copy-of-module-variable.compiler.test.ts):
 *   - affected: `const`/`let` copies, `x!`, typed declarators (`const c: T = x`),
 *     in components and hooks, in the render body or any nested function
 *   - not affected: `x as T`, `x satisfies T`, `var` copies, `x.prop`,
 *     destructuring, `'use no memo'`, functions the compiler doesn't compile
 */
import { AST_NODE_TYPES, ASTUtils, TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../utils/create-rule';
import {
  getCalleeName,
  hasOptOutDirective,
  isComponentOrHook,
  isFunctionNode,
  isHookName,
  type FunctionNode,
} from '../utils/react';

export const RULE_NAME = 'no-local-copy-of-module-variable';

export type MessageIds = 'localCopyOfModuleVariable';
export type Options = [];

type Variable = TSESLint.Scope.Variable;
type Scope = TSESLint.Scope.Scope;

interface Candidate {
  declarator: TSESTree.VariableDeclarator & { id: TSESTree.Identifier };
  /** Nearest function containing the copy. */
  declaringFunction: FunctionNode;
  /** The component or hook the compiler would compile. */
  owner: FunctionNode;
  source: Variable;
  copy: Variable;
}

const LOOP_TYPES = new Set<AST_NODE_TYPES>([
  AST_NODE_TYPES.DoWhileStatement,
  AST_NODE_TYPES.ForInStatement,
  AST_NODE_TYPES.ForOfStatement,
  AST_NODE_TYPES.ForStatement,
  AST_NODE_TYPES.WhileStatement,
]);

function nearestFunction(node: TSESTree.Node): FunctionNode | null {
  for (let current = node.parent; current; current = current.parent) {
    if (isFunctionNode(current)) return current;
  }
  return null;
}

function nearestComponentOrHook(node: TSESTree.Node): FunctionNode | null {
  for (let current = node.parent; current; current = current.parent) {
    if (isFunctionNode(current) && isComponentOrHook(current)) return current;
  }
  return null;
}

function contains(outer: TSESTree.Node, inner: TSESTree.Node): boolean {
  return outer.range[0] <= inner.range[0] && inner.range[1] <= outer.range[1];
}

function isModuleScope(scope: Scope): boolean {
  return scope.type === TSESLint.Scope.ScopeType.module || scope.type === TSESLint.Scope.ScopeType.global;
}

/**
 * A module-level `let`/`var` that is reassigned inside some function, so its
 * value can change after the module has loaded. (If it's only assigned at the
 * top level, every copy taken during render or later sees the same value.)
 */
function isMutableModuleVariable(variable: Variable): boolean {
  const [def] = variable.defs;
  if (
    !isModuleScope(variable.scope) ||
    variable.defs.length !== 1 ||
    def?.type !== TSESLint.Scope.DefinitionType.Variable ||
    (def.parent.kind !== 'let' && def.parent.kind !== 'var')
  ) {
    return false;
  }
  return variable.references.some(
    (ref) => ref.isWrite() && !ref.init && !isModuleScope(ref.from.variableScope),
  );
}

/** `x!` is dropped like a plain `x`; `x as T` / `x satisfies T` are not. */
function unwrapNonNull(expression: TSESTree.Expression): TSESTree.Expression {
  let current = expression;
  while (current.type === AST_NODE_TYPES.TSNonNullExpression) current = current.expression;
  return current;
}

export default createRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow local copies of mutable module-level variables that React Compiler replaces with the variable itself',
      recommended: true,
      upstreamIssues: ['https://github.com/react/react/issues/37888'],
    },
    messages: {
      localCopyOfModuleVariable:
        '`{{copy}}` copies the module-level variable `{{source}}`, but React Compiler replaces ' +
        '`{{copy}}` with `{{source}}` itself (react/react#37888). `{{source}}` can change before ' +
        '`{{copy}}` is read, so the read would see the new value. Move this logic into a function ' +
        "outside the component, or opt the component out with 'use no memo'.",
    },
    schema: [],
  },

  create(context) {
    const { sourceCode } = context;
    const candidates: Candidate[] = [];
    /** Nodes that may run code which reassigns a module variable. */
    const opaqueOperations: TSESTree.Node[] = [];
    /** Components/hooks the compiler compiles in its default "infer" mode (they create JSX or call hooks). */
    const compiledFunctions = new Set<FunctionNode>();

    function markEnclosingComponentsCompiled(node: TSESTree.Node): void {
      for (let current = node.parent; current; current = current.parent) {
        if (isFunctionNode(current) && isComponentOrHook(current)) compiledFunctions.add(current);
      }
    }

    /** Could `read` (a read of the copy) see a different value than the one copied? */
    function canObserveChange(read: TSESTree.Node, candidate: Candidate, changes: TSESTree.Node[]): boolean {
      // Inside a closure: it can run at any later time, after any reassignment.
      if (nearestFunction(read) !== candidate.declaringFunction) return true;

      // A change between the copy and the read.
      if (changes.some((change) => change.range[1] <= read.range[0])) return true;

      // A change later in a loop body runs before the read's next iteration.
      for (let current = read.parent; current && current !== candidate.declaringFunction; current = current.parent) {
        if (
          LOOP_TYPES.has(current.type) &&
          !contains(current, candidate.declarator) &&
          changes.some((change) => contains(current, change))
        ) {
          return true;
        }
      }
      return false;
    }

    return {
      'JSXElement, JSXFragment'(node: TSESTree.JSXElement | TSESTree.JSXFragment) {
        markEnclosingComponentsCompiled(node);
      },

      CallExpression(node: TSESTree.CallExpression) {
        const name = getCalleeName(node);
        if (name && isHookName(name)) markEnclosingComponentsCompiled(node);
      },

      'CallExpression, NewExpression, AwaitExpression, YieldExpression, TaggedTemplateExpression'(
        node: TSESTree.Node,
      ) {
        opaqueOperations.push(node);
      },

      VariableDeclarator(node: TSESTree.VariableDeclarator) {
        if (node.id.type !== AST_NODE_TYPES.Identifier || !node.init) return;
        if (node.parent.kind !== 'const' && node.parent.kind !== 'let') return;

        const init = unwrapNonNull(node.init);
        if (init.type !== AST_NODE_TYPES.Identifier) return;

        const source = ASTUtils.findVariable(sourceCode.getScope(init), init);
        if (!source || !isMutableModuleVariable(source)) return;

        const owner = nearestComponentOrHook(node);
        const declaringFunction = nearestFunction(node);
        const [copy] = sourceCode.getDeclaredVariables(node);
        if (!owner || !declaringFunction || !copy) return;

        candidates.push({
          declarator: node as Candidate['declarator'],
          declaringFunction,
          owner,
          source,
          copy,
        });
      },

      // Reported at the end, once we know which components contain JSX/hook calls.
      'Program:exit'(program: TSESTree.Program) {
        if (hasOptOutDirective(program)) return;

        for (const candidate of candidates) {
          const { declarator, declaringFunction, owner, source, copy } = candidate;
          if (!compiledFunctions.has(owner) || hasOptOutDirective(owner)) continue;

          const reassignments = source.references
            .filter((ref) => ref.isWrite() && !ref.init)
            .map((ref) => ref.identifier);
          // Only changes made directly in the same function, after the copy.
          // Changes inside nested functions take effect through a call, which is
          // itself one of the opaque operations.
          const changes = [...reassignments, ...opaqueOperations].filter(
            (node) => node.range[0] >= declarator.range[1] && nearestFunction(node) === declaringFunction,
          );

          const unsafe = copy.references.some(
            (ref) => ref.isRead() && canObserveChange(ref.identifier, candidate, changes),
          );
          if (!unsafe) continue;

          context.report({
            node: declarator.id,
            messageId: 'localCopyOfModuleVariable',
            data: { copy: declarator.id.name, source: source.name },
          });
        }
      },
    };
  },
});
