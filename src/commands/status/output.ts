/**
 * @module commands/status/output
 * @description Status command output formatters
 */

import type { Logger, StatusResult } from "../../types";
import { formatDuration } from "../../lib/timing";

const MAX_PAGE_SIZE = 50;

// Re-export for backwards compatibility
export { formatDuration };

/**
 * Get status icon
 */
function icon(ok: boolean): string {
  return ok ? "✅" : "❌";
}

/**
 * Print status in text format
 */
export function printStatus(
  status: StatusResult,
  logger: Logger,
  verbose = false,
): void {
  logger.section("Project Status");

  // Package info
  if (status.package) {
    console.log(`\x1b[1m${status.package.name}\x1b[0m v${status.package.version}`);
    console.log(`📦 ${status.package.depsCount} deps, ${status.package.devDepsCount} devDeps`);
    console.log("");
  }

  // Tech stack
  if (status.techStack) {
    const stack: string[] = [];
    if (status.techStack.framework) stack.push(status.techStack.framework);
    stack.push(status.techStack.language === 'typescript' ? 'TypeScript' : 'JavaScript');
    if (status.techStack.ui.length > 0) stack.push(...status.techStack.ui.slice(0, 2));
    if (status.techStack.database.length > 0) stack.push(status.techStack.database[0]!);
    if (status.techStack.api.length > 0) stack.push(status.techStack.api[0]!);
    console.log(`🛠️  Stack: ${stack.join(' · ')}`);
    console.log("");
  }

  // Branch
  logger.info(`${icon(status.branch.isCorrect)} Branch: ${status.branch.name}`);

  // Git status
  if (status.git.hasChanges) {
    const changes = status.git.modified + status.git.untracked;
    let gitInfo = `⚠️  Working tree: ${changes} changes (${status.git.staged} staged)`;
    if (status.git.ahead && status.git.ahead > 0) {
      gitInfo += ` ↑${status.git.ahead}`;
    }
    if (status.git.behind && status.git.behind > 0) {
      gitInfo += ` ↓${status.git.behind}`;
    }
    logger.info(gitInfo);
  } else {
    let gitInfo = `${icon(true)} Working tree: clean`;
    if (status.git.ahead && status.git.ahead > 0) {
      gitInfo += ` ↑${status.git.ahead}`;
    }
    if (status.git.behind && status.git.behind > 0) {
      gitInfo += ` ↓${status.git.behind}`;
    }
    logger.info(gitInfo);
  }

  // Typecheck
  const typecheckStatus = status.typecheck.status;
  const typecheckOk =
    typecheckStatus === "passed" || typecheckStatus === "skipped";
  const typecheckSuffix = status.typecheck.cached ? " (cached)" : "";
  logger.info(
    `${icon(typecheckOk)} Typecheck: ${typecheckStatus}${typecheckSuffix}`,
  );

  // Lint
  const lintOk = status.lint.errors === 0;
  logger.info(
    `${icon(lintOk)} Lint: ${status.lint.warnings} warnings, ${status.lint.errors} errors`,
  );

  // TODOs
  const todoIcon =
    status.todos.count > MAX_PAGE_SIZE
      ? "⚠️ "
      : status.todos.count > 0
        ? "📝"
        : "✅";
  logger.info(`${todoIcon} TODOs: ${status.todos.count}`);

  // File stats
  if (status.fileStats && status.fileStats.sourceFiles > 0) {
    console.log(`📁 Files: ${status.fileStats.sourceFiles} source, ${status.fileStats.testFiles} tests`);
  }

  // Workspaces (monorepo)
  if (status.workspaces && status.workspaces.length > 0) {
    const apps = status.workspaces.filter((w) => w.type === 'app').length;
    const packages = status.workspaces.filter((w) => w.type === 'package').length;
    console.log(`📦 Monorepo: ${apps} apps, ${packages} packages`);
  }

  // AI Rules files
  if (status.aiRules && status.aiRules.length > 0) {
    console.log(`📋 AI Rules: ${status.aiRules.length} files (${status.aiRules.map((r) => r.relativePath).join(', ')})`);
  }

  // Branch context
  if (status.branchContext) {
    const ctx = status.branchContext;
    let branchInfo = `🔀 Branch: ${ctx.name} (${ctx.type})`;
    if (ctx.issueNumber) branchInfo += ` #${ctx.issueNumber}`;
    if (ctx.description) branchInfo += ` — ${ctx.description}`;
    console.log(branchInfo);
  }

  // Recent commits
  if (verbose && status.recentCommits && status.recentCommits.length > 0) {
    console.log("");
    console.log("\x1b[2m─── Recent Commits ───\x1b[0m");
    for (const commit of status.recentCommits) {
      console.log(`  \x1b[33m${commit.hash}\x1b[0m ${commit.message} \x1b[2m(${commit.relativeDate})\x1b[0m`);
    }
  }

  // Verbose mode - show additional info
  if (verbose && status.typecheck.errors) {
    console.log("");
    logger.warn("Typecheck errors:");
    console.log(status.typecheck.errors);
  }

  // Health summary
  console.log("");
  const healthIcon =
    status.health === "good" ? "🟢" : status.health === "warning" ? "🟡" : "🔴";
  logger.info(
    `${healthIcon} Health: ${status.health.toUpperCase()} (${formatDuration(status.durationMs)})`,
  );
}

