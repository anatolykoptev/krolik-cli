/**
 * Issue Analyzer - Parse GitHub issue for PRD generation
 *
 * @module commands/prd/generators/issue-analyzer
 */

import type { GitHubIssue } from '@/lib/@vcs/github';
import { PRIORITY_LABELS, TAG_LABELS } from '../constants';
import type { ChecklistItem, ParsedIssue, TaskPriority } from '../types';

/**
 * Analyze GitHub issue and extract structured data
 */
export function analyzeIssue(issue: GitHubIssue): ParsedIssue {
  const checklists = extractChecklists(issue.body);
  const mentionedFiles = extractMentionedFiles(issue.body);
  const inferredPriority = inferPriority(issue.labels);
  const tags = extractTags(issue.labels);

  return {
    number: issue.number,
    title: issue.title,
    body: issue.body,
    labels: issue.labels,
    checklists,
    mentionedFiles,
    inferredPriority,
    tags,
  };
}

/**
 * Extract checklists from issue body
 * Matches: - [ ] item or - [x] item
 */
function extractChecklists(body: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const regex = /^[-*]\s*\[([ xX])\]\s*(.+)$/gm;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    const checked = match[1]?.toLowerCase() === 'x';
    const text = match[2]?.trim() ?? '';
    if (text) {
      items.push({ text, checked });
    }
  }

  return items;
}

/**
 * Extract file paths mentioned in issue body
 * Matches patterns like: src/file.ts, ./path/to/file, etc.
 */
function extractMentionedFiles(body: string): string[] {
  const files = new Set<string>();

  // Match backtick-wrapped paths
  const backtickPattern = /`([^`]+\.(ts|tsx|js|jsx|json|md|css|scss))`/g;
  let match: RegExpExecArray | null;
  while ((match = backtickPattern.exec(body)) !== null) {
    if (match[1]) files.add(match[1]);
  }

  // Match src/ paths
  const srcPattern = /\b(src\/[^\s,)]+)/g;
  while ((match = srcPattern.exec(body)) !== null) {
    if (match[1]) files.add(match[1]);
  }

  // Match relative paths ./
  const relativePattern = /\b(\.\/[^\s,)]+\.(ts|tsx|js|jsx))/g;
  while ((match = relativePattern.exec(body)) !== null) {
    if (match[1]) files.add(match[1]);
  }

  return [...files];
}

/**
 * Infer priority from GitHub labels
 */
function inferPriority(labels: string[]): TaskPriority {
  for (const label of labels) {
    const normalized = label.toLowerCase();
    if (normalized in PRIORITY_LABELS) {
      return PRIORITY_LABELS[normalized] ?? 'medium';
    }
  }
  return 'medium';
}

/**
 * Extract relevant tags from GitHub labels
 */
function extractTags(labels: string[]): string[] {
  const tags: string[] = [];

  for (const label of labels) {
    const normalized = label.toLowerCase();
    if (normalized in TAG_LABELS) {
      const tag = TAG_LABELS[normalized];
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    }
  }

  return tags;
}

/**
 * Format issue for AI prompt
 */
export function formatIssueForPrompt(parsed: ParsedIssue): string {
  const lines: string[] = [];

  lines.push(`# Issue #${parsed.number}: ${parsed.title}`);
  lines.push('');
  lines.push('## Description');
  lines.push(parsed.body);
  lines.push('');

  if (parsed.checklists.length > 0) {
    lines.push('## Checklist Items');
    for (const item of parsed.checklists) {
      lines.push(`- [${item.checked ? 'x' : ' '}] ${item.text}`);
    }
    lines.push('');
  }

  if (parsed.mentionedFiles.length > 0) {
    lines.push('## Mentioned Files');
    for (const file of parsed.mentionedFiles) {
      lines.push(`- ${file}`);
    }
    lines.push('');
  }

  if (parsed.tags.length > 0) {
    lines.push(`## Tags: ${parsed.tags.join(', ')}`);
  }

  lines.push(`## Priority: ${parsed.inferredPriority}`);

  return lines.join('\n');
}
