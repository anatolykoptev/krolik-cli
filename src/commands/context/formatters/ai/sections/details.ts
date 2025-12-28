/**
 * @module commands/context/formatters/ai/sections/details
 * @description Component, Test, Hints, Approach, and PreCommit section formatters
 */

import type { AiContextData } from '../../../types';
import {
  escapeXml,
  MAX_ITEMS_LARGE,
  MAX_ITEMS_MEDIUM,
  MAX_ITEMS_SMALL,
  MAX_MEMORY_ITEMS,
} from '../helpers';

/**
 * Format components detail section
 */
export function formatComponentsSection(lines: string[], data: AiContextData): void {
  const { componentDetails } = data;
  if (!componentDetails || componentDetails.length === 0) return;

  lines.push('  <components-detail>');
  for (const comp of componentDetails.slice(0, MAX_ITEMS_LARGE)) {
    formatComponentDetail(lines, comp);
  }
  if (componentDetails.length > MAX_ITEMS_LARGE) {
    lines.push(`    <!-- +${componentDetails.length - MAX_ITEMS_LARGE} more components -->`);
  }
  lines.push('  </components-detail>');
}

/**
 * Format single component detail
 */
function formatComponentDetail(
  lines: string[],
  comp: NonNullable<AiContextData['componentDetails']>[0],
): void {
  lines.push(`    <component name="${comp.name}" type="${comp.type}">`);

  if (comp.purpose) {
    lines.push(`      <purpose>${escapeXml(comp.purpose)}</purpose>`);
  }
  if (comp.fields && comp.fields.length > 0) {
    lines.push(`      <fields>${comp.fields.join(', ')}</fields>`);
  }
  if (comp.state) {
    lines.push(`      <state>${comp.state}</state>`);
  }
  if (comp.hooks.length > 0) {
    lines.push(`      <hooks>${comp.hooks.join(', ')}</hooks>`);
  }
  if (comp.imports.length > 0) {
    lines.push(`      <imports>${comp.imports.slice(0, MAX_ITEMS_LARGE).join(', ')}</imports>`);
  }
  if (comp.errorHandling) {
    lines.push(`      <error-handling>${comp.errorHandling}</error-handling>`);
  }
  if (comp.features && comp.features.length > 0) {
    lines.push(`      <features>${comp.features.join(', ')}</features>`);
  }

  lines.push('    </component>');
}

/**
 * Format tests detail section
 */
export function formatTestsSection(lines: string[], data: AiContextData): void {
  const { testDetails } = data;
  if (!testDetails || testDetails.length === 0) return;

  lines.push('  <tests-detail>');
  for (const test of testDetails.slice(0, MAX_ITEMS_MEDIUM)) {
    formatTestDetail(lines, test);
  }
  lines.push('  </tests-detail>');
}

/**
 * Format single test detail
 */
function formatTestDetail(
  lines: string[],
  test: NonNullable<AiContextData['testDetails']>[0],
): void {
  lines.push(`    <test file="${test.file}">`);

  for (const desc of test.describes.slice(0, MAX_ITEMS_SMALL)) {
    lines.push(`      <describe name="${escapeXml(desc.name)}">`);

    for (const t of desc.tests.slice(0, MAX_ITEMS_LARGE)) {
      lines.push(`        <it>${escapeXml(t)}</it>`);
    }

    if (desc.tests.length > MAX_ITEMS_LARGE) {
      lines.push(`        <!-- +${desc.tests.length - MAX_ITEMS_LARGE} more tests -->`);
    }
    lines.push('      </describe>');
  }

  lines.push('    </test>');
}

/**
 * Format hints section
 */
