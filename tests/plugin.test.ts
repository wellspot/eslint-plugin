import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import plugin from '../src';

const root = fileURLToPath(new URL('..', import.meta.url));
const ruleEntries = Object.entries(plugin.rules);
const readme = readFileSync(`${root}/README.md`, 'utf8');

describe('plugin shape', () => {
  it('exposes meta from package.json', () => {
    expect(plugin.meta).toEqual({
      name: pkg.name,
      version: pkg.version,
      namespace: '@wellspot',
    });
  });

  it('recommended config enables exactly the rules marked recommended', () => {
    const expected = Object.fromEntries(
      ruleEntries
        .filter(([, rule]) => rule.meta?.docs?.recommended)
        .map(([name]) => [`@wellspot/${name}`, 'error']),
    );
    expect(plugin.configs.recommended.rules).toEqual(expected);
    // Must be the very same object, or ESLint reports a plugin conflict when a
    // consumer also registers `@wellspot` manually.
    expect(plugin.configs.recommended.plugins?.['@wellspot']).toBe(plugin);
  });
});

describe.each(ruleEntries)('rule %s', (name, rule) => {
  it('has a description and a docs URL matching its name', () => {
    expect(rule.meta?.docs?.description).toBeTruthy();
    expect(rule.meta?.docs?.url).toBe(
      `https://github.com/wellspot/eslint-plugin/blob/main/docs/rules/${name}.md`,
    );
  });

  it('has a docs page', () => {
    expect(existsSync(`${root}/docs/rules/${name}.md`)).toBe(true);
  });

  it('is listed in the README', () => {
    expect(readme).toContain(`docs/rules/${name}.md`);
  });

  it('has a test file', () => {
    expect(existsSync(`${root}/tests/rules/${name}.test.ts`)).toBe(true);
  });
});
