/**
 * @module commands/context/formatters/ai/sections/task-git
 * @description Task, Git, and Tree section formatters
 */

import type { AiContextData } from "../../../types";
import { escapeXml, truncate, MAX_ITEMS_SMALL, MAX_ITEMS_MEDIUM } from "../helpers";
import { truncateDiff } from "../diff-utils";

/**
 * Format task section
 */
export function formatTaskSection(lines: string[], data: AiContextData): void {
  const { context } = data;

  lines.push("  <task>");
  lines.push(`    <title>${escapeXml(context.task)}</title>`);
  lines.push(`    <domains>${context.domains.join(", ")}</domains>`);

  if (context.issue) {
    formatIssue(lines, context.issue);
  }

  lines.push("  </task>");
}

/**
 * Format issue subsection
 */
function formatIssue(
  lines: string[],
  issue: NonNullable<AiContextData["context"]["issue"]>,
): void {
  lines.push(`    <issue number="${issue.number}">`);
  lines.push(`      <title>${escapeXml(issue.title)}</title>`);

  if (issue.body) {
    lines.push(`      <body>${escapeXml(truncate(issue.body, 1000))}</body>`);
  }

  if (issue.labels.length > 0) {
    lines.push(`      <labels>${issue.labels.join(", ")}</labels>`);
  }

  lines.push("    </issue>");
}

/**
 * Format git section
 */
export function formatGitSection(lines: string[], data: AiContextData): void {
  const { git, context } = data;
  if (!git) return;

  lines.push("  <git>");
  lines.push(`    <branch>${git.branch}</branch>`);

  formatChangedFiles(lines, git);
  formatStagedFiles(lines, git);
  formatUntrackedFiles(lines, git);
  formatRecentCommits(lines, git);
  formatDiffSection(lines, git, context.domains);

  lines.push("  </git>");
}

/**
 * Format changed files
 */
function formatChangedFiles(lines: string[], git: NonNullable<AiContextData["git"]>): void {
  if (git.changedFiles.length === 0) return;

  const extra = git.changedFiles.length > 10
    ? `, +${git.changedFiles.length - 10} more`
    : "";
  lines.push(
    `    <changed count="${git.changedFiles.length}">${git.changedFiles.slice(0, 10).join(", ")}${extra}</changed>`,
  );
}

/**
 * Format staged files
 */
function formatStagedFiles(lines: string[], git: NonNullable<AiContextData["git"]>): void {
  if (git.stagedFiles.length === 0) return;

  lines.push(
    `    <staged count="${git.stagedFiles.length}">${git.stagedFiles.slice(0, MAX_ITEMS_MEDIUM).join(", ")}</staged>`,
  );
}

/**
 * Format untracked files
 */
function formatUntrackedFiles(lines: string[], git: NonNullable<AiContextData["git"]>): void {
  if (git.untrackedFiles.length === 0) return;

  lines.push(
    `    <untracked count="${git.untrackedFiles.length}">${git.untrackedFiles.slice(0, MAX_ITEMS_MEDIUM).join(", ")}</untracked>`,
  );
}

/**
 * Format recent commits
 */
function formatRecentCommits(lines: string[], git: NonNullable<AiContextData["git"]>): void {
  if (!git.recentCommits || git.recentCommits.length === 0) return;

  lines.push("    <recent-commits>");
  for (const commit of git.recentCommits.slice(0, MAX_ITEMS_SMALL)) {
    lines.push(`      <commit>${escapeXml(commit)}</commit>`);
  }
  lines.push("    </recent-commits>");
}

/**
 * Format diff section with smart truncation
 */
function formatDiffSection(
  lines: string[],
  git: NonNullable<AiContextData["git"]>,
  domains: string[],
): void {
  if (!git.diff || git.diff.length === 0) return;

  const { diff, truncated, summary } = truncateDiff(git.diff, domains);
  const diffLineCount = diff.split("\n").length;
  const originalLines = git.diff.split("\n").length;

  const truncAttr = truncated ? ` truncated="true" original="${originalLines}"` : "";
  lines.push(`    <diff lines="${diffLineCount}"${truncAttr}>`);
  lines.push("      <![CDATA[");
  lines.push(diff);
  if (summary) {
    lines.push(`\n${summary}`);
  }
  lines.push("      ]]>");
  lines.push("    </diff>");
}

/**
 * Format project tree section
 */
export function formatTreeSection(lines: string[], data: AiContextData): void {
  const { tree } = data;
  if (!tree) return;

  lines.push(
    `  <project-tree files="${tree.totalFiles}" dirs="${tree.totalDirs}">`,
  );
  lines.push("    <![CDATA[");
  lines.push(tree.structure);
  lines.push("    ]]>");
  lines.push("  </project-tree>");
}
