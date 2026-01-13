/**
 * @module commands/context/formatters/ai/sections/details/guidance
 * @description Hints, Approach, PreCommit, and NextActions section formatters
 */

import type { AiContextData } from '../../../../types';
import { escapeXml } from '../../helpers';

/**
 * Generic hint patterns to filter out (Phase 9.3)
 * These hints apply to all projects and provide no domain-specific value.
 */
const GENERIC_HINT_PATTERNS = [
  /zero todos?/i,
  /no todos?/i,
  /responsive.*accessible/i,
  /accessible.*responsive/i,
  /follow.*best.*practices/i,
  /use.*typescript/i,
  /run.*tests?/i,
  /write.*tests?/i,
  /check.*lint/i,
  /format.*code/i,
] as const;

/**
 * Check if a hint is generic (applies to all projects, provides no value)
 */
function isGenericHint(value: string): boolean {
  return GENERIC_HINT_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Format hints section
 * Phase 9.3: Filters out generic hints that apply to all projects
 */
export function formatHintsSection(lines: string[], data: AiContextData): void {
  const { hints } = data;
  if (!hints || Object.keys(hints).length === 0) return;

  const filteredHints = Object.entries(hints).filter(([, value]) => !isGenericHint(value));
  if (filteredHints.length === 0) return;

  lines.push('  <context-hints>');
  for (const [key, value] of filteredHints) {
    lines.push(`    <hint key="${key}">${escapeXml(value)}</hint>`);
  }
  lines.push('  </context-hints>');
}

/**
 * Format approach section with dynamic steps based on context
 */
export function formatApproachSection(lines: string[], data: AiContextData): void {
  const { context, memories, libModules, git } = data;

  lines.push('  <approach>');
  let priority = 1;

  // Step 1: Always read CLAUDE.md first
  lines.push(`    <step priority="${priority}">Read CLAUDE.md for project rules</step>`);
  priority++;

  // Step 2: Check relevant memories (patterns from previous sessions)
  const relevantPatterns = memories?.filter((m) => m.type === 'pattern').slice(0, 2) || [];
  if (relevantPatterns.length > 0) {
    lines.push(
      `    <step priority="${priority}" source="memory">Apply patterns from previous sessions:</step>`,
    );
    for (const pattern of relevantPatterns) {
      lines.push(`      <pattern>${escapeXml(pattern.title)}</pattern>`);
    }
    priority++;
  }

  // Step 3: Domain-specific steps from config
  for (const step of context.approach) {
    const cleanStep = step.replace(/^\d+\.\s*/, '');
    if (cleanStep.includes('CLAUDE.md')) continue;
    if (cleanStep.includes('typecheck') && cleanStep.includes('lint')) continue;

    lines.push(`    <step priority="${priority}">${escapeXml(cleanStep)}</step>`);
    priority++;
  }

  // Step 4: Check lib-modules for reusable utilities
  if (libModules && libModules.moduleCount > 0) {
    const keyModules = libModules.modules
      .filter((m) => m.exportCount > 10)
      .slice(0, 3)
      .map((m) => m.name);

    if (keyModules.length > 0) {
      lines.push(
        `    <step priority="${priority}" source="lib-modules">Check utilities before writing new code: ${keyModules.join(', ')}</step>`,
      );
      priority++;
    }
  }

  // Step 5: Review changed files if any
  if (git && git.changedFiles.length > 0) {
    const changedCount = git.changedFiles.length;
    lines.push(
      `    <step priority="${priority}" source="git">Review ${changedCount} changed files before making new changes</step>`,
    );
  }

  lines.push('  </approach>');
}

/**
 * Format pre-commit section
 */
export function formatPreCommitSection(lines: string[]): void {
  lines.push('  <pre-commit>');
  lines.push('    <check>pnpm typecheck</check>');
  lines.push('    <check>pnpm lint:fix</check>');
  lines.push('    <check>pnpm test -- [domain]</check>');
  lines.push('    <check>pnpm build</check>');
  lines.push('  </pre-commit>');
}

/**
 * Format next-actions section - guidance for AI on what to do next
 */
export function formatNextActionsSection(lines: string[], data: AiContextData): void {
  lines.push('  <next-actions hint="Recommended tools based on current state">');

  const hasQualityIssues = data.qualityIssues && data.qualityIssues.length > 0;
  const fixableCount = hasQualityIssues
    ? data.qualityIssues!.filter((i) => i.autoFixable).length
    : 0;

  const hasChanges =
    data.git && (data.git.changedFiles.length > 0 || data.git.stagedFiles.length > 0);

  const hasTodos = data.todos && data.todos.length > 0;
  const actionableTodos = hasTodos ? data.todos!.filter((t) => !t.isGeneric).length : 0;

  if (fixableCount > 0) {
    lines.push(
      `    <action tool="krolik_fix" priority="1" reason="${fixableCount} auto-fixable issues">`,
    );
    lines.push('      dryRun: true, then apply fixes');
    lines.push('    </action>');
  }

  if (hasChanges) {
    lines.push('    <action tool="krolik_review" priority="2" reason="code changes detected">');
    lines.push('      staged: true');
    lines.push('    </action>');
  }

  if (actionableTodos > 0) {
    lines.push(
      `    <action tool="krolik_context" priority="3" reason="${actionableTodos} actionable TODOs">`,
    );
    lines.push('      feature: "[specific domain]"');
    lines.push('    </action>');
  }

  lines.push('    <action tool="krolik_mem_save" trigger="after-decision">');
  lines.push('      type: "decision", title: "[what was decided]"');
  lines.push('    </action>');

  lines.push('    <action tool="krolik_mem_save" trigger="after-bugfix">');
  lines.push('      type: "bugfix", title: "[what was fixed]"');
  lines.push('    </action>');

  lines.push('  </next-actions>');
}
