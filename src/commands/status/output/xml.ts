/**
 * @module commands/status/output/xml
 * @description XML/AI-friendly format output
 */

import { optimizeXml } from '../../../lib/@format';
import type { StatusResult } from '../../../types/commands/status';
import { determineNextAction } from './shared';

// ============================================================================
// SECTION FORMATTERS
// ============================================================================

/** Format XML package section */
function xmlPackage(pkg: StatusResult['package']): string[] {
  if (!pkg) return [];
  return [
    '  <package>',
    `    <name>${pkg.name}</name>`,
    `    <version>${pkg.version}</version>`,
    `    <dependencies count="${pkg.depsCount}" dev_count="${pkg.devDepsCount}" />`,
    '  </package>',
    '',
  ];
}

/** Format XML tech stack section */
function xmlTechStack(techStack: StatusResult['techStack']): string[] {
  if (!techStack) return [];

  const lines: string[] = ['  <tech-stack>'];
  if (techStack.framework) lines.push(`    <framework>${techStack.framework}</framework>`);
  lines.push(`    <language>${techStack.language}</language>`);
  lines.push(`    <package-manager>${techStack.packageManager}</package-manager>`);
  if (techStack.ui.length > 0) lines.push(`    <ui>${techStack.ui.join(', ')}</ui>`);
  if (techStack.database.length > 0)
    lines.push(`    <database>${techStack.database.join(', ')}</database>`);
  if (techStack.api.length > 0) lines.push(`    <api>${techStack.api.join(', ')}</api>`);
  lines.push('  </tech-stack>', '');
  return lines;
}

/** Format XML git section */
function xmlGit(status: StatusResult): string[] {
  const { branch, git } = status;
  const aheadBehind = [
    ...(git.ahead ? [`ahead="${git.ahead}"`] : []),
    ...(git.behind ? [`behind="${git.behind}"`] : []),
  ].join(' ');

  return [
    '  <git>',
    `    <branch name="${branch.name}" correct="${branch.isCorrect}" />`,
    `    <changes has_changes="${git.hasChanges}" ${aheadBehind}>`,
    `      <modified>${git.modified}</modified>`,
    `      <untracked>${git.untracked}</untracked>`,
    `      <staged>${git.staged}</staged>`,
    '    </changes>',
    '  </git>',
    '',
  ];
}

/** Format XML checks section */
function xmlChecks(status: StatusResult): string[] {
  return [
    '  <checks>',
    `    <typecheck status="${status.typecheck.status}" cached="${status.typecheck.cached}" />`,
    `    <lint warnings="${status.lint.warnings}" errors="${status.lint.errors}" />`,
    `    <todos count="${status.todos.count}" />`,
    '  </checks>',
  ];
}

/** Format XML file stats section */
function xmlFileStats(fileStats: StatusResult['fileStats']): string[] {
  if (!fileStats?.sourceFiles || fileStats.sourceFiles === 0) return [];
  return [
    '',
    '  <files>',
    `    <source_files>${fileStats.sourceFiles}</source_files>`,
    `    <test_files>${fileStats.testFiles}</test_files>`,
    '  </files>',
  ];
}

/** Format XML recent commits section */
function xmlCommits(commits: StatusResult['recentCommits']): string[] {
  if (!commits || commits.length === 0) return [];
  return [
    '',
    '  <recent-commits>',
    ...commits.flatMap((c) => [
      `    <commit hash="${c.hash}" author="${c.author}" time="${c.relativeDate}">`,
      `      ${c.message}`,
      '    </commit>',
    ]),
    '  </recent-commits>',
  ];
}

/** Format XML workspaces section */
function xmlWorkspaces(workspaces: StatusResult['workspaces']): string[] {
  if (!workspaces || workspaces.length === 0) return [];

  const apps = workspaces.filter((w) => w.type === 'app');
  const packages = workspaces.filter((w) => w.type === 'package');

  const lines: string[] = ['', '  <workspaces>'];
  if (apps.length > 0) {
    lines.push('    <apps>');
    for (const ws of apps) lines.push(`      <app name="${ws.name}" path="${ws.path}" />`);
    lines.push('    </apps>');
  }
  if (packages.length > 0) {
    lines.push('    <packages>');
    for (const ws of packages) lines.push(`      <package name="${ws.name}" path="${ws.path}" />`);
    lines.push('    </packages>');
  }
  lines.push('  </workspaces>');
  return lines;
}

/** Format XML branch context section */
function xmlBranchContext(ctx: StatusResult['branchContext']): string[] {
  if (!ctx) return [];
  const issueAttr = ctx.issueNumber ? ` issue="${ctx.issueNumber}"` : '';
  const lines: string[] = [
    '',
    `  <branch-context name="${ctx.name}" type="${ctx.type}"${issueAttr}>`,
  ];
  if (ctx.description) lines.push(`    <description>${ctx.description}</description>`);
  lines.push('  </branch-context>');
  return lines;
}

