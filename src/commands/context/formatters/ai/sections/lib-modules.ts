/**
 * @module commands/context/formatters/ai/sections/lib-modules
 * @description Lib modules section formatter
 *
 * Formats lib/@* modules with their exports for AI context.
 * Key modules (fs, discovery, ast-analysis, swc) include top 5 functions.
 */

import type { AiContextData } from '../../../types';
import { escapeXml } from '../helpers';

/** Key modules that should include function details */
const KEY_MODULES = ['fs', 'discovery', 'ast-analysis', 'swc', 'git'];

/** Max functions to show for key modules */
const MAX_FUNCTIONS = 5;

/**
 * Format lib-modules section
 */
export function formatLibModulesSection(lines: string[], data: AiContextData): void {
  const { libModules } = data;
  if (!libModules || libModules.modules.length === 0) return;

  lines.push(
    `  <lib-modules count="${libModules.moduleCount}" exports="${libModules.totalExports}">`,
  );

  for (const mod of libModules.modules) {
    const isKeyModule = KEY_MODULES.includes(mod.name);
    const functions = mod.functions ?? [];
    const hasFunctions = functions.length > 0;

    if (isKeyModule && hasFunctions) {
      // Key modules: show with nested functions
      lines.push(
        `    <module name="${mod.name}" import="${mod.importPath}" exports="${mod.exportCount}">`,
      );

      for (const fn of functions.slice(0, MAX_FUNCTIONS)) {
        lines.push(`      <function>${escapeXml(fn.name)}${escapeXml(fn.signature)}</function>`);
      }

      if (functions.length > MAX_FUNCTIONS) {
        lines.push(`      <!-- +${functions.length - MAX_FUNCTIONS} more functions -->`);
      }

      lines.push('    </module>');
    } else {
      // Regular modules: single-line format
      lines.push(
        `    <module name="${mod.name}" import="${mod.importPath}" exports="${mod.exportCount}"/>`,
      );
    }
  }

  lines.push('  </lib-modules>');
}
