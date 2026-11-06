// Runs the fixtures through the real React Compiler to confirm the rule matches
// what the compiler actually does (https://github.com/react/react/issues/37888).
//
// If a `buggy` case starts failing after a babel-plugin-react-compiler upgrade,
// the compiler now keeps the copy: the bug may be fixed upstream, and the rule
// can be deprecated.
import { parseSync, transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';
import { buggy, unaffected, type Fixture } from '../fixtures/no-local-copy-of-module-variable';

function compile(code: string): string {
  const result = transformSync(code, {
    filename: 'fixture.tsx',
    babelrc: false,
    configFile: false,
    plugins: [
      '@babel/plugin-syntax-jsx',
      ['@babel/plugin-syntax-typescript', { isTSX: true }],
      // panicThreshold 'none' = skip functions the compiler can't handle (the default in apps).
      ['babel-plugin-react-compiler', { panicThreshold: 'none' }],
    ],
  });
  if (!result?.code) throw new Error('React Compiler produced no output');
  return result.code;
}

interface AstNode {
  type: string;
  [key: string]: unknown;
}

function isNode(value: unknown): value is AstNode {
  return typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string';
}

/** Does a declarator's binding pattern (`x`, `{ a: x }`, `[x]`, ...) declare `name`? */
function bindsName(pattern: unknown, name: string): boolean {
  if (!isNode(pattern)) return false;
  switch (pattern.type) {
    case 'Identifier':
      return pattern.name === name;
    case 'ObjectPattern':
      return (pattern.properties as AstNode[]).some((property) =>
        bindsName(property.type === 'ObjectProperty' ? property.value : property.argument, name),
      );
    case 'ArrayPattern':
      return (pattern.elements as unknown[]).some((element) => bindsName(element, name));
    case 'AssignmentPattern':
      return bindsName(pattern.left, name);
    case 'RestElement':
      return bindsName(pattern.argument, name);
    default:
      return false;
  }
}

/** Is there a `const|let|var <copy> = <something>` declaration anywhere in `ast`? */
function hasInitializedDeclaration(ast: unknown, name: string): boolean {
  if (Array.isArray(ast)) return ast.some((child) => hasInitializedDeclaration(child, name));
  if (!isNode(ast)) return false;
  if (ast.type === 'VariableDeclarator' && ast.init && bindsName(ast.id, name)) return true;
  return Object.entries(ast).some(
    ([key, value]) => key !== 'loc' && typeof value === 'object' && hasInitializedDeclaration(value, name),
  );
}

/**
 * True when the compiled output still declares the copy with its initializer.
 * The bug shows up as the declaration disappearing (`copy` rewritten to the
 * module variable) or losing its initializer (`let copy;`).
 */
function keepsCopy({ code, copy = 'copy' }: Fixture): boolean {
  const ast = parseSync(compile(code), {
    filename: 'compiled.tsx',
    babelrc: false,
    configFile: false,
    plugins: ['@babel/plugin-syntax-jsx', ['@babel/plugin-syntax-typescript', { isTSX: true }]],
  });
  return hasInitializedDeclaration(ast?.program, copy);
}

describe('React Compiler drops the copy (bug still present upstream)', () => {
  it.each(buggy.map((fixture) => [fixture.name, fixture] as const))('%s', (_, fixture) => {
    expect(keepsCopy(fixture)).toBe(false);
  });
});

describe('React Compiler keeps the copy', () => {
  it.each(unaffected.map((fixture) => [fixture.name, fixture] as const))('%s', (_, fixture) => {
    expect(keepsCopy(fixture)).toBe(true);
  });
});
