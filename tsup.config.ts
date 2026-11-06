import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // Lowest Node version supported by ESLint 9.
  target: 'node18.18',
  platform: 'node',
  tsconfig: 'tsconfig.build.json',
  dts: true,
  sourcemap: true,
  clean: true,
  // Emit `module.exports = plugin` in the CJS build so `require('@wellspot/eslint-plugin')`
  // returns the plugin itself rather than `{ default: plugin }`.
  cjsInterop: true,
  splitting: true,
});
