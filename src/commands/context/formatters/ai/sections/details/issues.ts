/**
 * @module commands/context/formatters/ai/sections/details/issues
 * @description Quality and Todos section formatters
 */

import type { AiContextData } from '../../../../types';
import { escapeXml, MAX_ITEMS_LARGE, MAX_ITEMS_MEDIUM } from '../../helpers';

type TodoItem = NonNullable<AiContextData['todos']>[0];

// ============================================================================
// QUALITY SECTION
// ============================================================================

/**
 * Format quality summary section
 */
function formatQualitySummary(
  lines: string[],
  summary: NonNullable<AiContextData['qualitySummary']>,
): void {
  lines.push(`    <summary total="${summary.totalIssues}" auto-fixable="${summary.autoFixable}">`);
  for (const [category, count] of Object.entries(summary.byCategory)) {
    lines.push(`      <category name="${category}" count="${count}"/>`);
  }
  lines.push('    </summary>');
}

/**
 * Format a single quality issue
 */
function formatQualityIssue(
  lines: string[],
  issue: NonNullable<AiContextData['qualityIssues']>[0],
): void {
  const fixable = issue.autoFixable ? ' fixable="true"' : '';
  const fixerId = issue.fixerId ? ` fixer="${issue.fixerId}"` : '';
  lines.push(
    `      <issue line="${issue.line || 0}" severity="${issue.severity}" category="${issue.category}"${fixable}${fixerId}>`,
  );
  lines.push(`        ${escapeXml(issue.message)}`);
  lines.push('      </issue>');
}

/**
 * Group quality issues by file
 */
function groupQualityIssuesByFile(
  qualityIssues: NonNullable<AiContextData['qualityIssues']>,
): Map<string, NonNullable<AiContextData['qualityIssues']>> {
  const byFile = new Map<string, NonNullable<AiContextData['qualityIssues']>>();
  for (const issue of qualityIssues) {
    const existing = byFile.get(issue.file) || [];
    existing.push(issue);
    byFile.set(issue.file, existing);
  }
  return byFile;
}

/**
 * Format quality issues section (from --with-audit)
 */
export function formatQualitySection(lines: string[], data: AiContextData): void {
  const { qualityIssues, qualitySummary } = data;
  if (!qualityIssues || qualityIssues.length === 0) return;

  lines.push('  <quality-issues>');

  if (qualitySummary) {
    formatQualitySummary(lines, qualitySummary);
  }

  const byFile = groupQualityIssuesByFile(qualityIssues);

  for (const [file, issues] of byFile) {
    lines.push(`    <file path="${file}">`);
    for (const issue of issues.slice(0, MAX_ITEMS_MEDIUM)) {
      formatQualityIssue(lines, issue);
    }
    if (issues.length > MAX_ITEMS_MEDIUM) {
      lines.push(`      <!-- +${issues.length - MAX_ITEMS_MEDIUM} more issues -->`);
    }
    lines.push('    </file>');
  }

  const fixableCount = qualityIssues.filter((i) => i.autoFixable).length;
  if (fixableCount > 0) {
    lines.push(`    <hint>Run 'krolik fix --quick' to auto-fix ${fixableCount} issues</hint>`);
  }

  lines.push('  </quality-issues>');
}

// ============================================================================
// TODOS SECTION
// ============================================================================

/**
 * Count TODOs by type
 */
function countTodosByType(todos: TodoItem[]): {
  TODO: number;
  FIXME: number;
  HACK: number;
  XXX: number;
} {
  return {
    TODO: todos.filter((t) => t.type === 'TODO').length,
    FIXME: todos.filter((t) => t.type === 'FIXME').length,
    HACK: todos.filter((t) => t.type === 'HACK').length,
    XXX: todos.filter((t) => t.type === 'XXX').length,
  };
}

/**
 * Group TODOs by file and sort by count (most first)
 */
function groupTodosByFile(todos: TodoItem[]): [string, TodoItem[]][] {
  const byFile = new Map<string, TodoItem[]>();
  for (const todo of todos) {
    const existing = byFile.get(todo.file) || [];
    existing.push(todo);
    byFile.set(todo.file, existing);
  }
  return [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
}

/**
 * Format a single TODO item (nested in file)
 */
function formatTodoItemNested(lines: string[], todo: TodoItem): void {
  const contextAttr = todo.context ? ` context="${escapeXml(todo.context)}"` : '';
  lines.push(`      <todo line="${todo.line}" type="${todo.type}"${contextAttr}>`);
  lines.push(`        ${escapeXml(todo.text)}`);
  lines.push('      </todo>');
}

/**
 * Format a single TODO item (standalone)
 */
function formatTodoItemStandalone(lines: string[], todo: TodoItem): void {
  const contextAttr = todo.context ? ` context="${escapeXml(todo.context)}"` : '';
  const genericAttr = todo.isGeneric ? ' generic="true"' : '';
  lines.push(
    `    <todo file="${escapeXml(todo.file)}" line="${todo.line}" type="${todo.type}"${contextAttr}${genericAttr}>`,
  );
  lines.push(`      ${escapeXml(todo.text)}`);
  lines.push('    </todo>');
}

/**
 * Format TODOs for a file with many items (grouped)
 */
function formatGroupedFileTodos(
  lines: string[],
  file: string,
  fileTodos: TodoItem[],
  displayedRef: { count: number },
): void {
  const actionable = fileTodos.filter((t) => !t.isGeneric);
  const generic = fileTodos.filter((t) => t.isGeneric);

  lines.push(`    <file path="${escapeXml(file)}" todos="${fileTodos.length}">`);

  for (const todo of actionable.slice(0, 3)) {
    formatTodoItemNested(lines, todo);
    displayedRef.count++;
  }

  const remaining = fileTodos.length - Math.min(actionable.length, 3);
  if (remaining > 0) {
    lines.push(
      `      <!-- +${remaining} more (${generic.length} generic like "implement test") -->`,
    );
  }

  lines.push('    </file>');
}

/**
 * Format TODOs for a file with few items (individual)
 */
function formatIndividualFileTodos(
  lines: string[],
  fileTodos: TodoItem[],
  displayedRef: { count: number },
): void {
  for (const todo of fileTodos) {
    if (displayedRef.count >= MAX_ITEMS_LARGE) break;
    formatTodoItemStandalone(lines, todo);
    displayedRef.count++;
  }
}

/**
 * Format TODOs section with context and grouping
 */
export function formatTodosSection(lines: string[], data: AiContextData): void {
  const { todos } = data;
  if (!todos || todos.length === 0) return;

  const counts = countTodosByType(todos);
  const genericCount = todos.filter((t) => t.isGeneric).length;
  const actionableCount = todos.length - genericCount;

  lines.push(
    `  <todos count="${todos.length}" actionable="${actionableCount}" generic="${genericCount}">`,
  );
  lines.push(
    `    <summary todo="${counts.TODO}" fixme="${counts.FIXME}" hack="${counts.HACK}" xxx="${counts.XXX}" />`,
  );

  const sortedFiles = groupTodosByFile(todos);
  const displayedRef = { count: 0 };

  for (const [file, fileTodos] of sortedFiles) {
    if (displayedRef.count >= MAX_ITEMS_LARGE) break;

    if (fileTodos.length > 3) {
      formatGroupedFileTodos(lines, file, fileTodos, displayedRef);
    } else {
      formatIndividualFileTodos(lines, fileTodos, displayedRef);
    }
  }

  const remaining = todos.length - displayedRef.count;
  if (remaining > 0) {
    lines.push(`    <!-- +${remaining} more TODOs -->`);
  }

  lines.push('  </todos>');
}
