import { ESLintUtils } from '@typescript-eslint/utils';
import { REPO_URL } from '../meta';

/** Extra `meta.docs` fields every Wellspot rule may declare. */
export interface WellspotRuleDocs {
  /** Include this rule (as `error`) in `configs.recommended`. */
  recommended?: boolean;
  /**
   * Upstream issue(s) describing the React Compiler bug this rule guards against.
   * Once they are fixed and released, the rule can be deprecated.
   */
  upstreamIssues?: string[];
}

/**
 * Typed rule factory. Gives you:
 *  - inferred types for `context`, options and message IDs
 *  - `defaultOptions` deep-merged into the user's options
 *  - an automatic `meta.docs.url` pointing at `docs/rules/<name>.md`
 */
export const createRule = ESLintUtils.RuleCreator<WellspotRuleDocs>(
  (name) => `${REPO_URL}/blob/main/docs/rules/${name}.md`,
);
