/**
 * @module commands/context/formatters/ai/sections/lib-modules
 * @description Lib modules section formatter
 *
 * Formats lib/@* modules with their exports for AI context.
 * All modules include top functions with signatures.
 */

import type { AiContextData } from '../../../types';
import { escapeXml } from '../helpers';

/**
 * Format lib-modules section
 *
 * Shows all lib modules with their function signatures.
 * This helps AI understand what utilities are available.
 */
export function formatLibModulesSection(lines: string[], data: AiContextData): void {
  const { libModules } = data;
  if (!libModules || libModules.modules.length === 0) return;

  lines.push(
    `  <lib-modules count="${libModules.moduleCount}" exports="${libModules.totalExports}">`,
  );

  for (const mod of libModules.modules) {
    const functions = mod.functions ?? [];
    const hasFunctions = functions.length > 0;

    if (hasFunctions) {
      // Modules with functions: show nested function list
      lines.push(
        `    <module name="${mod.name}" import="${mod.importPath}" exports="${mod.exportCount}">`,
      );

      for (const fn of functions) {
        lines.push(`      <function>${escapeXml(fn.name)}${escapeXml(fn.signature)}</function>`);
      }

      lines.push('    </module>');
    } else {
      // Modules without functions (types only, etc.): single-line format
      lines.push(
        `    <module name="${mod.name}" import="${mod.importPath}" exports="${mod.exportCount}"/>`,
      );
    }
  }

  lines.push('  </lib-modules>');
}
