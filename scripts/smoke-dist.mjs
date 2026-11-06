// Checks that the built package loads correctly from both ESM and CommonJS.
// Run after `npm run build`.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cjs = require('../dist/index.cjs');
const { default: esm } = await import('../dist/index.js');

for (const [format, plugin] of Object.entries({ cjs, esm })) {
  assert.equal(plugin.meta?.name, '@wellspot/eslint-plugin', `${format}: meta.name`);
  assert.ok(plugin.rules?.['no-local-copy-of-module-variable'], `${format}: rules`);
  assert.equal(plugin.configs?.recommended?.plugins?.['@wellspot'], plugin, `${format}: configs`);
}

console.log('dist OK: ESM and CJS both export the plugin.');
