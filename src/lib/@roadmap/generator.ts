/**
 * @module lib/@roadmap/generator
 * @description Roadmap markdown generation from GitHub issues
 */

import { execSync } from 'node:child_process';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RoadmapConfig, RoadmapPhase } from '../../types/config';
import type { PhaseStats, RoadmapIssue, RoadmapResult, RoadmapStats } from './types';

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_OUTPUT = 'docs/ROADMAP.md';
const DEFAULT_MAX_AGE_HOURS = 24;
const DEFAULT_STATUS_PREFIX = 'status:';
const DEFAULT_AREA_PREFIX = 'area:';
const DEFAULT_PRIORITY_PREFIX = 'priority';

// ============================================================================
// GITHUB INTEGRATION
// ============================================================================

/**
 * Get repository info from git remote
 */
function getRepoInfo(projectRoot: string): { owner: string; repo: string } | null {
  try {
    const result = execSync('gh repo view --json owner,name', {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    const data = JSON.parse(result) as { owner: { login: string }; name: string };
    return { owner: data.owner.login, repo: data.name };
  } catch {
    return null;
  }
}

/**
 * Fetch issues from GitHub
 */
function fetchIssues(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all',
): RoadmapIssue[] {
  try {
    const cmd = `gh issue list --repo ${owner}/${repo} --state ${state} --limit 500 --json number,title,body,state,labels,createdAt,closedAt`;
    const result = execSync(cmd, {
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(result) as RoadmapIssue[];
  } catch {
    return [];
  }
}

// ============================================================================
// ISSUE HELPERS
// ============================================================================

function hasLabel(issue: RoadmapIssue, label: string): boolean {
  return issue.labels.some((l) => l.name === label);
}

function isOpen(issue: RoadmapIssue): boolean {
  return issue.state.toUpperCase() === 'OPEN';
}

function isClosed(issue: RoadmapIssue): boolean {
  return issue.state.toUpperCase() === 'CLOSED';
}

/**
 * Auto-detect phases from issue labels
 */
function detectPhases(issues: RoadmapIssue[]): RoadmapPhase[] {
  const phaseLabels = new Set<string>();

  for (const issue of issues) {
    for (const label of issue.labels) {
      const name = label.name.toLowerCase();
      // Match common phase patterns
      if (
        name.startsWith('phase-') ||
        name.startsWith('phase:') ||
        name.startsWith('milestone-') ||
        name.startsWith('milestone:') ||
        name.match(/^v?\d+\.\d+/) ||
        name.includes('-phase-')
      ) {
        phaseLabels.add(label.name);
      }
    }
  }

  // Sort phases naturally
  const sorted = Array.from(phaseLabels).sort((a, b) => {
    const aNum = a.match(/\d+/)?.[0] ?? '0';
    const bNum = b.match(/\d+/)?.[0] ?? '0';
    return parseInt(aNum) - parseInt(bNum);
  });

  return sorted.map((label) => ({
    label,
    title: formatPhaseTitle(label),
    emoji: getPhaseEmoji(label),
  }));
}

function formatPhaseTitle(label: string): string {
  return label
    .replace(/[-_:]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function getPhaseEmoji(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('1') || lower.includes('mvp') || lower.includes('foundation')) return '🟢';
  if (lower.includes('2')) return '🔵';
  if (lower.includes('3')) return '🟡';
  if (lower.includes('4')) return '🟠';
  if (lower.includes('ticket')) return '🎫';
  if (lower.includes('security') || lower.includes('fraud')) return '🛡️';
  return '📋';
}

// ============================================================================
// MARKDOWN GENERATION
// ============================================================================

function formatIssue(
  issue: RoadmapIssue,
  status: '✅' | '🔄' | '❌',
  repoUrl: string,
  config: RoadmapConfig,
  verbose = false,
): string {
  const areaPrefix = config.areaPrefix ?? DEFAULT_AREA_PREFIX;
  const priorityPrefix = config.priorityPrefix ?? DEFAULT_PRIORITY_PREFIX;

  const priorityLabel = issue.labels.find((l) => l.name.startsWith(priorityPrefix))?.name ?? '';
  const areaLabels = issue.labels
    .filter((l) => l.name.startsWith(areaPrefix))
    .map((l) => l.name.replace(areaPrefix, ''));

  const priority = priorityLabel ? ` \`${priorityLabel}\`` : '';
  const areas = areaLabels.length > 0 ? ` [${areaLabels.join(', ')}]` : '';

  let line = `- ${status} [#${issue.number}](${repoUrl}/issues/${issue.number}) ${issue.title}${priority}${areas}`;

  // Add description for verbose mode (first 150 chars)
  if (verbose && issue.body) {
    const desc = issue.body.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 150);
    if (desc.length > 10) {
      line += `\n  > ${desc}${issue.body.length > 150 ? '...' : ''}`;
    }
  }

  return line;
}

function generateMarkdown(
  phases: PhaseStats[],
  uncategorized: { open: RoadmapIssue[]; closed: RoadmapIssue[] },
  stats: RoadmapStats,
  repoUrl: string,
  config: RoadmapConfig,
): string {
  const now = new Date().toISOString().split('T')[0];
  const title = config.projectTitle ?? 'Project Roadmap';

  let md = `# ${title} (Auto-generated)

> **Generated:** ${now}
> **Source:** [GitHub Issues](${repoUrl}/issues)
> **Command:** \`krolik status\` with \`roadmap.auto: true\`

---

## Overall Progress

| Metric | Value |
|--------|-------|
| Total tasks | ${stats.total} |
| ✅ Done | ${stats.done} |
| 🔄 In Progress | ${stats.inProgress} |
| ❌ TODO | ${stats.todo} |
| **Progress** | **${stats.progress}%** |

---

`;

  // Per-phase breakdown
  for (const phase of phases) {
    if (phase.total === 0) continue;

    md += `## ${phase.emoji ?? '📋'} ${phase.title}

`;
    if (phase.description) {
      md += `> ${phase.description}\n`;
    }
    md += `> **Progress:** ${phase.done.length}/${phase.total} (${phase.progress}%)

`;

    if (phase.done.length > 0) {
      md += `### ✅ Done (${phase.done.length})

${phase.done.map((i) => formatIssue(i, '✅', repoUrl, config, false)).join('\n')}

`;
    }

    if (phase.inProgress.length > 0) {
      md += `### 🔄 In Progress (${phase.inProgress.length})

${phase.inProgress.map((i) => formatIssue(i, '🔄', repoUrl, config, true)).join('\n\n')}

`;
    }

    if (phase.todo.length > 0) {
      md += `### ❌ TODO (${phase.todo.length})

${phase.todo.map((i) => formatIssue(i, '❌', repoUrl, config, true)).join('\n\n')}

`;
    }

    md += `---

`;
  }

  // Uncategorized issues
  const uncategorizedTotal = uncategorized.open.length + uncategorized.closed.length;
  if (uncategorizedTotal > 0) {
    md += `## 📦 Uncategorized (${uncategorizedTotal})

> Issues without phase labels. Consider adding labels.

`;
    if (uncategorized.open.length > 0) {
      md += `### ❌ TODO (${uncategorized.open.length})

${uncategorized.open
  .slice(0, 30)
  .map((i) => formatIssue(i, '❌', repoUrl, config, true))
  .join('\n\n')}
${uncategorized.open.length > 30 ? `\n\n... and ${uncategorized.open.length - 30} more` : ''}

`;
    }

    if (uncategorized.closed.length > 0) {
      md += `### ✅ Done without phase (${uncategorized.closed.length})

${uncategorized.closed
  .slice(0, 10)
  .map((i) => formatIssue(i, '✅', repoUrl, config, false))
  .join('\n')}
${uncategorized.closed.length > 10 ? `\n... and ${uncategorized.closed.length - 10} more` : ''}

`;
    }

    md += `---

`;
  }

  md += `## Legend

- ✅ Done (closed issue or label \`status:done\`)
- 🔄 In Progress (open + label \`status:in-progress\`)
- ❌ TODO (open issue)

---

*Auto-generated from GitHub Issues by krolik*
`;

  return md;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Check if roadmap needs refresh
 */
export function needsRoadmapRefresh(projectRoot: string, config: RoadmapConfig): boolean {
  if (!config.auto) return false;

  const outputPath = join(projectRoot, config.output ?? DEFAULT_OUTPUT);
  if (!existsSync(outputPath)) return true;

  const maxAgeHours = config.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS;
  const stats = statSync(outputPath);
  const ageMs = Date.now() - stats.mtimeMs;
  const ageHours = ageMs / (1000 * 60 * 60);

  return ageHours > maxAgeHours;
}

/**
 * Generate roadmap from GitHub issues
 */
export function generateRoadmap(projectRoot: string, config: RoadmapConfig): RoadmapResult {
  const outputPath = join(projectRoot, config.output ?? DEFAULT_OUTPUT);
  const statusPrefix = config.statusPrefix ?? DEFAULT_STATUS_PREFIX;

  // Get repo info
  const repoInfo = getRepoInfo(projectRoot);
  if (!repoInfo) {
    return {
      generated: false,
      path: outputPath,
      stats: { total: 0, done: 0, inProgress: 0, todo: 0, progress: 0 },
      phases: [],
      uncategorized: { open: [], closed: [] },
      error: 'Could not determine GitHub repository. Run from a git repo with gh CLI.',
    };
  }

  const repoUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}`;

  // Fetch all issues
  const openIssues = fetchIssues(repoInfo.owner, repoInfo.repo, 'open');
  const closedIssues = fetchIssues(repoInfo.owner, repoInfo.repo, 'closed');
  const allIssues = [...openIssues, ...closedIssues];

  if (allIssues.length === 0) {
    return {
      generated: false,
      path: outputPath,
      stats: { total: 0, done: 0, inProgress: 0, todo: 0, progress: 0 },
      phases: [],
      uncategorized: { open: [], closed: [] },
      error: 'No issues found in repository.',
    };
  }

  // Get phases (from config or auto-detect)
  const phases = config.phases ?? detectPhases(allIssues);
  const phaseLabels = new Set(phases.map((p) => p.label));

  // Calculate phase stats
  const phaseStats: PhaseStats[] = phases.map((phase) => {
    const phaseIssues = allIssues.filter((i) => hasLabel(i, phase.label));

    const done = phaseIssues.filter((i) => isClosed(i) || hasLabel(i, `${statusPrefix}done`));
    const inProgress = phaseIssues.filter(
      (i) => isOpen(i) && hasLabel(i, `${statusPrefix}in-progress`),
    );
    const todo = phaseIssues.filter((i) => isOpen(i) && !hasLabel(i, `${statusPrefix}in-progress`));

    const total = done.length + inProgress.length + todo.length;
    const progress = total > 0 ? Math.round((done.length / total) * 100) : 0;

    return {
      ...phase,
      done,
      inProgress,
      todo,
      total,
      progress,
    };
  });

  // Uncategorized issues
  const uncategorized = allIssues.filter((i) => !i.labels.some((l) => phaseLabels.has(l.name)));

  const uncategorizedResult = {
    open: uncategorized.filter(isOpen),
    closed: uncategorized.filter(isClosed),
  };

  // Calculate overall stats
  const done = allIssues.filter((i) => isClosed(i) || hasLabel(i, `${statusPrefix}done`)).length;
  const inProgress = allIssues.filter(
    (i) => isOpen(i) && hasLabel(i, `${statusPrefix}in-progress`),
  ).length;
  const todo = allIssues.filter(
    (i) => isOpen(i) && !hasLabel(i, `${statusPrefix}in-progress`),
  ).length;

  const stats: RoadmapStats = {
    total: allIssues.length,
    done,
    inProgress,
    todo,
    progress: allIssues.length > 0 ? Math.round((done / allIssues.length) * 100) : 0,
  };

  // Generate markdown
  const markdown = generateMarkdown(phaseStats, uncategorizedResult, stats, repoUrl, config);

  // Write file
  try {
    // Ensure directory exists
    const dir = join(projectRoot, config.output ?? DEFAULT_OUTPUT).replace(/\/[^/]+$/, '');
    if (!existsSync(dir)) {
      const { mkdirSync } = require('node:fs');
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(outputPath, markdown, 'utf-8');

    return {
      generated: true,
      path: outputPath,
      stats,
      phases: phaseStats,
      uncategorized: uncategorizedResult,
    };
  } catch (err) {
    return {
      generated: false,
      path: outputPath,
      stats,
      phases: phaseStats,
      uncategorized: uncategorizedResult,
      error: `Failed to write roadmap: ${String(err)}`,
    };
  }
}
