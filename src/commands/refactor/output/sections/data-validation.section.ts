/**
 * @module commands/refactor/output/sections/data-validation.section
 * @description Data validation section for refactor output
 *
 * Shows data integrity issues found in const arrays:
 * - Duplicate items (by id, title, name, etc.)
 * - Inconsistent data (conflicting emails, URLs)
 * - Missing required fields
 *
 * Groups issues by severity (error, warning) for prioritized review.
 */

import { escapeXml } from '../../../../lib/@format';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Data validation issue severity
 */
type DataIssueSeverity = 'error' | 'warning';

/**
 * Type of data validation issue
 */
type DataIssueType = 'duplicate-item' | 'inconsistent-data' | 'missing-field';

/**
 * Single data validation issue
 */
interface DataIssue {
  file: string;
  line: number;
  type: DataIssueType;
  message: string;
  severity: DataIssueSeverity;
}

/**
 * Analysis result from data-validation analyzer
 */
interface DataValidationAnalysis {
  issues: DataIssue[];
  totalErrors: number;
  totalWarnings: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a data validation error as XML
 */
function formatDataError(lines: string[], issue: DataIssue, indent: string): void {
  lines.push(
    `${indent}<error file="${escapeXml(issue.file)}" line="${issue.line}" type="${issue.type}">`,
  );
  lines.push(`${indent}  <message>${escapeXml(issue.message)}</message>`);
  lines.push(`${indent}</error>`);
}

/**
 * Format a data validation warning as XML
 */
function formatDataWarning(lines: string[], issue: DataIssue, indent: string): void {
  lines.push(
    `${indent}<warning file="${escapeXml(issue.file)}" line="${issue.line}" type="${issue.type}">`,
  );
  lines.push(`${indent}  <message>${escapeXml(issue.message)}</message>`);
  lines.push(`${indent}</warning>`);
}

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * Data validation section
 *
 * Renders data integrity issues found in const arrays.
 * Critical for catching bugs in static data definitions.
 *
 * Output format:
 * ```xml
 * <data-validation errors="N" warnings="M">
 *   <error file="..." line="N" type="duplicate-item">
 *     <message>Duplicate item with title="..."</message>
 *   </error>
 *   <warning file="..." line="N" type="inconsistent-data">
 *     <message>Inconsistent emails found: ...</message>
 *   </warning>
 * </data-validation>
 * ```
 */
export const dataValidationSection: Section = {
  metadata: {
    id: 'data-validation',
    name: 'Data Validation',
    description: 'Shows data integrity issues in const arrays',
    order: 66, // Before i18n at 65 (per requirements: 66)
    requires: ['data-validation'],
    showWhen: 'has-issues',
  },

  shouldRender(ctx: SectionContext): boolean {
    const result = ctx.results.get('data-validation');
    if (result?.status === 'skipped') return false;
    if (result?.status === 'error') return true;

    const data = result?.data as DataValidationAnalysis | undefined;
    return !!data && data.issues.length > 0;
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('data-validation');

    // Handle error case
    if (result?.status === 'error') {
      lines.push('  <data-validation status="error">');
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push('  </data-validation>');
      lines.push('');
      return;
    }

    const data = result?.data as DataValidationAnalysis | undefined;

    // Handle no data
    if (!data) {
      lines.push('  <data-validation status="no-data" />');
      lines.push('');
      return;
    }

    // No issues found
    if (data.issues.length === 0) {
      lines.push('  <!-- Data validation: no issues found -->');
      lines.push('  <data-validation errors="0" warnings="0" status="clean" />');
      lines.push('');
      return;
    }

    // Normal rendering with issues
    const errors = data.issues.filter((i) => i.severity === 'error');
    const warnings = data.issues.filter((i) => i.severity === 'warning');

    lines.push('  <!-- DATA VALIDATION - Data integrity issues in const arrays -->');
    lines.push(`  <data-validation errors="${errors.length}" warnings="${warnings.length}">`);

    // Render errors first (higher priority)
    if (errors.length > 0) {
      lines.push('    <!-- ERRORS: Data bugs that need immediate attention -->');
      for (const issue of errors.slice(0, 20)) {
        formatDataError(lines, issue, '    ');
      }
      if (errors.length > 20) {
        lines.push(`    <!-- +${errors.length - 20} more errors -->`);
      }
    }

    // Render warnings
    if (warnings.length > 0) {
      lines.push('    <!-- WARNINGS: Potential issues to review -->');
      for (const issue of warnings.slice(0, 10)) {
        formatDataWarning(lines, issue, '    ');
      }
      if (warnings.length > 10) {
        lines.push(`    <!-- +${warnings.length - 10} more warnings -->`);
      }
    }

    lines.push('  </data-validation>');
    lines.push('');
  },
};
