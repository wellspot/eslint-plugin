// Runs real ESLint with the plugin set up the way a consumer would in
// eslint.config.js. This catches wiring mistakes (namespace, config shape,
// plugin identity) that per-rule RuleTester tests can't see.
import tsParser from '@typescript-eslint/parser';
import { ESLint } from 'eslint';
import { defineConfig } from 'eslint/config';
import { describe, expect, it } from 'vitest';
import wellspot from '../src';

const buggy = `
  export function Profile() {
    try {
      const [name] = useState('');
      return <p>{name}</p>;
    } catch {
      return null;
    }
  }
`;

async function lint(config: Parameters<typeof defineConfig>[0]) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: defineConfig(
      {
        files: ['**/*.tsx'],
        languageOptions: {
          parser: tsParser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
      },
      config,
    ),
  });
  const [result] = await eslint.lintText(buggy, { filePath: 'Profile.tsx' });
  return result!.messages;
}

describe('flat config integration', () => {
  it('configs.recommended reports the bug', async () => {
    const messages = await lint(wellspot.configs.recommended);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      ruleId: '@wellspot/no-react-compiler-bug',
      severity: 2,
      line: 4,
    });
  });

  it('manual registration works and can be combined with recommended', async () => {
    const messages = await lint([
      wellspot.configs.recommended,
      {
        plugins: { '@wellspot': wellspot },
        rules: { '@wellspot/no-react-compiler-bug': ['warn', { ignore: [] }] },
      },
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ ruleId: '@wellspot/no-react-compiler-bug', severity: 1 });
  });
});
