/**
 * @module commands/issue/parser
 * @description GitHub issue body parsing utilities
 */

import { CODE_FILE_EXTENSIONS } from '@/lib/constants/file-patterns';

/**
 * Checklist item from issue body
 */
export interface ChecklistItem {
  text: string;
  checked: boolean;
}

/**
 * Code block extracted from issue body
 */
export interface CodeBlock {
  language: string;
  code: string;
}

/**
 * Priority level for issues
 */
export type Priority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Parsed issue data
 */
export interface ParsedIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
  url: string;
  checklist: ChecklistItem[];
  mentionedFiles: string[];
  codeBlocks: CodeBlock[];
  priority: Priority;
}

// File path patterns to detect in issue body
const FILE_PATTERNS = [
  // Explicit file paths: src/foo/bar.ts, ./components/Button.tsx
  /(?:^|\s|`)((?:\.\/|src\/|packages\/|apps\/|lib\/|components\/|hooks\/|utils\/|types\/)[a-zA-Z0-9_\-./]+\.[a-zA-Z]{1,5})(?:\s|$|`|:|\)|,)/gm,
  // Backtick quoted paths: `path/to/file.ts`
  /`([a-zA-Z0-9_\-./]+\.[a-zA-Z]{2,5})`/g,
  // File references in markdown links: [text](path/to/file.ts)
  /\]\(([a-zA-Z0-9_\-./]+\.[a-zA-Z]{2,5})\)/g,
];

// Priority label patterns
const PRIORITY_LABELS: Record<string, Priority> = {
  critical: 'critical',
  urgent: 'critical',
  'priority:critical': 'critical',
  'priority:high': 'high',
  high: 'high',
  important: 'high',
  'priority:medium': 'medium',
  medium: 'medium',
  'priority:low': 'low',
  low: 'low',
  minor: 'low',
};

// Priority keywords in body
const PRIORITY_KEYWORDS: Record<string, Priority> = {
  critical: 'critical',
  urgent: 'critical',
  asap: 'critical',
  blocker: 'critical',
  blocking: 'critical',
  'high priority': 'high',
  important: 'high',
  'low priority': 'low',
  minor: 'low',
  'nice to have': 'low',
};

/**
 * Parse checklist items from issue body
 * Extracts both checked [x] and unchecked [ ] items
 */
export function parseChecklist(body: string): ChecklistItem[] {
  if (!body) return [];

  const items: ChecklistItem[] = [];
  // Match GitHub task list format: - [ ] or - [x] or * [ ] or * [x]
  const checklistRegex = /^[\s]*[-*]\s+\[([ xX])\]\s+(.+)$/gm;

  let match: RegExpExecArray | null;
  while ((match = checklistRegex.exec(body)) !== null) {
    const checkmark = match[1];
    const text = match[2];
    if (text && checkmark) {
      items.push({
        text: text.trim(),
        checked: checkmark.toLowerCase() === 'x',
      });
    }
  }

  return items;
}

/**
 * Extract mentioned file paths from issue body
 */
export function extractMentionedFiles(body: string): string[] {
  if (!body) return [];

  const files = new Set<string>();

  for (const pattern of FILE_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body)) !== null) {
      const filePath = match[1];
      if (filePath) {
        // Validate extension
        const ext = filePath.split('.').pop()?.toLowerCase();
        if (ext && CODE_FILE_EXTENSIONS.has(ext)) {
          // Clean up path
          const cleanPath = filePath.replace(/^\.\//, '').trim();
          if (cleanPath.length > 0 && !cleanPath.startsWith('.')) {
            files.add(cleanPath);
          }
        }
      }
    }
  }

  return Array.from(files).sort();
}

/**
 * Detect priority from labels and body content
 */
export function detectPriority(labels: string[], body: string): Priority {
  // First check labels (highest confidence)
  for (const label of labels) {
    const normalizedLabel = label.toLowerCase().trim();
    const priority = PRIORITY_LABELS[normalizedLabel];
    if (priority) {
      return priority;
    }
  }

  // Check body for priority keywords
  if (body) {
    const lowerBody = body.toLowerCase();
    for (const [keyword, priority] of Object.entries(PRIORITY_KEYWORDS)) {
      if (lowerBody.includes(keyword)) {
        return priority;
      }
    }
  }

  // Default priority
  return 'medium';
}

/**
 * Extract code blocks from issue body
 */
export function extractCodeBlocks(body: string): CodeBlock[] {
  if (!body) return [];

  const blocks: CodeBlock[] = [];
  // Match fenced code blocks: ```language\ncode\n```
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;

  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(body)) !== null) {
    const language = match[1];
    const code = match[2];
    if (code !== undefined) {
      blocks.push({
        language: language || 'text',
        code: code.trim(),
      });
    }
  }

  return blocks;
}

/**
 * Parse a GitHub issue into structured data
 */
export function parseIssue(issue: {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  assignees: string[];
  url: string;
}): ParsedIssue {
  const { body, labels } = issue;

  return {
    ...issue,
    checklist: parseChecklist(body),
    mentionedFiles: extractMentionedFiles(body),
    codeBlocks: extractCodeBlocks(body),
    priority: detectPriority(labels, body),
  };
}
