/**
 * @module commands/fix/formatters/plan-ai
 * @description AI-friendly XML formatter for fix plans
 */

import * as path from 'node:path';
import { escapeXml } from '../../../lib/@format';
import type { FixOperation } from '../core';
import type { FixPlan, FixPlanItem, SkipStats } from '../plan';

// ============================================================================
// TYPES
// ============================================================================
// ============================================================================
// HELPER FORMATTERS
// ============================================================================

/**
 * Get human-readable explanation of what the fix action does
 */
function getActionExplanation(action: FixOperation['action']): string {
  const explanations: Record<string, string> = {
    'delete-line': 'Removes the problematic line from the file',
    'replace-line': 'Replaces the line with corrected code',
    'replace-range': 'Replaces a range of lines with new implementation',
    'insert-before': 'Inserts new code before the specified line',
    'insert-after': 'Inserts new code after the specified line',
    'wrap-function': 'Wraps the code in a function for better organization',
    'extract-function': 'Extracts logic into a separate function (SRP)',
    'split-file': 'Splits the file into smaller modules following Single Responsibility Principle',
  };
  return explanations[action] ?? 'Applies automated fix';
}

/**
 * Get risk assessment explanation
 */
function getRiskExplanation(difficulty: 'trivial' | 'safe' | 'risky'): string {
  const risks: Record<'trivial' | 'safe' | 'risky', string> = {
    trivial: 'Very low risk. Safe to auto-apply. Removes debug/dev code.',
    safe: 'Low risk. Unlikely to break functionality. Review recommended.',
    risky: 'Moderate risk. May affect behavior. Manual review required.',
  };
  return risks[difficulty];
}

// ============================================================================
// SECTION FORMATTERS
// ============================================================================

/**
 * Format summary section
 */
function formatSummary(plans: FixPlan[], skipStats: SkipStats, totalIssues: number): string[] {
  const lines: string[] = [];

  lines.push('  <summary>');
  lines.push(`    <total_issues>${totalIssues}</total_issues>`);
  lines.push(`    <fixable_files>${plans.length}</fixable_files>`);
  lines.push('    <skipped>');
  lines.push(`      <no_fixer>${skipStats.noFixer}</no_fixer>`);
  lines.push(`      <no_content>${skipStats.noContent}</no_content>`);
  lines.push(`      <no_fix_generated>${skipStats.noFix}</no_fix_generated>`);
  // Legacy fields - kept for backward compatibility, should be 0
  lines.push(`      <no_strategy deprecated="true">${skipStats.noStrategy}</no_strategy>`);
  lines.push(
    `      <context_skipped deprecated="true">${skipStats.contextSkipped}</context_skipped>`,
  );
  lines.push('    </skipped>');

  if (skipStats.categories.size > 0) {
    lines.push('    <categories>');
    for (const [cat, count] of skipStats.categories) {
      lines.push(`      <category name="${cat}" count="${count}" />`);
    }
    lines.push('    </categories>');
  }

  lines.push('  </summary>');
  return lines;
}

/**
 * Format split file structure
 */
function formatSplitStructure(newFiles: Array<{ path: string; content: string }>): string[] {
  const lines: string[] = [];

  lines.push('      <split_structure>');

  // Analyze folder structure
  const folders = new Map<string, string[]>();
  for (const f of newFiles) {
    const dir = path.dirname(f.path);
    if (!folders.has(dir)) folders.set(dir, []);
    folders.get(dir)?.push(path.basename(f.path));
  }

  // Folder tree
  lines.push('        <folder_tree>');
  for (const [dir, fileNames] of folders) {
    const relDir = dir.replace(process.cwd(), '.');
    lines.push(`          ${relDir}/`);
    for (const fname of fileNames) {
      lines.push(`            └── ${fname}`);
    }
  }
  lines.push('        </folder_tree>');

  // New files details
  lines.push('        <new_files>');
  for (const newFile of newFiles) {
    const isBarrel = newFile.content.includes('Re-exports from split modules');
    const isDeprecated = newFile.content.includes('@deprecated');
    const lineCount = newFile.content.split('\n').length;
    const exportCount = (newFile.content.match(/export /g) || []).length;

    let fileType = 'module';
    if (isBarrel) fileType = 'barrel (index.ts)';
    else if (isDeprecated) fileType = 'deprecated re-export';

    lines.push('          <new_file>');
    lines.push(`            <path>${newFile.path.replace(process.cwd(), '.')}</path>`);
    lines.push(`            <lines>${lineCount}</lines>`);
    lines.push(`            <exports>${exportCount}</exports>`);
    lines.push(`            <type>${fileType}</type>`);

    // Content preview (first 15 lines)
    const contentLines = newFile.content.split('\n');
    const preview = contentLines.slice(0, 15).join('\n');
    const hasMore = contentLines.length > 15;

    lines.push('            <content_preview>');
    lines.push('```typescript');
    lines.push(preview);
    if (hasMore) {
      lines.push('// ... (truncated)');
    }
    lines.push('```');
    lines.push('            </content_preview>');
    lines.push('          </new_file>');
  }
  lines.push('        </new_files>');
  lines.push('      </split_structure>');

  return lines;
}

