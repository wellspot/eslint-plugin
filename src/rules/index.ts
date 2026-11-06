import noLocalCopyOfModuleVariable from './no-local-copy-of-module-variable';
// new-rule:imports (`npm run new-rule` inserts imports above this line)

export const rules = {
  'no-local-copy-of-module-variable': noLocalCopyOfModuleVariable,
  // new-rule:entries (`npm run new-rule` inserts entries above this line)
};

export type RuleName = keyof typeof rules;
