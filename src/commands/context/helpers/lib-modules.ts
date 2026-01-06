/**
 * @module commands/context/helpers/lib-modules
 * @description Collect lib modules for AI context
 */

import { scanLibModules } from '../../../lib/@discovery';
import type { LibModulesData } from '../types';

/**
 * Key modules that should include more function details
 * These are the most commonly used modules in the codebase
 */
const KEY_MODULES = [
  'fs',
  'discovery',
  'ast-analysis',
  'swc',
  'git',
  'shell',
  'format',
  'vcs',
  'storage',
  'detectors',
  'utils',
  'cache',
];

/** Max functions to show for key modules */
const MAX_FUNCTIONS_KEY = 8;

/** Max functions to show for regular modules */
const MAX_FUNCTIONS_REGULAR = 3;

/**
 * Collect lib modules for AI context
 *
 * Scans src/lib/@* modules and returns structured data for AI context.
 * All modules include top functions with signatures:
 * - Key modules: up to 8 functions
 * - Regular modules: up to 3 functions
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
        const maxFunctions = isKeyModule ? MAX_FUNCTIONS_KEY : MAX_FUNCTIONS_REGULAR;
        const functions = mod.exports
          .filter((e) => e.kind === 'function')
          .slice(0, maxFunctions)
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
