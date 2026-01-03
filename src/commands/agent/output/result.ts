/**
 * @module commands/agent/output/result
 * @description Formatters for agent result output (text and AI/XML)
 */

import chalk from 'chalk';
import { escapeXml } from '../../../lib/@format';
import type { AgentResult } from '../types';

/** Get severity color based on issue severity */
function getSeverityColor(severity: string): typeof chalk {
  if (severity === 'critical') return chalk.red;
  if (severity === 'high') return chalk.yellow;
  return chalk.dim;
}

/** Format issues section for text output */
function formatIssuesText(issues: NonNullable<AgentResult['issues']>): string[] {
  const lines: string[] = [];
  lines.push(chalk.yellow(`Issues Found: ${issues.length}`));
  for (const issue of issues) {
    const severityColor = getSeverityColor(issue.severity);
    lines.push(`  ${severityColor(`[${issue.severity.toUpperCase()}]`)} ${issue.title}`);
    if (issue.file) {
      lines.push(chalk.dim(`    File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`));
    }
    lines.push(chalk.dim(`    ${issue.description}`));
  }
  lines.push('');
  return lines;
}

/** Format suggestions section for text output */
function formatSuggestionsText(suggestions: NonNullable<AgentResult['suggestions']>): string[] {
  const lines: string[] = [];
  lines.push(chalk.cyan(`Suggestions: ${suggestions.length}`));
  for (const suggestion of suggestions) {
    lines.push(`  [${suggestion.priority}] ${suggestion.title}`);
    lines.push(chalk.dim(`    ${suggestion.description}`));
    lines.push(chalk.dim(`    Effort: ${suggestion.effort}`));
  }
  lines.push('');
  return lines;
}

/** Format a single issue as XML */
function formatIssueXml(issue: NonNullable<AgentResult['issues']>[number]): string[] {
  const lines: string[] = [];
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
  return lines;
}

/** Format issues section as XML */
function formatIssuesXml(issues: NonNullable<AgentResult['issues']>): string[] {
  const lines: string[] = ['  <issues>'];
  for (const issue of issues) {
    lines.push(...formatIssueXml(issue));
  }
  lines.push('  </issues>');
  return lines;
}

/** Format suggestions section as XML */
function formatSuggestionsXml(suggestions: NonNullable<AgentResult['suggestions']>): string[] {
  const lines: string[] = ['  <suggestions>'];
  for (const suggestion of suggestions) {
    lines.push(`    <suggestion priority="${suggestion.priority}" effort="${suggestion.effort}">`);
    lines.push(`      <title>${escapeXml(suggestion.title)}</title>`);
    lines.push(`      <description>${escapeXml(suggestion.description)}</description>`);
    lines.push('    </suggestion>');
  }
  lines.push('  </suggestions>');
  return lines;
}

/** Format agent result as text */
export function formatResultText(result: AgentResult): string {
  const lines: string[] = [];
  const statusIcon = result.success ? chalk.green('\u2713') : chalk.red('\u2717');
  lines.push(`${statusIcon} Agent: ${chalk.bold(result.agent)} (${result.category})`);
  lines.push(chalk.dim(`Duration: ${result.durationMs}ms`));
  lines.push('');
  if (result.issues && result.issues.length > 0) {
    lines.push(...formatIssuesText(result.issues));
  }
  if (result.suggestions && result.suggestions.length > 0) {
    lines.push(...formatSuggestionsText(result.suggestions));
  }
  lines.push(chalk.bold('Output:'));
  lines.push(result.output);
  return lines.join('\n');
}

/** Format agent result as AI-friendly XML */
export function formatResultAI(result: AgentResult): string {
  const lines: string[] = [];
  lines.push(`<agent-result name="${result.agent}" category="${result.category}">`);
  lines.push(`  <success>${result.success}</success>`);
  lines.push(`  <duration-ms>${result.durationMs}</duration-ms>`);
  if (result.issues && result.issues.length > 0) {
    lines.push(...formatIssuesXml(result.issues));
  }
  if (result.suggestions && result.suggestions.length > 0) {
    lines.push(...formatSuggestionsXml(result.suggestions));
  }
  lines.push('  <output>');
  lines.push(escapeXml(result.output));
  lines.push('  </output>');
  lines.push('</agent-result>');
  return lines.join('\n');
}
