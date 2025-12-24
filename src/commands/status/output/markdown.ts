/**
 * @module commands/status/output/markdown
 * @description Markdown format output
 */

import type { StatusResult } from '../../../types';
import { formatDuration, getHealthEmoji } from './shared';

// ============================================================================
// SECTION FORMATTERS
// ============================================================================

/** Format markdown header */
function mdHeader(status: StatusResult): string[] {
  const title = status.package
    ? `# ${status.package.name} v${status.package.version}`
    : '# Project Status';
  return [
    title,
    '',
    `${getHealthEmoji(status.health)} **Health: ${status.health.toUpperCase()}**`,
    '',
  ];
}

/** Format tech stack section */
function mdTechStack(techStack: StatusResult['techStack']): string[] {
  if (!techStack) return [];

  const items: string[] = [];
  if (techStack.framework) items.push(`**Framework:** ${techStack.framework}`);
  items.push(`**Language:** ${techStack.language === 'typescript' ? 'TypeScript' : 'JavaScript'}`);
  if (techStack.ui.length > 0) items.push(`**UI:** ${techStack.ui.join(', ')}`);
  if (techStack.database.length > 0) items.push(`**Database:** ${techStack.database.join(', ')}`);
  if (techStack.api.length > 0) items.push(`**API:** ${techStack.api.join(', ')}`);
  items.push(`**Package Manager:** ${techStack.packageManager}`);

  return ['## Tech Stack', '', ...items.map((i) => `- ${i}`), ''];
}

/** Format git section */
function mdGit(status: StatusResult): string[] {
  const { branch, git } = status;
  let changes = `- **Changes:** ${git.modified} modified, ${git.untracked} untracked, ${git.staged} staged`;
  if (git.ahead && git.ahead > 0) changes += ` (↑${git.ahead} ahead)`;
  if (git.behind && git.behind > 0) changes += ` (↓${git.behind} behind)`;
  return ['## Git', '', `- **Branch:** ${branch.name}`, changes, ''];
}

/** Format checks section */
function mdChecks(status: StatusResult): string[] {
  const { typecheck, lint, todos } = status;
  return [
    '## Checks',
    '',
    `- **Typecheck:** ${typecheck.status}${typecheck.cached ? ' (cached)' : ''}`,
    `- **Lint:** ${lint.warnings} warnings, ${lint.errors} errors`,
    `- **TODOs:** ${todos.count}`,
    '',
  ];
}

/** Format file stats section */
function mdFileStats(fileStats: StatusResult['fileStats']): string[] {
  if (!fileStats?.sourceFiles || fileStats.sourceFiles === 0) return [];
  return [
    '## Files',
    '',
    `- **Source files:** ${fileStats.sourceFiles}`,
    `- **Test files:** ${fileStats.testFiles}`,
    '',
  ];
}

/** Format dependencies section */
function mdDependencies(pkg: StatusResult['package']): string[] {
  if (!pkg) return [];
  return [
    '## Dependencies',
    '',
    `- **Dependencies:** ${pkg.depsCount}`,
    `- **Dev Dependencies:** ${pkg.devDepsCount}`,
    '',
  ];
}

/** Format recent commits section */
function mdCommits(commits: StatusResult['recentCommits']): string[] {
  if (!commits || commits.length === 0) return [];
  return [
    '## Recent Commits',
    '',
    ...commits.map((c) => `- \`${c.hash}\` ${c.message} *(${c.relativeDate})*`),
    '',
  ];
}

/** Format workspaces section */
function mdWorkspaces(workspaces: StatusResult['workspaces']): string[] {
  if (!workspaces || workspaces.length === 0) return [];

  const apps = workspaces.filter((w) => w.type === 'app');
  const packages = workspaces.filter((w) => w.type === 'package');

  const lines: string[] = ['## Workspaces', ''];
  if (apps.length > 0) {
    lines.push('**Apps:**');
    for (const ws of apps) lines.push(`- \`${ws.path}\` — ${ws.name}`);
  }
  if (packages.length > 0) {
    lines.push('**Packages:**');
    for (const ws of packages) lines.push(`- \`${ws.path}\` — ${ws.name}`);
  }
  lines.push('');
  return lines;
}

/** Format AI rules section */
function mdAIRules(aiRules: StatusResult['aiRules']): string[] {
  if (!aiRules || aiRules.length === 0) return [];
  return [
    '## AI Rules Files',
    '',
    '> **Important:** AI agents should read these files for project context and rules.',
    '',
    ...aiRules.map((r) => `- \`${r.relativePath}\` (${r.scope})`),
    '',
  ];
}

/** Format branch context section */
function mdBranchContext(ctx: StatusResult['branchContext']): string[] {
  if (!ctx) return [];

  const lines: string[] = [
    '## Branch Context',
    '',
    `- **Branch:** ${ctx.name}`,
    `- **Type:** ${ctx.type}`,
  ];
  if (ctx.issueNumber) lines.push(`- **Issue:** #${ctx.issueNumber}`);
  if (ctx.description) lines.push(`- **Description:** ${ctx.description}`);
  lines.push('');
  return lines;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Format status as markdown string
 */
export function formatMarkdown(status: StatusResult): string {
  return [
    ...mdHeader(status),
    ...mdTechStack(status.techStack),
    ...mdGit(status),
    ...mdChecks(status),
    ...mdFileStats(status.fileStats),
    ...mdDependencies(status.package),
    ...mdCommits(status.recentCommits),
    ...mdWorkspaces(status.workspaces),
    ...mdAIRules(status.aiRules),
    ...mdBranchContext(status.branchContext),
    '---',
    `*Completed in ${formatDuration(status.durationMs)}*`,
  ].join('\n');
}
