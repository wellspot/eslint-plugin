import noReactCompilerBug from './no-react-compiler-bug';
// new-rule:imports (`npm run new-rule` inserts imports above this line)

export const rules = {
  'no-react-compiler-bug': noReactCompilerBug,
  // new-rule:entries (`npm run new-rule` inserts entries above this line)
};

export type RuleName = keyof typeof rules;
