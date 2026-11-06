# `@wellspot/no-local-copy-of-module-variable`

Disallow local copies of mutable module-level variables, which React Compiler
replaces with the variable itself.

- ✅ Enabled in `configs.recommended`
- 🐛 Upstream issue: [react/react#37888](https://github.com/react/react/issues/37888)
- Verified against `babel-plugin-react-compiler@1.0.0`

## The bug

Inside a component or hook, React Compiler removes `const copy = moduleVariable`
and rewrites every use of `copy` to `moduleVariable`. When the variable is
reassigned before `copy` is read, the read gets the **new** value instead of the
one that was copied:

```tsx
let pending = 'value';

export function Component() {
  const handleClick = () => {
    const copy = pending;
    pending = null;
    console.log(copy); // expected 'value', logs null after compilation
  };
  return <button onClick={handleClick}>Click</button>;
}
```

Compiled output:

```js
function _temp() {
  pending = null;
  console.log(pending);
}
```

A real-world case: holding Chrome's `beforeinstallprompt` event in a module
variable, then `const event = deferred!; deferred = null; await event.prompt();`
in a click handler. After compilation it calls `null.prompt()`.

## Rule details

The rule reports `const`/`let` copies of a module-level `let`/`var` inside a
component or hook that React Compiler compiles, when some read of the copy could
see a changed value:

- the read is inside a closure (an event handler, effect or returned callback can
  run after any reassignment), or
- between the copy and the read there is a reassignment of the variable, a
  function call (which might reassign it), an `await`, a `yield`, or a loop that
  repeats after one of those.

It does **not** report:

- copies the compiler keeps: `x as T`, `x satisfies T`, `var copy = x`,
  `const v = x.prop`, destructuring;
- module variables that are only assigned at the top level of the module (they
  can't change after it loads), and `const` module variables;
- reads that happen before anything could change the variable;
- components or hooks with `'use no memo'` (in the function or at the top of the
  file), and functions the compiler doesn't compile (plain functions, or
  PascalCase functions without JSX or hook calls).

Examples of **incorrect** code:

```tsx
let deferred: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  deferred = e as BeforeInstallPromptEvent;
});

export function InstallButton() {
  const install = async () => {
    const event = deferred!;
    deferred = null;
    await event.prompt();
  };
  return <button onClick={install}>Install</button>;
}
```

```tsx
let pending: string | null = 'value';
function reset() {
  pending = null;
}

export function Component() {
  const copy = pending; // copied during render...
  const handleClick = () => {
    reset();
    console.log(copy); // ...but this reads `pending` after the reset
  };
  return <button onClick={handleClick}>Click</button>;
}
```

Examples of **correct** code:

```tsx
let deferred: BeforeInstallPromptEvent | null = null;

// Workaround 1: keep the logic outside the component. The compiler only
// rewrites code inside components and hooks.
function takeDeferred() {
  const event = deferred;
  deferred = null;
  return event;
}

export function InstallButton() {
  const install = async () => {
    const event = takeDeferred();
    await event?.prompt();
  };
  return <button onClick={install}>Install</button>;
}
```

```tsx
// Workaround 2: opt this component out of the compiler.
export function InstallButton() {
  'use no memo';
  const install = async () => {
    const event = deferred!;
    deferred = null;
    await event.prompt();
  };
  return <button onClick={install}>Install</button>;
}
```

Keeping the state somewhere other than a module variable (a ref, a store, or
React state) also avoids the bug.

## Known false positives

The rule can't tell when a closure runs or whether a called function really
reassigns the variable, so it assumes the worst. For example,
`items.filter((item) => item === copy)` is reported, even though the callback
runs right away. Use the workarounds above or an
`// eslint-disable-next-line @wellspot/no-local-copy-of-module-variable` comment.

## When not to use it

When react/react#37888 is fixed and you've upgraded to a compiler release that
includes the fix. This repository's compiler test
(`tests/compiler/no-local-copy-of-module-variable.test.ts`) fails once the
compiler stops dropping the copy, which is the signal to deprecate this rule.
