/**
 * @module lib/modules/formatters
 * @description Output formatters for discovery results
 *
 * Provides formatting utilities for displaying reusable module
 * discovery results in various formats.
 */

import { getCategoryDisplayName, getCategoryIcon } from './classifier';
import { getLevelDescription } from './scorer';
import type { DiscoveryResult, ModuleCategory, ReusabilityLevel } from './types';

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

/**
 * Format discovery result as Markdown
 *
 * @param result - Discovery result
 * @returns Markdown string
 */
export function formatAsMarkdown(result: DiscoveryResult): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Reusable Modules: ${result.project.name}`);
  lines.push('');
  lines.push(`> ${result.stats.totalModules} modules, ${result.stats.totalExports} exports`);
  lines.push(`> Project type: ${result.project.type}`);
  lines.push(`> Scanned ${result.stats.filesScanned} files in ${result.stats.scanDurationMs}ms`);
  lines.push('');

  // Summary by level
  lines.push('## Summary by Reusability');
  lines.push('');
  lines.push('| Level | Count | Description |');
  lines.push('|-------|-------|-------------|');

  for (const level of ['core', 'high', 'medium', 'low'] as ReusabilityLevel[]) {
    const count = result.byReusability[level].length;
    if (count > 0) {
      lines.push(`| ${level} | ${count} | ${getLevelDescription(level)} |`);
    }
  }
  lines.push('');

  // Summary by category
  lines.push('## Summary by Category');
  lines.push('');

  for (const [category, modules] of Object.entries(result.byCategory)) {
    if (modules.length > 0) {
      lines.push(
        `- **${getCategoryDisplayName(category as ModuleCategory)}**: ${modules.length} modules`,
      );
    }
  }
  lines.push('');

  // Top modules
  lines.push('## Top Reusable Modules');
  lines.push('');

  const topModules = result.modules.slice(0, 20);
  for (const module of topModules) {
    lines.push(`### ${getCategoryIcon(module.category)} ${module.name}`);
    lines.push('');
    lines.push(`- **Path**: \`${module.path}\``);
    lines.push(`- **Category**: ${getCategoryDisplayName(module.category)}`);
    lines.push(`- **Score**: ${module.reusabilityScore} (${module.reusabilityLevel})`);
    lines.push(`- **Exports**: ${module.exportCount}`);
    lines.push(`- **Imported by**: ${module.importedByCount} files`);

    if (module.description) {
      lines.push(`- **Description**: ${module.description}`);
    }

    // List exports
    if (module.exports.length > 0 && module.exports.length <= 10) {
      lines.push('');
      lines.push('**Exports:**');
      for (const exp of module.exports) {
        const asyncPrefix = exp.isAsync ? 'async ' : '';
        lines.push(`- \`${asyncPrefix}${exp.name}\` (${exp.kind})`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// XML FORMATTER (AI-FRIENDLY)
// ============================================================================

/**
 * Format discovery result as XML (AI-friendly)
 *
 * @param result - Discovery result
 * @returns XML string
 */
export function formatAsXML(result: DiscoveryResult): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<reusable-modules project="${escapeXml(result.project.name)}" type="${result.project.type}">`,
  );
  lines.push('');

  // Stats
  lines.push('  <stats>');
  lines.push(`    <total-modules>${result.stats.totalModules}</total-modules>`);
  lines.push(`    <total-exports>${result.stats.totalExports}</total-exports>`);
  lines.push(`    <files-scanned>${result.stats.filesScanned}</files-scanned>`);
  lines.push(`    <scan-duration-ms>${result.stats.scanDurationMs}</scan-duration-ms>`);
  lines.push('  </stats>');
  lines.push('');

  // Modules by category
  lines.push('  <modules>');

  for (const module of result.modules) {
    lines.push(`    <module path="${escapeXml(module.path)}">`);
    lines.push(`      <name>${escapeXml(module.name)}</name>`);
    lines.push(`      <category>${module.category}</category>`);
    lines.push(
      `      <reusability level="${module.reusabilityLevel}" score="${module.reusabilityScore}"/>`,
    );
    lines.push(`      <exports count="${module.exportCount}">`);

    for (const exp of module.exports.slice(0, 20)) {
      const attrs = [
        `name="${escapeXml(exp.name)}"`,
        `kind="${exp.kind}"`,
        exp.isAsync ? 'async="true"' : '',
        exp.returnType ? `returns="${escapeXml(exp.returnType)}"` : '',
      ]
        .filter(Boolean)
        .join(' ');
      lines.push(`        <export ${attrs}/>`);
    }

    if (module.exports.length > 20) {
      lines.push(`        <!-- ... and ${module.exports.length - 20} more -->`);
    }

    lines.push('      </exports>');
    lines.push(`      <imported-by count="${module.importedByCount}"/>`);

    if (module.description) {
      lines.push(`      <description>${escapeXml(module.description)}</description>`);
    }

    lines.push('    </module>');
  }

  lines.push('  </modules>');
  lines.push('</reusable-modules>');

  return lines.join('\n');
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================================
// JSON FORMATTER
// ============================================================================

/**
 * Format discovery result as JSON
 *
 * @param result - Discovery result
 * @param pretty - Whether to format with indentation
 * @returns JSON string
 */
export function formatAsJSON(result: DiscoveryResult, pretty = true): string {
  // Create a JSON-safe version (no circular refs)
  const jsonSafe = {
    project: result.project,
    stats: result.stats,
    modules: result.modules.map((m) => ({
      path: m.path,
      name: m.name,
      category: m.category,
      reusabilityLevel: m.reusabilityLevel,
      reusabilityScore: m.reusabilityScore,
      exportCount: m.exportCount,
      importedByCount: m.importedByCount,
      description: m.description,
      exports: m.exports.map((e) => ({
        name: e.name,
        kind: e.kind,
        isAsync: e.isAsync,
        returnType: e.returnType,
      })),
    })),
    summary: {
      byCategory: Object.fromEntries(
        Object.entries(result.byCategory).map(([k, v]) => [k, v.length]),
      ),
      byReusability: Object.fromEntries(
        Object.entries(result.byReusability).map(([k, v]) => [k, v.length]),
      ),
    },
  };

  return JSON.stringify(jsonSafe, null, pretty ? 2 : undefined);
}

// ============================================================================
// TEXT FORMATTER (CLI)
// ============================================================================

/**
 * Format discovery result as plain text (for CLI)
 *
 * @param result - Discovery result
 * @returns Plain text string
 */
export function formatAsText(result: DiscoveryResult): string {
  const lines: string[] = [];

  // Header
  lines.push(`Reusable Modules: ${result.project.name}`);
  lines.push('='.repeat(50));
  lines.push('');
  lines.push(`Project type: ${result.project.type}`);
  lines.push(`Total modules: ${result.stats.totalModules}`);
  lines.push(`Total exports: ${result.stats.totalExports}`);
  lines.push(`Scan time: ${result.stats.scanDurationMs}ms`);
  lines.push('');

  // Summary
  lines.push('Summary by Level:');
  lines.push('-'.repeat(30));
  for (const level of ['core', 'high', 'medium', 'low'] as ReusabilityLevel[]) {
    const count = result.byReusability[level].length;
    if (count > 0) {
      lines.push(`  ${level.padEnd(8)}: ${count}`);
    }
  }
  lines.push('');

  lines.push('Summary by Category:');
  lines.push('-'.repeat(30));
  for (const [category, modules] of Object.entries(result.byCategory)) {
    if (modules.length > 0) {
      const displayName = getCategoryDisplayName(category as ModuleCategory);
      lines.push(`  ${displayName.padEnd(20)}: ${modules.length}`);
    }
  }
  lines.push('');

  // Top modules
  lines.push('Top Reusable Modules:');
  lines.push('-'.repeat(50));

  const topModules = result.modules.slice(0, 15);
  for (const module of topModules) {
    const icon = getCategoryIcon(module.category);
    const score = `[${module.reusabilityScore}]`.padEnd(5);
    lines.push(`${icon} ${score} ${module.name}`);
    lines.push(`         ${module.path}`);
    lines.push(
      `         ${module.exportCount} exports, imported by ${module.importedByCount} files`,
    );
  }

  return lines.join('\n');
}

// ============================================================================
// COMPACT FORMATTER
// ============================================================================

/**
 * Format as compact single-line per module
 *
 * @param result - Discovery result
 * @returns Compact text
 */
export function formatAsCompact(result: DiscoveryResult): string {
  const lines: string[] = [];

  lines.push(`# ${result.stats.totalModules} reusable modules in ${result.project.name}`);
  lines.push('');

  for (const module of result.modules) {
    const icon = getCategoryIcon(module.category);
    const score = module.reusabilityScore.toString().padStart(3);
    const level = module.reusabilityLevel.charAt(0).toUpperCase();
    const imports = module.importedByCount.toString().padStart(3);

    lines.push(`${icon} [${score}${level}] ${imports}i ${module.path}`);
  }

  return lines.join('\n');
}
