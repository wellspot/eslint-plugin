# @wellspot/eslint-plugin

ESLint rules that catch code patterns known to trigger
[React Compiler](https://react.dev/learn/react-compiler) bugs that are not yet
fixed upstream. Each rule is a stopgap: it links the upstream issue it guards
against and can be removed once the fix ships.

Supports **ESLint 9 and 10** with **flat config** (`eslint.config.js`).

## Install

```sh
npm install --save-dev @wellspot/eslint-plugin
```

## Usage

### Recommended config

```js
// eslint.config.js
import { defineConfig } from 'eslint/config';
import wellspot from '@wellspot/eslint-plugin';

export default defineConfig([
  // ...your other configs
  wellspot.configs.recommended,
]);
```

The recommended config has no `files` key, so it applies to every file ESLint
lints. To limit it to React files:

```js
export default defineConfig([
  {
    files: ['src/**/*.{jsx,tsx}'],
    extends: [wellspot.configs.recommended],
  },
]);
```

### Manual setup

```js
import wellspot from '@wellspot/eslint-plugin';

export default [
  {
    plugins: { '@wellspot': wellspot },
    rules: {
      '@wellspot/no-local-copy-of-module-variable': 'error',
    },
  },
];
```

The rules need no type information, so they work with whatever parser your project
already uses for JSX/TSX (for example `typescript-eslint`, or `espree` with
`ecmaFeatures.jsx`).

CommonJS works too: `const wellspot = require('@wellspot/eslint-plugin')`.

## Rules

✅ = enabled in `configs.recommended`

| Rule | Description | Upstream issue | ✅ |
| --- | --- | --- | :-: |
| [`no-local-copy-of-module-variable`](docs/rules/no-local-copy-of-module-variable.md) | Disallow local copies of mutable module-level variables, which React Compiler replaces with the variable itself | [react#37888](https://github.com/react/react/issues/37888) | ✅ |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to write and test a rule, and how
to try local changes in another project with `npm link` or `yalc`.

## License

[MIT](LICENSE)
