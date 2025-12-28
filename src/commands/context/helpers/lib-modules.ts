/**
 * @module commands/context/helpers/lib-modules
 * @description Collect lib modules for AI context
 */

import { scanLibModules } from '../../../lib/discovery';
import type { LibModulesData } from '../types';

/** Key modules that should include function details */
const KEY_MODULES = ['fs', 'discovery', 'ast-analysis', 'swc', 'git'];

/** Max functions to show for key modules */
const MAX_FUNCTIONS = 5;

/**
 * Collect lib modules for AI context
 *
 * Scans src/lib/@* modules and returns structured data for AI context.
 * Key modules (fs, discovery, etc.) include top function signatures.
 */
export function collectLibModules(projectRoot: string): LibModulesData | undefined {
  try {
    const result = scanLibModules(projectRoot);

    if (result.modules.length === 0) {
      return undefined;
    }

    return {
      moduleCount: result.modules.length,
      totalExports: result.totalExports,
      modules: result.modules.map((mod) => {
        const isKeyModule = KEY_MODULES.includes(mod.name);
        const functions = mod.exports
          .filter((e) => e.kind === 'function')
          .slice(0, isKeyModule ? MAX_FUNCTIONS : 0)
          .map((fn) => ({
            name: fn.name,
            signature: fn.signature ?? '()',
          }));

        return {
          name: mod.name,
          importPath: mod.importPath,
          exportCount: mod.exports.length,
          ...(functions.length > 0 ? { functions } : {}),
        };
      }),
    };
  } catch (error) {
    if (process.env.DEBUG) {
      console.error('[context] Lib modules collection failed:', error);
    }
    return undefined;
  }
}
