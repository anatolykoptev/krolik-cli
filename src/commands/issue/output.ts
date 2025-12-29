/**
 * @module commands/issue/output
 * @description Issue command output formatters
 */

import {
  bold,
  bulletList,
  codeBlock,
  escapeXml,
  heading,
  inlineCode,
  taskList,
  textElement,
  truncate,
  wrapXml,
} from '@/lib/@format';

import type { Logger } from '../../types';
import type { ParsedIssue } from './parser';

/**
 * Format issue as AI-friendly XML
 */
export function formatAI(issue: ParsedIssue): string {
  const lines: string[] = [];
  const { checklist, mentionedFiles, codeBlocks, labels } = issue;

  // Opening tag with attributes
  lines.push(
    `<issue number="${issue.number}" state="${issue.state}" priority="${issue.priority}">`,
  );

  // Title and URL
  lines.push(`  ${textElement('title', issue.title)}`);
  lines.push(`  ${textElement('url', issue.url)}`);

  // Body (truncated if too long)
  if (issue.body) {
    const truncatedBody = truncate(issue.body, 2000);
    lines.push('  <body>');
    lines.push(`    ${escapeXml(truncatedBody)}`);
    lines.push('  </body>');
  }

  // Checklist section
  if (checklist.length > 0) {
    const completed = checklist.filter((item) => item.checked).length;
    lines.push(`  <checklist completed="${completed}" total="${checklist.length}">`);
    for (const item of checklist) {
      lines.push(`    ${textElement('item', item.text, { checked: item.checked })}`);
    }
    lines.push('  </checklist>');
  }

  // Mentioned files section
  if (mentionedFiles.length > 0) {
    lines.push('  <mentioned-files>');
    for (const file of mentionedFiles) {
      lines.push(`    ${textElement('file', file)}`);
    }
    lines.push('  </mentioned-files>');
  }

  // Code blocks section
  if (codeBlocks.length > 0) {
    lines.push('  <code-blocks>');
    for (const block of codeBlocks) {
      // Truncate very long code blocks
      const truncatedCode = truncate(block.code, 500);
      lines.push(`    ${wrapXml('code', escapeXml(truncatedCode), { language: block.language })}`);
    }
    lines.push('  </code-blocks>');
  }

  // Labels section
  if (labels.length > 0) {
    lines.push('  <labels>');
    for (const label of labels) {
      lines.push(`    ${textElement('label', label)}`);
    }
    lines.push('  </labels>');
  }

  // Assignees section
  if (issue.assignees.length > 0) {
    lines.push('  <assignees>');
    for (const assignee of issue.assignees) {
      lines.push(`    ${textElement('assignee', assignee)}`);
    }
    lines.push('  </assignees>');
  }

  // Context hints for AI
  lines.push('  <hints>');
  if (checklist.length > 0) {
    const remaining = checklist.filter((item) => !item.checked).length;
    if (remaining > 0) {
      lines.push(`    ${textElement('hint', `${remaining} unchecked task(s) in checklist`)}`);
    }
  }
  if (mentionedFiles.length > 0) {
    lines.push(`    ${textElement('hint', 'Review mentioned files before starting work')}`);
  }
  if (issue.priority === 'critical' || issue.priority === 'high') {
    lines.push(`    ${textElement('hint', `This is a ${issue.priority} priority issue`)}`);
  }
  lines.push('  </hints>');

  lines.push('</issue>');

  return lines.join('\n');
}

/**
 * Format issue as JSON
 */
export function formatJson(issue: ParsedIssue): string {
  return JSON.stringify(issue, null, 2);
}

/**
 * Print issue in human-readable format
 */
export function printIssue(issue: ParsedIssue, logger: Logger): void {
  const { checklist, mentionedFiles, codeBlocks, labels } = issue;

  // Header
  logger.section(`Issue #${issue.number}`);
  logger.info(`Title: ${issue.title}`);
  logger.info(`State: ${issue.state}`);
  logger.info(`Priority: ${issue.priority}`);
  logger.info(`URL: ${issue.url}`);

  // Labels
  if (labels.length > 0) {
    logger.info(`Labels: ${labels.join(', ')}`);
  }

  // Assignees
  if (issue.assignees.length > 0) {
    logger.info(`Assignees: ${issue.assignees.join(', ')}`);
  }

  // Checklist
  if (checklist.length > 0) {
    const completed = checklist.filter((item) => item.checked).length;
    logger.section(`Checklist (${completed}/${checklist.length} completed)`);
    for (const item of checklist) {
      const mark = item.checked ? '[x]' : '[ ]';
      logger.info(`  ${mark} ${item.text}`);
    }
  }

  // Mentioned files
  if (mentionedFiles.length > 0) {
    logger.section(`Mentioned Files (${mentionedFiles.length})`);
    for (const file of mentionedFiles) {
      logger.info(`  - ${file}`);
    }
  }

  // Code blocks
  if (codeBlocks.length > 0) {
    logger.section(`Code Blocks (${codeBlocks.length})`);
    for (const [i, block] of codeBlocks.entries()) {
      logger.info(`  Block ${i + 1} (${block.language}):`);
      // Show first 3 lines only
      const previewLines = block.code.split('\n').slice(0, 3);
      for (const line of previewLines) {
        logger.info(`    ${line}`);
      }
      if (block.code.split('\n').length > 3) {
        logger.info('    ...');
      }
    }
  }

  // Body preview
  if (issue.body) {
    logger.section('Body Preview');
    logger.info(truncate(issue.body, 300));
  }
}

/**
 * Format issue as markdown
 */
export function formatMarkdown(issue: ParsedIssue): string {
  const lines: string[] = [];
  const { checklist, mentionedFiles, codeBlocks, labels } = issue;

  // Header
  lines.push(heading(`Issue #${issue.number}: ${issue.title}`, 1));
  lines.push('');
  lines.push(`${bold('State:')} ${issue.state}`);
  lines.push(`${bold('Priority:')} ${issue.priority}`);
  lines.push(`${bold('URL:')} ${issue.url}`);

  if (labels.length > 0) {
    lines.push(`${bold('Labels:')} ${labels.join(', ')}`);
  }

  if (issue.assignees.length > 0) {
    lines.push(`${bold('Assignees:')} ${issue.assignees.join(', ')}`);
  }

  lines.push('');

  // Checklist
  if (checklist.length > 0) {
    const completed = checklist.filter((item) => item.checked).length;
    lines.push(heading(`Checklist (${completed}/${checklist.length})`, 2));
    lines.push('');
    lines.push(taskList(checklist));
    lines.push('');
  }

  // Mentioned files
  if (mentionedFiles.length > 0) {
    lines.push(heading('Mentioned Files', 2));
    lines.push('');
    lines.push(bulletList(mentionedFiles.map((file) => inlineCode(file))));
    lines.push('');
  }

  // Code blocks
  if (codeBlocks.length > 0) {
    lines.push(heading('Code Blocks', 2));
    lines.push('');
    for (const [i, block] of codeBlocks.entries()) {
      lines.push(heading(`Block ${i + 1} (${block.language})`, 3));
      lines.push('');
      lines.push(codeBlock(block.code, block.language));
      lines.push('');
    }
  }

  // Body
  if (issue.body) {
    lines.push(heading('Description', 2));
    lines.push('');
    lines.push(issue.body);
  }

  return lines.join('\n');
}