export function formatHintsSection(lines: string[], data: AiContextData): void {
  const { hints } = data;
  if (!hints || Object.keys(hints).length === 0) return;

  lines.push('  <context-hints>');
  for (const [key, value] of Object.entries(hints)) {
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
    // Skip generic steps we already handle
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
    priority++;
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

  // Check for quality issues
  const hasQualityIssues = data.qualityIssues && data.qualityIssues.length > 0;
  const fixableCount = hasQualityIssues
    ? data.qualityIssues!.filter((i) => i.autoFixable).length
    : 0;

  // Check for git changes
  const hasChanges =
    data.git && (data.git.changedFiles.length > 0 || data.git.stagedFiles.length > 0);

  // Check for TODOs
  const hasTodos = data.todos && data.todos.length > 0;
  const actionableTodos = hasTodos ? data.todos!.filter((t) => !t.isGeneric).length : 0;

  // Actions based on state
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

  // Always useful actions
  lines.push('    <action tool="krolik_mem_save" trigger="after-decision">');
  lines.push('      type: "decision", title: "[what was decided]"');
  lines.push('    </action>');

  lines.push('    <action tool="krolik_mem_save" trigger="after-bugfix">');
  lines.push('      type: "bugfix", title: "[what was fixed]"');
  lines.push('    </action>');

  lines.push('  </next-actions>');
}

/** Type abbreviations for compact output */
const TYPE_ABBREV: Record<string, string> = {
  decision: 'DEC',
  pattern: 'PAT',
  bugfix: 'BUG',
  observation: 'OBS',
  feature: 'FEAT',
};

/**
 * Format memory section (knowledge from previous sessions)
 * Compact format: ~300 tokens vs ~1000 tokens (70% reduction)
 */
export function formatMemorySection(lines: string[], data: AiContextData): void {
  const { memories } = data;
  if (!memories || memories.length === 0) return;

  const displayMemories = memories.slice(0, MAX_MEMORY_ITEMS);

  lines.push(`  <memory n="${displayMemories.length}" hint="krolik_mem_search for details">`);

  for (const mem of displayMemories) {
    const typeAbbrev = TYPE_ABBREV[mem.type] ?? mem.type.toUpperCase().slice(0, 3);
    const tags = mem.tags?.length ? ` [${mem.tags.slice(0, 2).join(',')}]` : '';
    lines.push(`    <m t="${typeAbbrev}">${escapeXml(mem.title)}${tags}</m>`);
  }

  if (memories.length > MAX_MEMORY_ITEMS) {
    lines.push(`    <!-- +${memories.length - MAX_MEMORY_ITEMS} more -->`);
  }

  lines.push('  </memory>');
}

/**
 * Check if a library section is relevant to the given domains
 * Returns true if no domains specified (show all) or if section matches any domain
 */
function isRelevantToContext(
  section: { title: string; content: string },
  domains: string[],
): boolean {
  if (domains.length === 0) return true; // No domains = show all

  const text = `${section.title} ${section.content}`.toLowerCase();
  return domains.some((d) => text.includes(d.toLowerCase()));
}

/**
 * Filter library sections to only include domain-relevant ones
 */
function filterRelevantSections(
  sections: { title: string; content: string; codeSnippets: string[] }[],
  domains: string[],
): { title: string; content: string; codeSnippets: string[] }[] {
  if (domains.length === 0) return sections;
  return sections.filter((section) => isRelevantToContext(section, domains));
}

/**
 * Format code snippet for library documentation
 */
function formatCodeSnippet(lines: string[], snippet: string): void {
  lines.push('        <code>');
  lines.push(`          ${escapeXml(snippet.slice(0, 300))}`);
  if (snippet.length > 300) {
    lines.push('          <!-- truncated -->');
  }
  lines.push('        </code>');
}

/**
 * Format a single library section
 */
function formatLibrarySection(
  lines: string[],
  section: { title: string; content: string; codeSnippets: string[] },
): void {
  lines.push(`      <section title="${escapeXml(section.title)}">`);
  lines.push(`        <content>${escapeXml(section.content)}</content>`);

  for (const snippet of section.codeSnippets.slice(0, 2)) {
    formatCodeSnippet(lines, snippet);
  }

  lines.push('      </section>');
}

/**
 * Format a single library entry
 */
function formatLibraryEntry(
  lines: string[],
  lib: {
    libraryName: string;
    libraryId: string;
    sections: { title: string; content: string; codeSnippets: string[] }[];
  },
): void {
  lines.push(`    <library name="${lib.libraryName}" id="${lib.libraryId}">`);

  for (const section of lib.sections.slice(0, MAX_ITEMS_SMALL)) {
    formatLibrarySection(lines, section);
  }

  if (lib.sections.length > MAX_ITEMS_SMALL) {
    lines.push(`      <!-- +${lib.sections.length - MAX_ITEMS_SMALL} more sections -->`);
  }

  lines.push('    </library>');
}

/**
 * Format library documentation section (from Context7)
 * Filters sections based on domain relevance to prevent showing irrelevant docs
 */
export function formatLibraryDocsSection(lines: string[], data: AiContextData): void {
  const { libraryDocs } = data;
  if (!libraryDocs || libraryDocs.length === 0) return;

  const domains = data.context.domains || [];
  const availableLibraries: string[] = [];

  // Filter libraries and their sections based on domain relevance
  const relevantLibraries: Array<{
    libraryName: string;
    libraryId: string;
    sections: { title: string; content: string; codeSnippets: string[] }[];
  }> = [];

  for (const lib of libraryDocs) {
    if (lib.sections.length === 0) continue;

    availableLibraries.push(lib.libraryName);

    // Filter sections to only include domain-relevant ones
    const relevantSections = filterRelevantSections(lib.sections, domains);

    if (relevantSections.length > 0) {
      relevantLibraries.push({
        libraryName: lib.libraryName,
        libraryId: lib.libraryId,
        sections: relevantSections,
      });
    }
  }

  // If no relevant docs found, show fallback hint
  if (relevantLibraries.length === 0) {
    if (availableLibraries.length > 0 && domains.length > 0) {
      lines.push('  <library-docs hint="No domain-specific docs found">');
      lines.push(`    <available>${availableLibraries.join(', ')}</available>`);
      lines.push('    <tip>Use "krolik docs search {domain}" to find relevant docs</tip>');
      lines.push('  </library-docs>');
    }
    return;
  }

  lines.push('  <library-docs hint="Auto-fetched from Context7 - domain-relevant documentation">');

  for (const lib of relevantLibraries) {
    formatLibraryEntry(lines, lib);
  }

  lines.push('    <hint>Use "krolik docs search {query}" to find more documentation</hint>');
  lines.push('  </library-docs>');
}

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

type TodoItem = NonNullable<AiContextData['todos']>[0];

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