/**
 * Format single fix item
 */
function formatFixItem(item: FixPlanItem, fixIndex: number): string[] {
  const { issue, operation, difficulty } = item;
  const lines: string[] = [];

  lines.push(`    <fix id="${fixIndex}">`);
  lines.push(`      <file>${issue.file}</file>`);
  lines.push(`      <line>${issue.line ?? 'N/A'}</line>`);

  if (operation.endLine) {
    lines.push(`      <end_line>${operation.endLine}</end_line>`);
  }

  lines.push(`      <category>${issue.category}</category>`);
  lines.push(`      <severity>${issue.severity}</severity>`);
  lines.push(`      <action>${operation.action}</action>`);
  lines.push(`      <difficulty>${difficulty}</difficulty>`);
  lines.push('');
  lines.push(`      <issue_message>${escapeXml(issue.message)}</issue_message>`);
  lines.push(
    `      <action_explanation>${getActionExplanation(operation.action)}</action_explanation>`,
  );
  lines.push(`      <risk_assessment>${getRiskExplanation(difficulty)}</risk_assessment>`);

  // Before code
  if (operation.oldCode) {
    lines.push('');
    lines.push('      <before_code>');
    lines.push('```');
    lines.push(operation.oldCode);
    lines.push('```');
    lines.push('      </before_code>');
  }

  // After code
  if (operation.newCode && operation.action !== 'delete-line') {
    lines.push('');
    lines.push('      <after_code>');
    lines.push('```');
    lines.push(operation.newCode);
    lines.push('```');
    lines.push('      </after_code>');
  }

  // Split file structure
  if (operation.action === 'split-file' && operation.newFiles) {
    lines.push('');
    lines.push(...formatSplitStructure(operation.newFiles));
  }

  lines.push('    </fix>');
  lines.push('');

  return lines;
}

/**
 * Format AI guidance section
 */
function formatAIGuidance(plans: FixPlan[], totalFixes: number): string[] {
  const lines: string[] = [];

  lines.push('  <ai_guidance>');
  lines.push('    <recommendation>');

  if (totalFixes === 0) {
    lines.push('      No auto-fixable issues found. Manual review may be needed.');
  } else {
    const allFixes = plans.flatMap((p) => p.fixes);
    const trivialCount = allFixes.filter((f) => f.difficulty === 'trivial').length;
    const safeCount = allFixes.filter((f) => f.difficulty === 'safe').length;
    const riskyCount = allFixes.filter((f) => f.difficulty === 'risky').length;

    lines.push(`      Total fixes: ${totalFixes}`);
    lines.push(`      - Trivial (safe to auto-apply): ${trivialCount}`);
    lines.push(`      - Safe (review recommended): ${safeCount}`);
    lines.push(`      - Risky (manual review required): ${riskyCount}`);
    lines.push('');

    if (trivialCount > 0 && riskyCount === 0) {
      lines.push('      Recommendation: Safe to apply with --yes flag.');
    } else if (riskyCount > 0) {
      lines.push(
        '      Recommendation: Review risky fixes before applying. Consider --dry-run first.',
      );
    } else {
      lines.push('      Recommendation: Review the plan and apply with --yes if acceptable.');
    }
  }

  lines.push('    </recommendation>');
  lines.push('  </ai_guidance>');

  return lines;
}

// ============================================================================
// MAIN FORMATTER
// ============================================================================

/**
 * Format fix plan for AI agents - structured, detailed output
 */
export function formatPlanForAI(
  plans: FixPlan[],
  skipStats: SkipStats,
  totalIssues: number,
): string {
  const lines: string[] = [];
  let fixIndex = 0;

  lines.push('<krolik-fix-plan>');

  // Summary section
  lines.push(...formatSummary(plans, skipStats, totalIssues));
  lines.push('');

  // Fixes section
  lines.push('  <fixes>');
  for (const plan of plans) {
    for (const item of plan.fixes) {
      fixIndex++;
      lines.push(...formatFixItem(item, fixIndex));
    }
  }
  lines.push('  </fixes>');
  lines.push('');

  // AI guidance section
  lines.push(...formatAIGuidance(plans, fixIndex));

  lines.push('</krolik-fix-plan>');

  return lines.join('\n');
}
