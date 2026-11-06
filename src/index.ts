import type { ESLint, Linter, Rule } from 'eslint';
import { createRecommendedConfig } from './configs/recommended';
import { PLUGIN_NAME, PLUGIN_NAMESPACE, PLUGIN_VERSION } from './meta';
import { rules, type RuleName } from './rules';

/**
 * Public type of the plugin, expressed with ESLint's own types so that
 * `defineConfig([...])` in consumers' `eslint.config.ts` type-checks cleanly.
 */
export interface WellspotPlugin extends ESLint.Plugin {
  meta: { name: string; version: string; namespace: string };
  rules: Record<RuleName, Rule.RuleModule>;
  configs: {
    recommended: Linter.Config;
  };
}

const plugin: WellspotPlugin = {
  meta: {
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    namespace: PLUGIN_NAMESPACE,
  },
  // Rules are authored with typescript-eslint's `RuleModule` type, which still
  // models context methods ESLint 9 removed, so it's not structurally assignable
  // to ESLint's `Rule.RuleModule`. They're compatible at runtime
  // (tests/integration.test.ts runs them through real ESLint).
  rules: rules as unknown as WellspotPlugin['rules'],
  configs: {} as WellspotPlugin['configs'],
};

// Configs reference the plugin object itself, so they're attached after it exists.
// Using the same object keeps ESLint from seeing two different "@wellspot" plugins
// when a consumer also registers the plugin manually.
plugin.configs.recommended = createRecommendedConfig(plugin);

export default plugin;
export type { RuleName };
