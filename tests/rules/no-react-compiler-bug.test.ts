import rule, { RULE_NAME } from '../../src/rules/no-react-compiler-bug';
import { ruleTester } from '../rule-tester';

ruleTester.run(RULE_NAME, rule, {
  valid: [
    // Hook at the top level of a component.
    `
      function Profile() {
        const [name] = useState('');
        return <p>{name}</p>;
      }
    `,
    // try/catch without hook calls.
    `
      function Profile() {
        try {
          JSON.parse('{}');
        } catch {}
        return null;
      }
    `,
    // Hook-like call in a plain function (not a component or hook).
    `
      function helper() {
        try {
          useFoo();
        } catch {}
      }
    `,
    // Callback inside the try block: the nearest function is the arrow, not the component.
    `
      function List({ items }) {
        try {
          items.forEach(() => useFoo());
        } catch {}
        return null;
      }
    `,
    // Non-hook calls inside try.
    `
      function Profile() {
        try {
          user();
          reuse();
        } catch {}
        return null;
      }
    `,
    // Option: ignored hook names.
    {
      code: `
        function Profile() {
          try {
            useLegacy();
          } catch {}
          return null;
        }
      `,
      options: [{ ignore: ['useLegacy'] }],
    },
  ],

  invalid: [
    {
      name: 'hook in try block of a function component',
      code: `
        function Profile() {
          try {
            const [name] = useState('');
            return <p>{name}</p>;
          } catch {
            return null;
          }
        }
      `,
      errors: [{ messageId: 'hookInTryStatement', data: { hook: 'useState', fn: 'Profile' } }],
    },
    {
      name: 'member-expression hook in catch block of an arrow component',
      code: `
        const Profile = () => {
          try {
            risky();
          } catch {
            React.useEffect(() => {});
          }
          return null;
        };
      `,
      errors: [{ messageId: 'hookInTryStatement', data: { hook: 'useEffect', fn: 'Profile' } }],
    },
    {
      name: 'hook in finally block of a custom hook',
      code: `
        function useThing() {
          try {
            risky();
          } finally {
            useRef(null);
          }
        }
      `,
      errors: [{ messageId: 'hookInTryStatement', data: { hook: 'useRef', fn: 'useThing' } }],
    },
    {
      name: 'component wrapped in memo(forwardRef(...))',
      code: `
        const Input = memo(forwardRef((props, ref) => {
          try {
            useImperativeHandle(ref, () => ({}));
          } catch {}
          return <input />;
        }));
      `,
      errors: [{ messageId: 'hookInTryStatement', data: { hook: 'useImperativeHandle', fn: 'Input' } }],
    },
    {
      name: "React 19's use() inside try",
      code: `
        function Comments({ promise }) {
          try {
            const comments = use(promise);
            return <ul>{comments}</ul>;
          } catch {
            return null;
          }
        }
      `,
      errors: [{ messageId: 'hookInTryStatement', data: { hook: 'use', fn: 'Comments' } }],
    },
    {
      name: 'multiple hooks report individually; ignore option only skips listed names',
      code: `
        function Profile() {
          try {
            useLegacy();
            useState(0);
            useMemo(() => 1, []);
          } catch {}
          return null;
        }
      `,
      options: [{ ignore: ['useLegacy'] }],
      errors: [
        { messageId: 'hookInTryStatement', data: { hook: 'useState', fn: 'Profile' }, line: 5 },
        { messageId: 'hookInTryStatement', data: { hook: 'useMemo', fn: 'Profile' }, line: 6 },
      ],
    },
  ],
});