/** Type abbreviations for compact output */
const TYPE_ABBREV: Record<string, string> = {
  decision: 'DEC',
  pattern: 'PAT',
  bugfix: 'BUG',
  observation: 'OBS',
  feature: 'FEAT',
};

/** Format XML memory section */
function xmlMemory(memory: StatusResult['memory']): string[] {
  if (!memory || memory.length === 0) return [];
  const lines: string[] = [
    '',
    `  <memory n="${memory.length}" hint="krolik_mem_search for details">`,
  ];
  for (const m of memory) {
    const typeAbbrev = TYPE_ABBREV[m.type] ?? m.type.toUpperCase().slice(0, 3);
    const tags = m.tags?.length ? ` [${m.tags.slice(0, 2).join(',')}]` : '';
    lines.push(`    <m t="${typeAbbrev}">${m.title}${tags}</m>`);
  }
  lines.push('  </memory>');
  return lines;
}

/** Format XML AI rules section */
function xmlAIRules(aiRules: StatusResult['aiRules']): string[] {
  if (!aiRules || aiRules.length === 0) return [];
  return [
    '',
    '  <ai-rules priority="critical">',
    '    <instruction>',
    '      IMPORTANT: Read these files BEFORE starting any work!',
    '      They contain project-specific rules, conventions, and context.',
    '    </instruction>',
    '    <files>',
    ...aiRules.map((r) => `      <file path="${r.relativePath}" scope="${r.scope}" />`),
    '    </files>',
    '    <reminder>',
    '      After reading, keep these rules in mind throughout the session.',
    '      Re-read if you feel you are deviating from project conventions.',
    '    </reminder>',
    '  </ai-rules>',
  ];
}

/** Format XML next action section */
function xmlNextAction(status: StatusResult): string[] {
  const next = determineNextAction(status);
  const lines: string[] = [
    '',
    '  <next-action>',
    `    <step priority="${next.priority}">${next.action}</step>`,
  ];
  if (next.reason) lines.push(`    <reason>${next.reason}</reason>`);
  lines.push('  </next-action>');
  return lines;
}

/** Format XML do-not rules section */
function xmlDoNot(status: StatusResult): string[] {
  const rules = [
    'Do not commit without running typecheck first',
    'Do not push directly to main/master branch',
    'Do not add dependencies without checking existing ones',
    'Do not ignore TypeScript errors with @ts-ignore',
    'Do not leave console.log in production code',
  ];
  if (status.git.behind && status.git.behind > 0) {
    rules.push(
      `Do not commit before pulling latest changes (you are behind by ${status.git.behind} commits)`,
    );
  }
  if (status.typecheck.status === 'failed') {
    rules.push('Do not add new features until TypeScript errors are fixed');
  }
  return ['', '  <do-not>', ...rules.map((r) => `    <rule>${r}</rule>`), '  </do-not>'];
}

