/**
 * @module commands/agent/output/list
 * @description Formatters for agent list output (text and AI/XML)
 */

import chalk from 'chalk';
import { escapeXml, truncate } from '../../../lib/@format';
import { AGENT_CATEGORIES } from '../categories';
import type { AgentCategory, AgentDefinition, RepoStats } from '../types';
import { groupAgentsByCategory } from './index';

/** Format repository stats section for text output */
function formatStatsText(stats: RepoStats): string[] {
  return [
    chalk.dim('Repository:'),
    chalk.dim(
      `  ${stats.plugins} plugins | ${stats.agents} agents | ${stats.commands} commands | ${stats.skills} skills`,
    ),
    '',
  ];
}

/** Format a single category section for text output */
function formatCategoryText(category: AgentCategory, categoryAgents: AgentDefinition[]): string[] {
  const info = AGENT_CATEGORIES[category];
  const lines: string[] = [];
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
  return lines;
}

/** Format repository stats section for XML output */
function formatStatsXml(stats: RepoStats): string[] {
  return [
    '  <stats>',
    `    <plugins>${stats.plugins}</plugins>`,
    `    <agents>${stats.agents}</agents>`,
    `    <commands>${stats.commands}</commands>`,
    `    <skills>${stats.skills}</skills>`,
    '  </stats>',
    '',
  ];
}

/** Format categories summary for XML output */
function formatCategoriesXml(counts: Record<AgentCategory, number>): string[] {
  const lines: string[] = ['    <categories>'];
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
  return lines;
}

/** Format agents list for XML output */
function formatAgentsListXml(agents: AgentDefinition[]): string[] {
  const lines: string[] = ['    <list>'];
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
  return lines;
}

/** Format agent list as text */
export function formatAgentListText(
  agents: AgentDefinition[],
  _counts: Record<AgentCategory, number>,
  stats?: RepoStats,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold('Claude Code Plugins (wshobson/agents)\n'));
  if (stats) {
    lines.push(...formatStatsText(stats));
  }
  lines.push(chalk.bold('Available Agents:\n'));
  const byCategory = groupAgentsByCategory(agents);
  for (const [category, _info] of Object.entries(AGENT_CATEGORIES)) {
    const categoryAgents = byCategory.get(category as AgentCategory) || [];
    if (categoryAgents.length === 0) continue;
    lines.push(...formatCategoryText(category as AgentCategory, categoryAgents));
  }
  lines.push('');
  lines.push(chalk.dim(`Total: ${agents.length} agents in ${byCategory.size} categories`));
  lines.push('');
  lines.push(chalk.dim('Usage: krolik agent <name> [--file <path>] [--feature <name>]'));
  return lines.join('\n');
}

/** Format agent list as AI-friendly XML */
export function formatAgentListAI(
  agents: AgentDefinition[],
  counts: Record<AgentCategory, number>,
  stats?: RepoStats,
): string {
  const lines: string[] = [];
  lines.push('<claude-code-plugins source="wshobson/agents">');
  if (stats) {
    lines.push(...formatStatsXml(stats));
  }
  lines.push(`  <agents total="${agents.length}">`);
  lines.push(...formatCategoriesXml(counts));
  lines.push('');
  lines.push(...formatAgentsListXml(agents));
  lines.push('  </agents>');
  lines.push('</claude-code-plugins>');
  return lines.join('\n');
}
