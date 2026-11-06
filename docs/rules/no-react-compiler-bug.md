# `@wellspot/no-react-compiler-bug`

Disallow code patterns that trigger known React Compiler bugs.

- ✅ Enabled in `configs.recommended`
- 🐛 Upstream issue(s): _none yet; add the React issue link(s) here_

> [!NOTE]
> **This rule is boilerplate.** Its current check (hooks inside `try` / `catch` /
> `finally`) is a working example that shows the rule structure. Replace it with
> the real bug pattern you're guarding against and update this page.

## Rule details

Reports hook calls (`useX(...)`, `React.useX(...)`, `use(...)`) placed inside a
`try`, `catch`, or `finally` block of a component or custom hook. React's Rules
of Hooks require hooks to be called unconditionally at the top level.

A component or hook is a function whose name is PascalCase or starts with `use`,
either as a declaration or assigned to a variable (including through wrappers
like `memo()` / `forwardRef()`).

Examples of **incorrect** code:

```tsx
function Profile() {
  try {
    const [name] = useState('');
    return <p>{name}</p>;
  } catch {
    return null;
  }
}

const Input = memo(forwardRef((props, ref) => {
  try {
    useImperativeHandle(ref, () => ({}));
  } catch {}
  return <input />;
}));
```

Examples of **correct** code:

```tsx
function Profile() {
  const [name] = useState('');
  try {
    return <p>{format(name)}</p>;
  } catch {
    return null;
  }
}

// Not a component or hook, so not checked:
function helper() {
  try {
    useFoo();
  } catch {}
}
```

## Options

```ts
type Options = [
  {
    /** Hook names to skip. Default: [] */
    ignore?: string[];
  },
];
```

```js
'@wellspot/no-react-compiler-bug': ['error', { ignore: ['useLegacyThing'] }]
```

## When not to use it

When the upstream React Compiler bug is fixed and you've upgraded to a release
that includes the fix.
