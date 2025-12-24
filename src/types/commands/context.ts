/**
 * @module types/commands/context
 * @description Context command result types
 */

/**
 * Checklist item from issue
 */
export interface ChecklistItem {
  text: string;
  checked: boolean;
  subtasks?: ChecklistItem[];
}

/**
 * Context command result
 */
export interface ContextResult {
  /** Task description or issue title */
  task: string;
  /** Detected domains */
  domains: string[];
  /** Related files found */
  relatedFiles: string[];
  /** Suggested implementation approach */
  approach: string[];
  /** GitHub issue if provided */
  issue?: {
    number: number;
    title: string;
    body: string;
    labels: string[];
  };
}

/**
 * Issue parsing result
 */
export interface IssueResult {
  number: number;
  title: string;
  description: string;
  checklist: ChecklistItem[];
  labels: string[];
  domains: string[];
}
