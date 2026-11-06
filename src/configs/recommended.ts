import type { ESLint, Linter } from 'eslint';
import { PLUGIN_NAMESPACE } from '../meta';

/**
 * Builds the `recommended` flat config. Rules are included automatically when
 * their `meta.docs.recommended` is `true`, so there's only one place to update.
 *
 * No `files` key is set on purpose, so consumers can scope it themselves:
 *   { files: ['src/**\/*.tsx'], ...wellspot.configs.recommended }
 */
export function createRecommendedConfig(plugin: ESLint.Plugin): Linter.Config {
  const rules: Linter.RulesRecord = {};
  for (const [name, rule] of Object.entries(plugin.rules ?? {})) {
    if (rule.meta?.docs?.recommended) rules[`${PLUGIN_NAMESPACE}/${name}`] = 'error';
  }

  return {
    name: `${PLUGIN_NAMESPACE}/recommended`,
    plugins: { [PLUGIN_NAMESPACE]: plugin },
    rules,
  };
}