/**
 * Format status as JSON
 */
export function formatJson(status: StatusResult): string {
  return JSON.stringify(status, null, 2);
}

/**
 * Format status as markdown
 */
export function formatMarkdown(status: StatusResult): string {
  const healthEmoji =
    status.health === "good" ? "🟢" : status.health === "warning" ? "🟡" : "🔴";

  const lines: string[] = [];

  // Header
  if (status.package) {
    lines.push(`# ${status.package.name} v${status.package.version}`);
  } else {
    lines.push("# Project Status");
  }
  lines.push("");
  lines.push(`${healthEmoji} **Health: ${status.health.toUpperCase()}**`);
  lines.push("");

  // Tech stack
  if (status.techStack) {
    lines.push("## Tech Stack");
    lines.push("");
    const stack: string[] = [];
    if (status.techStack.framework) stack.push(`**Framework:** ${status.techStack.framework}`);
    stack.push(`**Language:** ${status.techStack.language === 'typescript' ? 'TypeScript' : 'JavaScript'}`);
    if (status.techStack.ui.length > 0) stack.push(`**UI:** ${status.techStack.ui.join(', ')}`);
    if (status.techStack.database.length > 0) stack.push(`**Database:** ${status.techStack.database.join(', ')}`);
    if (status.techStack.api.length > 0) stack.push(`**API:** ${status.techStack.api.join(', ')}`);
    stack.push(`**Package Manager:** ${status.techStack.packageManager}`);
    for (const item of stack) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  // Git
  lines.push("## Git");
  lines.push("");
  lines.push(`- **Branch:** ${status.branch.name}`);
  let gitChanges = `- **Changes:** ${status.git.modified} modified, ${status.git.untracked} untracked, ${status.git.staged} staged`;
  if (status.git.ahead && status.git.ahead > 0) gitChanges += ` (↑${status.git.ahead} ahead)`;
  if (status.git.behind && status.git.behind > 0) gitChanges += ` (↓${status.git.behind} behind)`;
  lines.push(gitChanges);
  lines.push("");

  // Checks
  lines.push("## Checks");
  lines.push("");
  lines.push(`- **Typecheck:** ${status.typecheck.status}${status.typecheck.cached ? " (cached)" : ""}`);
  lines.push(`- **Lint:** ${status.lint.warnings} warnings, ${status.lint.errors} errors`);
  lines.push(`- **TODOs:** ${status.todos.count}`);
  lines.push("");

  // File stats
  if (status.fileStats && status.fileStats.sourceFiles > 0) {
    lines.push("## Files");
    lines.push("");
    lines.push(`- **Source files:** ${status.fileStats.sourceFiles}`);
    lines.push(`- **Test files:** ${status.fileStats.testFiles}`);
    lines.push("");
  }

  // Package deps
  if (status.package) {
    lines.push("## Dependencies");
    lines.push("");
    lines.push(`- **Dependencies:** ${status.package.depsCount}`);
    lines.push(`- **Dev Dependencies:** ${status.package.devDepsCount}`);
    lines.push("");
  }

  // Recent commits
  if (status.recentCommits && status.recentCommits.length > 0) {
    lines.push("## Recent Commits");
    lines.push("");
    for (const commit of status.recentCommits) {
      lines.push(`- \`${commit.hash}\` ${commit.message} *(${commit.relativeDate})*`);
    }
    lines.push("");
  }

  // Workspaces (monorepo)
  if (status.workspaces && status.workspaces.length > 0) {
    lines.push("## Workspaces");
    lines.push("");
    const grouped = {
      apps: status.workspaces.filter((w) => w.type === 'app'),
      packages: status.workspaces.filter((w) => w.type === 'package'),
      other: status.workspaces.filter((w) => w.type !== 'app' && w.type !== 'package'),
    };
    if (grouped.apps.length > 0) {
      lines.push("**Apps:**");
      for (const ws of grouped.apps) {
        lines.push(`- \`${ws.path}\` — ${ws.name}`);
      }
    }
    if (grouped.packages.length > 0) {
      lines.push("**Packages:**");
      for (const ws of grouped.packages) {
        lines.push(`- \`${ws.path}\` — ${ws.name}`);
      }
    }
    lines.push("");
  }

  // AI Rules
  if (status.aiRules && status.aiRules.length > 0) {
    lines.push("## AI Rules Files");
    lines.push("");
    lines.push("> **Important:** AI agents should read these files for project context and rules.");
    lines.push("");
    for (const rule of status.aiRules) {
      lines.push(`- \`${rule.relativePath}\` (${rule.scope})`);
    }
    lines.push("");
  }

  // Branch context
  if (status.branchContext) {
    lines.push("## Branch Context");
    lines.push("");
    lines.push(`- **Branch:** ${status.branchContext.name}`);
    lines.push(`- **Type:** ${status.branchContext.type}`);
    if (status.branchContext.issueNumber) {
      lines.push(`- **Issue:** #${status.branchContext.issueNumber}`);
    }
    if (status.branchContext.description) {
      lines.push(`- **Description:** ${status.branchContext.description}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Completed in ${formatDuration(status.durationMs)}*`);

  return lines.join("\n");
}

/**
 * Determine the next action based on project status
 */
interface NextAction {
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  reason?: string;
}

function determineNextAction(status: StatusResult): NextAction {
  // Priority order: AI rules > pull behind > fix errors > commit > ready

  // 1. AI rules files should be read first
  if (status.aiRules && status.aiRules.length > 0) {
    return {
      priority: 'critical',
      action: `Read AI rules files: ${status.aiRules.map((r) => r.relativePath).join(', ')}`,
      reason: 'Project has AI configuration files that define conventions and rules',
    };
  }

  // 2. If behind remote, pull first
  if (status.git.behind && status.git.behind > 0) {
    return {
      priority: 'high',
      action: `Pull ${status.git.behind} commit(s) from remote`,
      reason: 'You are behind the remote branch and may have conflicts',
    };
  }

  // 3. Fix TypeScript errors
  if (status.typecheck.status === 'failed') {
    return {
      priority: 'high',
      action: 'Fix TypeScript errors (run: pnpm typecheck)',
      reason: 'Code will not compile until errors are fixed',
    };
  }

  // 4. Fix lint errors
  if (status.lint.errors > 0) {
    return {
      priority: 'high',
      action: `Fix ${status.lint.errors} lint error(s) (run: pnpm lint --fix)`,
      reason: 'Lint errors indicate code quality issues',
    };
  }

  // 5. Commit staged changes
  if (status.git.staged > 0) {
    return {
      priority: 'medium',
      action: `Commit ${status.git.staged} staged file(s)`,
      reason: 'You have changes ready to commit',
    };
  }

  // 6. Stage and commit unstaged changes
  if (status.git.hasChanges) {
    const changes = status.git.modified + status.git.untracked;
    return {
      priority: 'medium',
      action: `Stage and commit ${changes} changed file(s)`,
      reason: 'Uncommitted changes should be saved before continuing',
    };
  }

  // 7. Push unpushed commits
  if (status.git.ahead && status.git.ahead > 0) {
    return {
      priority: 'low',
      action: `Push ${status.git.ahead} commit(s) to remote`,
      reason: 'Share your work with the team',
    };
  }

  // 8. Ready for development
  return {
    priority: 'low',
    action: 'Start development - project is in good state',
    reason: 'All checks pass, working tree is clean',
  };
}

/**
 * Format status as AI-friendly XML
 */
export function formatAI(status: StatusResult): string {
  const lines: string[] = [];

  lines.push('<project-status>');
  lines.push(`  <health status="${status.health}" duration_ms="${status.durationMs}" />`);
  lines.push('');

  // Package info
  if (status.package) {
    lines.push('  <package>');
    lines.push(`    <name>${status.package.name}</name>`);
    lines.push(`    <version>${status.package.version}</version>`);
    lines.push(`    <dependencies count="${status.package.depsCount}" dev_count="${status.package.devDepsCount}" />`);
    lines.push('  </package>');
    lines.push('');
  }

  // Tech stack
  if (status.techStack) {
    lines.push('  <tech-stack>');
    if (status.techStack.framework) {
      lines.push(`    <framework>${status.techStack.framework}</framework>`);
    }
    lines.push(`    <language>${status.techStack.language}</language>`);
    lines.push(`    <package-manager>${status.techStack.packageManager}</package-manager>`);
    if (status.techStack.ui.length > 0) {
      lines.push(`    <ui>${status.techStack.ui.join(', ')}</ui>`);
    }
    if (status.techStack.database.length > 0) {
      lines.push(`    <database>${status.techStack.database.join(', ')}</database>`);
    }
    if (status.techStack.api.length > 0) {
      lines.push(`    <api>${status.techStack.api.join(', ')}</api>`);
    }
    lines.push('  </tech-stack>');
    lines.push('');
  }

  // Git
  lines.push('  <git>');
  lines.push(`    <branch name="${status.branch.name}" correct="${status.branch.isCorrect}" />`);
  const aheadBehind = [
    ...(status.git.ahead ? [`ahead="${status.git.ahead}"`] : []),
    ...(status.git.behind ? [`behind="${status.git.behind}"`] : []),
  ].join(' ');
  lines.push(`    <changes has_changes="${status.git.hasChanges}" ${aheadBehind}>`);
  lines.push(`      <modified>${status.git.modified}</modified>`);
  lines.push(`      <untracked>${status.git.untracked}</untracked>`);
  lines.push(`      <staged>${status.git.staged}</staged>`);
  lines.push('    </changes>');
  lines.push('  </git>');
  lines.push('');

  // Checks
  lines.push('  <checks>');
  lines.push(`    <typecheck status="${status.typecheck.status}" cached="${status.typecheck.cached}" />`);
  lines.push(`    <lint warnings="${status.lint.warnings}" errors="${status.lint.errors}" />`);
  lines.push(`    <todos count="${status.todos.count}" />`);
  lines.push('  </checks>');

  // File stats
  if (status.fileStats && status.fileStats.sourceFiles > 0) {
    lines.push('');
    lines.push('  <files>');
    lines.push(`    <source_files>${status.fileStats.sourceFiles}</source_files>`);
    lines.push(`    <test_files>${status.fileStats.testFiles}</test_files>`);
    lines.push('  </files>');
  }

  // Recent commits
  if (status.recentCommits && status.recentCommits.length > 0) {
    lines.push('');
    lines.push('  <recent-commits>');
    for (const commit of status.recentCommits) {
      lines.push(`    <commit hash="${commit.hash}" author="${commit.author}" time="${commit.relativeDate}">`);
      lines.push(`      ${commit.message}`);
      lines.push('    </commit>');
    }
    lines.push('  </recent-commits>');
  }

  // Workspaces (monorepo)
  if (status.workspaces && status.workspaces.length > 0) {
    lines.push('');
    lines.push('  <workspaces>');
    const apps = status.workspaces.filter((w) => w.type === 'app');
    const packages = status.workspaces.filter((w) => w.type === 'package');
    if (apps.length > 0) {
      lines.push('    <apps>');
      for (const ws of apps) {
        lines.push(`      <app name="${ws.name}" path="${ws.path}" />`);
      }
      lines.push('    </apps>');
    }
    if (packages.length > 0) {
      lines.push('    <packages>');
      for (const ws of packages) {
        lines.push(`      <package name="${ws.name}" path="${ws.path}" />`);
      }
      lines.push('    </packages>');
    }
    lines.push('  </workspaces>');
  }

  // Branch context
  if (status.branchContext) {
    lines.push('');
    const ctx = status.branchContext;
    const issueAttr = ctx.issueNumber ? ` issue="${ctx.issueNumber}"` : '';
    lines.push(`  <branch-context name="${ctx.name}" type="${ctx.type}"${issueAttr}>`);
    if (ctx.description) {
      lines.push(`    <description>${ctx.description}</description>`);
    }
    lines.push('  </branch-context>');
  }

  // AI Rules - CRITICAL SECTION
  if (status.aiRules && status.aiRules.length > 0) {
    lines.push('');
    lines.push('  <ai-rules priority="critical">');
    lines.push('    <instruction>');
    lines.push('      IMPORTANT: Read these files BEFORE starting any work!');
    lines.push('      They contain project-specific rules, conventions, and context.');
    lines.push('    </instruction>');
    lines.push('    <files>');
    for (const rule of status.aiRules) {
      lines.push(`      <file path="${rule.relativePath}" scope="${rule.scope}" />`);
    }
    lines.push('    </files>');
    lines.push('    <reminder>');
    lines.push('      After reading, keep these rules in mind throughout the session.');
    lines.push('      Re-read if you feel you are deviating from project conventions.');
    lines.push('    </reminder>');
    lines.push('  </ai-rules>');
  }

  // Next action - what to do RIGHT NOW
  lines.push('');
  lines.push('  <next-action>');
  const nextAction = determineNextAction(status);
  lines.push(`    <step priority="${nextAction.priority}">${nextAction.action}</step>`);
  if (nextAction.reason) {
    lines.push(`    <reason>${nextAction.reason}</reason>`);
  }
  lines.push('  </next-action>');

  // Do-not section - anti-patterns to avoid
  lines.push('');
  lines.push('  <do-not>');
  lines.push('    <rule>Do not commit without running typecheck first</rule>');
  lines.push('    <rule>Do not push directly to main/master branch</rule>');
  lines.push('    <rule>Do not add dependencies without checking existing ones</rule>');
  lines.push('    <rule>Do not ignore TypeScript errors with @ts-ignore</rule>');
  lines.push('    <rule>Do not leave console.log in production code</rule>');
  if (status.git.behind && status.git.behind > 0) {
    lines.push('    <rule>Do not commit before pulling latest changes (you are behind by ' + status.git.behind + ' commits)</rule>');
  }
  if (status.typecheck.status === 'failed') {
    lines.push('    <rule>Do not add new features until TypeScript errors are fixed</rule>');
  }
  lines.push('  </do-not>');

  // Add action suggestions based on status
  lines.push('');
  lines.push('  <suggestions>');

  // AI Rules reminder is highest priority
  if (status.aiRules && status.aiRules.length > 0) {
    lines.push('    <action priority="critical">Read AI rules files before proceeding: ' +
      status.aiRules.map((r) => r.relativePath).join(', ') + '</action>');
  }

  if (status.health === 'error') {
    if (status.typecheck.status === 'failed') {
      lines.push('    <action priority="high">Fix TypeScript errors before proceeding</action>');
    }
    if (status.lint.errors > 0) {
      lines.push('    <action priority="high">Fix lint errors</action>');
    }
  }

  // Git commit suggestions with more detail
  if (status.git.hasChanges) {
    if (status.git.staged > 0) {
      lines.push(`    <action priority="high">Commit staged changes (${status.git.staged} files ready)</action>`);
    } else {
      const totalChanges = status.git.modified + status.git.untracked;
      lines.push(`    <action priority="medium">Review and stage changes: ${status.git.modified} modified, ${status.git.untracked} untracked files</action>`);
      if (totalChanges > 10) {
        lines.push('    <action priority="medium">Consider splitting changes into smaller commits</action>');
      }
    }
  }

  // Ahead/behind suggestions
  if (status.git.ahead && status.git.ahead > 0) {
    lines.push(`    <action priority="medium">Push ${status.git.ahead} unpushed commit(s) to remote</action>`);
  }
  if (status.git.behind && status.git.behind > 0) {
    lines.push(`    <action priority="high">Pull ${status.git.behind} new commit(s) from remote before continuing</action>`);
  }

  if (status.todos.count > 30) {
    lines.push('    <action priority="low">Review and clean up TODOs</action>');
  }
  if (status.health === 'good' && !status.git.hasChanges && (!status.aiRules || status.aiRules.length === 0)) {
    lines.push('    <action>Project is ready for development</action>');
  }
  lines.push('  </suggestions>');

  lines.push('</project-status>');

  return lines.join('\n');
}