/** Format XML suggestions section */
function xmlSuggestions(status: StatusResult): string[] {
  const lines: string[] = ['', '  <suggestions>'];

  if (status.aiRules && status.aiRules.length > 0) {
    lines.push(
      `    <action priority="critical">Read AI rules files before proceeding: ${status.aiRules.map((r) => r.relativePath).join(', ')}</action>`,
    );
  }
  if (status.health === 'error') {
    if (status.typecheck.status === 'failed') {
      lines.push('    <action priority="high">Fix TypeScript errors before proceeding</action>');
    }
    if (status.lint.errors > 0) {
      lines.push('    <action priority="high">Fix lint errors</action>');
    }
  }
  if (status.git.hasChanges) {
    if (status.git.staged > 0) {
      lines.push(
        `    <action priority="high">Commit staged changes (${status.git.staged} files ready)</action>`,
      );
    } else {
      lines.push(
        `    <action priority="medium">Review and stage changes: ${status.git.modified} modified, ${status.git.untracked} untracked files</action>`,
      );
      if (status.git.modified + status.git.untracked > 10) {
        lines.push(
          '    <action priority="medium">Consider splitting changes into smaller commits</action>',
        );
      }
    }
  }
  if (status.git.ahead && status.git.ahead > 0) {
    lines.push(
      `    <action priority="medium">Push ${status.git.ahead} unpushed commit(s) to remote</action>`,
    );
  }
  if (status.git.behind && status.git.behind > 0) {
    lines.push(
      `    <action priority="high">Pull ${status.git.behind} new commit(s) from remote before continuing</action>`,
    );
  }
  if (status.todos.count > 30) {
    lines.push('    <action priority="low">Review and clean up TODOs</action>');
  }
  if (
    status.health === 'good' &&
    !status.git.hasChanges &&
    (!status.aiRules || status.aiRules.length === 0)
  ) {
    lines.push('    <action>Project is ready for development</action>');
  }

  lines.push('  </suggestions>');
  return lines;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Format status as AI-friendly XML string
 */
export function formatAI(status: StatusResult): string {
  const xml = [
    '<project-status>',
    `  <health status="${status.health}" duration_ms="${status.durationMs}" />`,
    '',
    ...xmlPackage(status.package),
    ...xmlTechStack(status.techStack),
    ...xmlGit(status),
    ...xmlChecks(status),
    ...xmlFileStats(status.fileStats),
    ...xmlCommits(status.recentCommits),
    ...xmlWorkspaces(status.workspaces),
    ...xmlBranchContext(status.branchContext),
    ...xmlMemory(status.memory),
    ...xmlAIRules(status.aiRules),
    ...xmlNextAction(status),
    ...xmlDoNot(status),
    ...xmlSuggestions(status),
    '</project-status>',
  ].join('\n');

  return optimizeXml(xml, { level: 'aggressive' }).output;
}

/**
 * Report summary for AI-REPORT.md context
 */
export interface ReportSummary {
  reportPath: string;
  totalIssues: number;
  autoFixable: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  hotspotFiles: string[];
  quickWins: number;
  /** Number of i18n issues excluded (>= 100) */
  excludedI18nCount?: number;
}

/**
 * Format output for --report mode
 * Designed to give AI maximum context with clear instructions
 */
export function formatReportOutput(status: StatusResult, summary: ReportSummary): string {
  const criticalWarning =
    summary.critical > 0
      ? `\n  ⚠️  ${summary.critical} CRITICAL issue(s) require immediate attention!`
      : '';

  const healthEmoji = status.health === 'good' ? '✅' : status.health === 'warning' ? '⚠️' : '❌';

  const xml = `<ai-task priority="critical">
  <instruction>
    📋 REQUIRED: Read the generated report before proceeding.
    This report contains detailed code quality analysis with specific issues and suggested fixes.
  </instruction>

  <report-file path="${summary.reportPath}">
    <action>Use the Read tool to read this file NOW</action>
    <reason>Contains ${summary.totalIssues} issues with line numbers, code snippets, and fix suggestions</reason>
  </report-file>
</ai-task>

<report-summary>
  <metrics>
    <total_issues>${summary.totalIssues}</total_issues>
    <auto_fixable>${summary.autoFixable}</auto_fixable>
    <manual_required>${summary.totalIssues - summary.autoFixable}</manual_required>
  </metrics>

  <by_priority>
    <critical count="${summary.critical}">${summary.critical > 0 ? 'FIX IMMEDIATELY' : 'None'}</critical>
    <high count="${summary.high}">${summary.high > 0 ? 'Address this sprint' : 'None'}</high>
    <medium count="${summary.medium}">${summary.medium > 0 ? 'Improve maintainability' : 'None'}</medium>
    <low count="${summary.low}">${summary.low > 0 ? 'Nice to fix' : 'None'}</low>
  </by_priority>${criticalWarning}

  <quick_wins count="${summary.quickWins}">
    ${summary.quickWins > 0 ? `${summary.quickWins} issues can be auto-fixed with: krolik fix --trivial` : 'No quick wins available'}
  </quick_wins>

  <hotspot_files description="Files with most issues">
${summary.hotspotFiles
  .slice(0, 3)
  .map((f) => `    <file>${f}</file>`)
  .join('\n')}
  </hotspot_files>${
    summary.excludedI18nCount
      ? `

  <i18n_note>
    🌍 ${summary.excludedI18nCount} i18n issues (hardcoded text) detected.
    Run: krolik fix --category i18n --dry-run
  </i18n_note>`
      : ''
  }
</report-summary>

<project-health status="${status.health}" emoji="${healthEmoji}">
  <branch>${status.branch.name}</branch>
  <typecheck>${status.typecheck.status}</typecheck>
  <lint_errors>${status.lint.errors}</lint_errors>
  <pending_changes modified="${status.git.modified}" staged="${status.git.staged}" />
</project-health>

<workflow>
  <step order="1" required="true">Read the report: ${summary.reportPath}</step>
  <step order="2" required="${summary.critical > 0}">Fix CRITICAL issues first</step>
  <step order="3" optional="true">Run: krolik fix --dry-run (preview auto-fixes)</step>
  <step order="4" optional="true">Run: krolik fix --safe (apply safe fixes)</step>
</workflow>

<do-not>
  <rule>Do not start new features until CRITICAL issues are resolved</rule>
  <rule>Do not ignore the report — it contains specific line numbers and fixes</rule>
  <rule>Do not use @ts-ignore to bypass TypeScript errors</rule>
  <rule>Do not commit code with lint errors</rule>
</do-not>`;

  return optimizeXml(xml, { level: 'aggressive' }).output;
}
