/**
 * Shared cases for the rule test and the React Compiler test.
 *
 * - `buggy`:      the compiler drops the copy AND the variable can change before
 *                 the copy is read. The rule must report these.
 * - `unaffected`: the compiler keeps the copy (or doesn't compile the function).
 *                 The rule must not report these.
 * - `harmless`:   the compiler drops the copy, but the value can't change before
 *                 it's read, so behavior is the same. The rule must not report these.
 */
export interface Fixture {
  name: string;
  code: string;
  /** Name of the local copy (default `copy`). */
  copy?: string;
  /** Name of the module-level variable (default `pending`). */
  source?: string;
}

/** Wraps a handler body in a component, with a mutable module-level `pending`. */
const inHandler = (body: string, { async = false, header = '' } = {}) => `
let pending: string | null = 'value';
${header}
export function Component() {
  const handleClick = ${async ? 'async ' : ''}() => {
${body}
  };
  return <button onClick={handleClick}>Click</button>;
}
`;

export const buggy: Fixture[] = [
  {
    name: 'issue repro: copy, reassign, read in an event handler',
    code: inHandler(`
    const copy = pending;
    pending = null;
    console.log(copy);`),
  },
  {
    name: 'production case: deferred PWA install prompt with non-null assertion',
    copy: 'event',
    source: 'deferred',
    code: `
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
`,
  },
  {
    name: 'let copy',
    code: inHandler(`
    let copy = pending;
    pending = null;
    console.log(copy);`),
  },
  {
    name: 'typed declarator',
    code: inHandler(`
    const copy: string | null = pending;
    pending = null;
    console.log(copy);`),
  },
  {
    name: 'compound assignment',
    code: inHandler(`
    const copy = pending;
    pending += '!';
    console.log(copy);`),
  },
  {
    name: 'reassignment inside a condition',
    code: inHandler(`
    const copy = pending;
    if (copy) {
      pending = null;
    }
    console.log(copy);`),
  },
  {
    name: 'reassignment through a module-level helper',
    code: inHandler(
      `
    const copy = pending;
    reset();
    console.log(copy);`,
      { header: 'function reset() { pending = null; }' },
    ),
  },
  {
    name: 'read after await',
    code: inHandler(
      `
    const copy = pending;
    await save();
    console.log(copy);`,
      { async: true, header: 'async function save() { pending = null; }' },
    ),
  },
  {
    name: 'module-level var',
    code: inHandler(`
    const copy = pending;
    pending = null;
    console.log(copy);`).replace('let pending', 'var pending'),
  },
  {
    name: 'copy reassigned locally after the module variable changes',
    code: inHandler(`
    let copy = pending;
    pending = null;
    copy = copy ?? 'fallback';
    console.log(copy);`),
  },
  {
    name: 'read in a later loop iteration',
    code: inHandler(`
    const copy = pending;
    for (let i = 0; i < 2; i++) {
      console.log(copy);
      pending = String(i);
    }`),
  },
  {
    name: 'copy captured by a returned closure',
    code: inHandler(`
    const copy = pending;
    pending = null;
    return () => copy;`),
  },
  {
    name: 'copy in the render body, read in an event handler',
    code: `
let pending: string | null = 'value';

export function Component() {
  const copy = pending;
  const handleClick = () => {
    pending = null;
    console.log(copy);
  };
  return <button onClick={handleClick}>Click</button>;
}
`,
  },
  {
    name: 'inside useEffect',
    code: `
let pending: string | null = 'value';

export function Component() {
  useEffect(() => {
    const copy = pending;
    pending = null;
    console.log(copy);
  }, []);
  return null;
}
`,
  },
  {
    name: 'inside a custom hook',
    code: `
let pending: string | null = 'value';

export function useTakePending() {
  return useCallback(() => {
    const copy = pending;
    pending = null;
    return copy;
  }, []);
}
`,
  },
  {
    name: 'function declaration handler',
    code: `
let pending: string | null = 'value';

export function Component() {
  function handleClick() {
    const copy = pending;
    pending = null;
    console.log(copy);
  }
  return <button onClick={handleClick}>Click</button>;
}
`,
  },
  {
    name: 'nested two levels deep',
    code: `
let pending: string | null = 'value';

export function Component() {
  const outer = () => {
    const inner = () => {
      const copy = pending;
      pending = null;
      console.log(copy);
    };
    inner();
  };
  return <button onClick={outer}>Click</button>;
}
`,
  },
  {
    name: 'memo-wrapped arrow component',
    code: `
let pending: string | null = 'value';

export const Component = memo(() => {
  const handleClick = () => {
    const copy = pending;
    pending = null;
    console.log(copy);
  };
  return <button onClick={handleClick}>Click</button>;
});
`,
  },
];

export const unaffected: Fixture[] = [
  {
    name: '`as` assertion keeps the copy',
    code: inHandler(`
    const copy = pending as string | null;
    pending = null;
    console.log(copy);`),
  },
  {
    name: '`satisfies` keeps the copy',
    code: inHandler(`
    const copy = pending satisfies string | null;
    pending = null;
    console.log(copy);`),
  },
  {
    name: 'var copy (the compiler skips the component)',
    code: inHandler(`
    var copy = pending;
    pending = null;
    console.log(copy);`),
  },
  {
    name: 'copy of a property, not the variable',
    code: inHandler(
      `
    const copy = state.pending;
    state = { pending: null };
    console.log(copy);`,
      { header: "let state = { pending: 'value' };" },
    ),
  },
  {
    name: 'destructuring',
    code: inHandler(
      `
    const { pending: copy } = state;
    state = { pending: null };
    console.log(copy);`,
      { header: "let state = { pending: 'value' };" },
    ),
  },
  {
    name: "'use no memo' in the component",
    code: `
let pending: string | null = 'value';

export function Component() {
  'use no memo';
  const handleClick = () => {
    const copy = pending;
    pending = null;
    console.log(copy);
  };
  return <button onClick={handleClick}>Click</button>;
}
`,
  },
  {
    name: "'use no memo' at the top of the file",
    code: `
'use no memo';
let pending: string | null = 'value';

export function Component() {
  const handleClick = () => {
    const copy = pending;
    pending = null;
    console.log(copy);
  };
  return <button onClick={handleClick}>Click</button>;
}
`,
  },
  {
    name: 'plain function outside any component',
    code: `
let pending: string | null = 'value';

export function takePending() {
  const copy = pending;
  pending = null;
  return copy;
}
`,
  },
  {
    name: 'PascalCase function without JSX or hooks (not compiled)',
    code: `
let pending: string | null = 'value';

export function Factory() {
  return () => {
    const copy = pending;
    pending = null;
    return copy;
  };
}
`,
  },
];

export const harmless: Fixture[] = [
  {
    name: 'variable is never reassigned inside a function',
    code: inHandler(
      `
    const copy = pending;
    doSomething();
    console.log(copy);`,
      { header: "pending = 'configured at load time';" },
    ),
  },
  {
    name: 'copy is only read before anything can change the variable',
    code: inHandler(`
    const copy = pending;
    console.log(copy);
    pending = null;`),
  },
  {
    name: 'copy of a module-level const',
    source: 'config',
    code: `
const config = { theme: 'dark' };

export function Component() {
  const handleClick = () => {
    const copy = config;
    reset();
    console.log(copy);
  };
  return <button onClick={handleClick}>Click</button>;
}
`,
  },
  {
    name: 'local variable copied from another local variable',
    code: inHandler(`
    let local = pending;
    const copy = local;
    local = null;
    console.log(copy);`),
  },
];
