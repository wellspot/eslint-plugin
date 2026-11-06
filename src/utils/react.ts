import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

export type FunctionNode =
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression;

/** `useFoo`, `use0`, or React 19's bare `use`. */
export function isHookName(name: string): boolean {
  return /^use(?:[A-Z0-9].*)?$/.test(name);
}

/** React components are PascalCase by convention (and React Compiler relies on it). */
export function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

export function isFunctionNode(node: TSESTree.Node): node is FunctionNode {
  return (
    node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression
  );
}

/**
 * Returns the name of the function being called:
 * `useState()` -> "useState", `React.useState()` -> "useState", `a.b.c()` -> "c".
 */
export function getCalleeName(node: TSESTree.CallExpression): string | null {
  const { callee } = node;
  if (callee.type === AST_NODE_TYPES.Identifier) return callee.name;
  if (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    !callee.computed &&
    callee.property.type === AST_NODE_TYPES.Identifier
  ) {
    return callee.property.name;
  }
  return null;
}

/**
 * Best-effort name for a function, following the same heuristics React Compiler
 * uses to decide whether something is a component or hook:
 *
 *   function Foo() {}                 -> "Foo"
 *   const Foo = () => {}              -> "Foo"
 *   const Foo = memo(() => {})        -> "Foo"
 *   const Foo = memo(forwardRef(...)) -> "Foo"
 */
export function getFunctionName(node: FunctionNode): string | null {
  if (node.id) return node.id.name;

  let current: TSESTree.Node = node;
  // Walk up through wrapper calls like memo()/forwardRef().
  while (current.parent?.type === AST_NODE_TYPES.CallExpression) {
    current = current.parent;
  }

  const { parent } = current;
  if (
    parent?.type === AST_NODE_TYPES.VariableDeclarator &&
    parent.init === current &&
    parent.id.type === AST_NODE_TYPES.Identifier
  ) {
    return parent.id.name;
  }
  return null;
}

/** True when `node` looks like a React component or custom hook definition. */
export function isComponentOrHook(node: FunctionNode): boolean {
  const name = getFunctionName(node);
  return name !== null && (isComponentName(name) || isHookName(name));
}

const OPT_OUT_DIRECTIVES = new Set(['use no memo', 'use no forget']);

/** True when a function body or the file starts with `'use no memo'` (React Compiler opt-out). */
export function hasOptOutDirective(node: FunctionNode | TSESTree.Program): boolean {
  const body = node.type === AST_NODE_TYPES.Program ? node.body : node.body.type === AST_NODE_TYPES.BlockStatement ? node.body.body : [];
  for (const statement of body) {
    if (statement.type !== AST_NODE_TYPES.ExpressionStatement || statement.directive === undefined) break;
    if (OPT_OUT_DIRECTIVES.has(statement.directive)) return true;
  }
  return false;
}
