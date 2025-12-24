/**
 * @module commands/agent/output
 * @description Output formatters for agent command
 */

import chalk from 'chalk';
import { escapeXml, truncate } from '../../lib';
import { AGENT_CATEGORIES } from './categories';
import type { AgentCategory, AgentDefinition, AgentResult, RepoStats } from './types';

/**
 * Format agent list as text
 */
export function formatAgentListText(
  agents: AgentDefinition[],
  _counts: Record<AgentCategory, number>,
  stats?: RepoStats,
): string {
  const lines: string[] = [];

  lines.push(chalk.bold('Claude Code Plugins (wshobson/agents)\n'));

  // Show repository stats if available
  if (stats) {
    lines.push(chalk.dim('Repository:'));
    lines.push(
      chalk.dim(
        `  ${stats.plugins} plugins | ${stats.agents} agents | ${stats.commands} commands | ${stats.skills} skills`,
      ),
    );
    lines.push('');
  }

  lines.push(chalk.bold('Available Agents:\n'));

  // Group by category
  const byCategory = new Map<AgentCategory, AgentDefinition[]>();
  for (const agent of agents) {
    const list = byCategory.get(agent.category) || [];
    list.push(agent);
    byCategory.set(agent.category, list);
  }

  // Print each category
  for (const [category, info] of Object.entries(AGENT_CATEGORIES)) {
    const categoryAgents = byCategory.get(category as AgentCategory) || [];
    if (categoryAgents.length === 0) continue;

    lines.push(
      chalk.cyan(`\n${info.label}`) +
        chalk.dim(` (${categoryAgents.length} agents) - ${info.description}`),
    );
    lines.push(chalk.dim(`  Aliases: ${info.aliases.join(', ') || 'none'}`));
    lines.push('');

    for (const agent of categoryAgents) {
      const modelBadge = agent.model ? chalk.dim(` [${agent.model}]`) : '';
      lines.push(`  ${chalk.green(agent.name)}${modelBadge}`);
      lines.push(chalk.dim(`    ${truncate(agent.description, 80)}`));
    }
  }

  // Summary
  lines.push('');
  lines.push(chalk.dim(`Total: ${agents.length} agents in ${byCategory.size} categories`));
  lines.push('');
  lines.push(chalk.dim('Usage: krolik agent <name> [--file <path>] [--feature <name>]'));

  return lines.join('\n');
}

/**
 * Format agent list as AI-friendly XML
 */
export function formatAgentListAI(
  agents: AgentDefinition[],
  counts: Record<AgentCategory, number>,
  stats?: RepoStats,
): string {
  const lines: string[] = [];

  lines.push('<claude-code-plugins source="wshobson/agents">');

  // Repository stats
  if (stats) {
    lines.push('  <stats>');
    lines.push(`    <plugins>${stats.plugins}</plugins>`);
    lines.push(`    <agents>${stats.agents}</agents>`);
    lines.push(`    <commands>${stats.commands}</commands>`);
    lines.push(`    <skills>${stats.skills}</skills>`);
    lines.push('  </stats>');
    lines.push('');
  }

  lines.push(`  <agents total="${agents.length}">`);

  // Categories summary
  lines.push('    <categories>');
  for (const [category, info] of Object.entries(AGENT_CATEGORIES)) {
    const count = counts[category as AgentCategory] || 0;
    if (count === 0) continue;

    lines.push(`      <category name="${category}" count="${count}">`);
    lines.push(`        <label>${info.label}</label>`);
    lines.push(`        <description>${info.description}</description>`);
    lines.push(`        <aliases>${info.aliases.join(', ')}</aliases>`);
    lines.push(`        <command>krolik agent ${category}</command>`);
    lines.push('      </category>');
  }
  lines.push('    </categories>');
  lines.push('');

  // All agents
  lines.push('    <list>');
  for (const agent of agents) {
    lines.push(`      <agent name="${agent.name}" category="${agent.category}">`);
    lines.push(`        <description>${escapeXml(agent.description)}</description>`);
    if (agent.model) {
      lines.push(`        <model>${agent.model}</model>`);
    }
    lines.push(`        <plugin>${agent.plugin}</plugin>`);
    lines.push('      </agent>');
  }
  lines.push('    </list>');
  lines.push('  </agents>');

  lines.push('</claude-code-plugins>');

  return lines.join('\n');
}

/**
 * Format agent result as text
 */
export function formatResultText(result: AgentResult): string {
  const lines: string[] = [];

  const statusIcon = result.success ? chalk.green('✓') : chalk.red('✗');
  lines.push(`${statusIcon} Agent: ${chalk.bold(result.agent)} (${result.category})`);
  lines.push(chalk.dim(`Duration: ${result.durationMs}ms`));
  lines.push('');

  if (result.issues && result.issues.length > 0) {
    lines.push(chalk.yellow(`Issues Found: ${result.issues.length}`));
    for (const issue of result.issues) {
      const severityColor =
        issue.severity === 'critical'
          ? chalk.red
          : issue.severity === 'high'
            ? chalk.yellow
            : chalk.dim;
      lines.push(`  ${severityColor(`[${issue.severity.toUpperCase()}]`)} ${issue.title}`);
      if (issue.file) {
        lines.push(chalk.dim(`    File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`));
      }
      lines.push(chalk.dim(`    ${issue.description}`));
    }
    lines.push('');
  }

  if (result.suggestions && result.suggestions.length > 0) {
    lines.push(chalk.cyan(`Suggestions: ${result.suggestions.length}`));
    for (const suggestion of result.suggestions) {
      lines.push(`  [${suggestion.priority}] ${suggestion.title}`);
      lines.push(chalk.dim(`    ${suggestion.description}`));
      lines.push(chalk.dim(`    Effort: ${suggestion.effort}`));
    }
    lines.push('');
  }

  lines.push(chalk.bold('Output:'));
  lines.push(result.output);

  return lines.join('\n');
}

/**
 * Format agent result as AI-friendly XML
 */
export function formatResultAI(result: AgentResult): string {
  const lines: string[] = [];

  lines.push(`<agent-result name="${result.agent}" category="${result.category}">`);
  lines.push(`  <success>${result.success}</success>`);
  lines.push(`  <duration-ms>${result.durationMs}</duration-ms>`);

  if (result.issues && result.issues.length > 0) {
    lines.push('  <issues>');
    for (const issue of result.issues) {
      lines.push(`    <issue severity="${issue.severity}">`);
      lines.push(`      <title>${escapeXml(issue.title)}</title>`);
      lines.push(`      <description>${escapeXml(issue.description)}</description>`);
      if (issue.file) {
        lines.push(`      <file>${issue.file}</file>`);
        if (issue.line) {
          lines.push(`      <line>${issue.line}</line>`);
        }
      }
      if (issue.fix) {
        lines.push(`      <fix>${escapeXml(issue.fix)}</fix>`);
      }
      lines.push('    </issue>');
    }
    lines.push('  </issues>');
  }

  if (result.suggestions && result.suggestions.length > 0) {
    lines.push('  <suggestions>');
    for (const suggestion of result.suggestions) {
      lines.push(
        `    <suggestion priority="${suggestion.priority}" effort="${suggestion.effort}">`,
      );
      lines.push(`      <title>${escapeXml(suggestion.title)}</title>`);
      lines.push(`      <description>${escapeXml(suggestion.description)}</description>`);
      lines.push('    </suggestion>');
    }
    lines.push('  </suggestions>');
  }

  lines.push('  <output>');
  lines.push(escapeXml(result.output));
  lines.push('  </output>');

  lines.push('</agent-result>');

  return lines.join('\n');
}
