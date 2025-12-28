/**
 * @module commands/refactor/output/sections/reusable-modules
 * @description Reusable modules section formatter
 */

import { escapeXml } from '../../../../lib/@formatters';
import type {
  EnhancedRefactorAnalysis,
  ReusableModuleSummary,
  ReusableModulesInfo,
} from '../../core';
import { sortByScore } from '../helpers';

/**
 * Format a single reusable module
 */
export function formatReusableModule(
  lines: string[],
  module: ReusableModuleSummary,
  indent: string,
): void {
  lines.push(
    `${indent}<module name="${escapeXml(module.name)}" category="${module.category}" level="${module.level}" score="${module.score}">`,
  );
  lines.push(`${indent}  <path>${module.path}</path>`);
  lines.push(`${indent}  <exports count="${module.exportCount}" />`);
  lines.push(`${indent}  <imported-by count="${module.importedByCount}" />`);
  if (module.description) {
    lines.push(`${indent}  <description>${escapeXml(module.description)}</description>`);
  }
  lines.push(`${indent}</module>`);
}

/**
 * Format category summary
 */
export function formatCategorySummary(
  lines: string[],
  info: ReusableModulesInfo,
  category: keyof ReusableModulesInfo['byCategory'],
  displayName: string,
): void {
  const modules = info.byCategory[category];
  if (modules.length === 0) return;

  // Sort by score (highest first)
  const sorted = sortByScore(modules);

  lines.push(
    `      <category name="${category}" display-name="${displayName}" count="${sorted.length}" sorted-by="score">`,
  );

  // Show top 5 by score
  for (const module of sorted.slice(0, 5)) {
    lines.push(
      `        <module name="${escapeXml(module.name)}" score="${module.score}" path="${module.path}" />`,
    );
  }

  if (sorted.length > 5) {
    lines.push(`        <!-- +${sorted.length - 5} more ${category} modules -->`);
  }

  lines.push('      </category>');
}

/**
 * Format reusable modules section
 */
export function formatReusableModules(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { reusableModules } = analysis;

  if (!reusableModules) {
    lines.push('  <reusable-modules />');
    lines.push('');
    return;
  }

  lines.push(
    `  <reusable-modules total="${reusableModules.totalModules}" exports="${reusableModules.totalExports}" scan-ms="${reusableModules.scanDurationMs}">`,
  );

  // Top modules - sorted by score
  if (reusableModules.topModules.length > 0) {
    const sorted = sortByScore(reusableModules.topModules);

    lines.push('    <!-- TOP REUSABLE MODULES (core + high) -->');
    lines.push(`    <top-modules count="${sorted.length}" sorted-by="score">`);
    for (const module of sorted.slice(0, 15)) {
      formatReusableModule(lines, module, '      ');
    }
    if (sorted.length > 15) {
      lines.push(`      <!-- +${sorted.length - 15} more top modules -->`);
    }
    lines.push('    </top-modules>');
  }

  // By category summary
  lines.push('    <!-- MODULES BY CATEGORY -->');
  lines.push('    <by-category>');
  formatCategorySummary(lines, reusableModules, 'hook', 'React Hooks');
  formatCategorySummary(lines, reusableModules, 'utility', 'Utility Functions');
  formatCategorySummary(lines, reusableModules, 'ui-component', 'UI Components');
  formatCategorySummary(lines, reusableModules, 'type', 'Type Definitions');
  formatCategorySummary(lines, reusableModules, 'schema', 'Validation Schemas');
  formatCategorySummary(lines, reusableModules, 'service', 'Services/API Clients');
  formatCategorySummary(lines, reusableModules, 'constant', 'Constants');
  formatCategorySummary(lines, reusableModules, 'context', 'React Contexts');
  formatCategorySummary(lines, reusableModules, 'hoc', 'Higher-Order Components');
  formatCategorySummary(lines, reusableModules, 'model', 'Data Models');
  lines.push('    </by-category>');

  lines.push('  </reusable-modules>');
  lines.push('');
}
