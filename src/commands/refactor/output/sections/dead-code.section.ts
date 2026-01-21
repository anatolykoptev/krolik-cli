/**
 * @module commands/refactor/output/sections/dead-code.section
 * @description Dead code detection section for refactor output
 *
 * Shows unused code that can be safely removed:
 * - Unused imports
 * - Unused variables
 * - Unreachable code
 *
 * Helps maintain clean codebase by identifying dead code.
 */

import { escapeXml } from '../../../../lib/@format';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Type of dead code issue
 */
type DeadCodeType = 'unused-import' | 'unused-variable' | 'unreachable-code';

/**
 * Single dead code issue
 */
interface DeadCodeIssue {
  file: string;
  line: number;
  type: DeadCodeType;
  identifier: string;
}

/**
 * Analysis result from dead-code analyzer
 */
interface DeadCodeAnalysis {
  issues: DeadCodeIssue[];
  summary: {
    unusedImports: number;
    unusedVariables: number;
    unreachableCode: number;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format an unused import as XML
 */
function formatUnusedImport(lines: string[], issue: DeadCodeIssue, indent: string): void {
  lines.push(
    `${indent}<unused-import file="${escapeXml(issue.file)}" line="${issue.line}">${escapeXml(issue.identifier)}</unused-import>`,
  );
}

/**
 * Format an unused variable as XML
 */
function formatUnusedVariable(lines: string[], issue: DeadCodeIssue, indent: string): void {
  lines.push(
    `${indent}<unused-variable file="${escapeXml(issue.file)}" line="${issue.line}">${escapeXml(issue.identifier)}</unused-variable>`,
  );
}

/**
 * Format unreachable code as XML
 */
function formatUnreachableCode(lines: string[], issue: DeadCodeIssue, indent: string): void {
  lines.push(
    `${indent}<unreachable-code file="${escapeXml(issue.file)}" line="${issue.line}">${escapeXml(issue.identifier)}</unreachable-code>`,
  );
}

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * Dead code detection section
 *
 * Renders unused imports, variables, and unreachable code.
 * These issues are typically auto-fixable with high confidence.
 *
 * Output format:
 * ```xml
 * <dead-code unused-imports="N" unused-variables="M" unreachable="K">
 *   <unused-import file="..." line="N">identifier</unused-import>
 *   <unused-variable file="..." line="N">identifier</unused-variable>
 *   <unreachable-code file="..." line="N">description</unreachable-code>
 * </dead-code>
 * ```
 */
export const deadCodeSection: Section = {
  metadata: {
    id: 'dead-code',
    name: 'Dead Code Detection',
    description: 'Shows unused imports, variables, and unreachable code',
    order: 67, // After data-validation at 66
    requires: ['dead-code'],
    showWhen: 'has-issues',
  },

  shouldRender(ctx: SectionContext): boolean {
    const result = ctx.results.get('dead-code');
    if (result?.status === 'skipped') return false;
    if (result?.status === 'error') return true;

    const data = result?.data as DeadCodeAnalysis | undefined;
    return !!data && data.issues.length > 0;
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('dead-code');

    // Handle error case
    if (result?.status === 'error') {
      lines.push('  <dead-code status="error">');
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push('  </dead-code>');
      lines.push('');
      return;
    }

    const data = result?.data as DeadCodeAnalysis | undefined;

    // Handle no data
    if (!data) {
      lines.push('  <dead-code status="no-data" />');
      lines.push('');
      return;
    }

    // No issues found
    if (data.issues.length === 0) {
      lines.push('  <!-- Dead code: no unused code found -->');
      lines.push(
        '  <dead-code unused-imports="0" unused-variables="0" unreachable="0" status="clean" />',
      );
      lines.push('');
      return;
    }

    // Group issues by type
    const unusedImports = data.issues.filter((i) => i.type === 'unused-import');
    const unusedVariables = data.issues.filter((i) => i.type === 'unused-variable');
    const unreachableCode = data.issues.filter((i) => i.type === 'unreachable-code');

    // Normal rendering with issues
    lines.push('  <!-- DEAD CODE - Unused code that can be safely removed -->');
    lines.push(
      `  <dead-code unused-imports="${unusedImports.length}" unused-variables="${unusedVariables.length}" unreachable="${unreachableCode.length}">`,
    );

    // Render unused imports (most common, auto-fixable)
    if (unusedImports.length > 0) {
      lines.push('    <!-- UNUSED IMPORTS: Safe to remove (auto-fixable) -->');
      for (const issue of unusedImports.slice(0, 30)) {
        formatUnusedImport(lines, issue, '    ');
      }
      if (unusedImports.length > 30) {
        lines.push(`    <!-- +${unusedImports.length - 30} more unused imports -->`);
      }
    }

    // Render unused variables
    if (unusedVariables.length > 0) {
      lines.push('    <!-- UNUSED VARIABLES: Review before removing -->');
      for (const issue of unusedVariables.slice(0, 20)) {
        formatUnusedVariable(lines, issue, '    ');
      }
      if (unusedVariables.length > 20) {
        lines.push(`    <!-- +${unusedVariables.length - 20} more unused variables -->`);
      }
    }

    // Render unreachable code
    if (unreachableCode.length > 0) {
      lines.push('    <!-- UNREACHABLE CODE: Dead code paths -->');
      for (const issue of unreachableCode.slice(0, 10)) {
        formatUnreachableCode(lines, issue, '    ');
      }
      if (unreachableCode.length > 10) {
        lines.push(`    <!-- +${unreachableCode.length - 10} more unreachable code blocks -->`);
      }
    }

    lines.push('  </dead-code>');
    lines.push('');
  },
};
