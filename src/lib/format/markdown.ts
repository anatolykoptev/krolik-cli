/**
 * @module lib/format/markdown
 * @description Markdown formatting utilities
 *
 * Provides utilities for:
 * - Section headers
 * - Tables
 * - Code blocks
 * - Lists
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TableColumn {
  header: string;
  align?: 'left' | 'center' | 'right';
  width?: number;
}

export interface TableRow {
  [key: string]: string | number | boolean | undefined;
}

export interface MarkdownSection {
  title: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  content: string | string[];
}

// ============================================================================
// HEADERS
// ============================================================================

/**
 * Create a markdown header
 *
 * @example
 * heading('Introduction', 2)
 * // Returns: '## Introduction'
 */
export function heading(text: string, level: 1 | 2 | 3 | 4 | 5 | 6 = 2): string {
  const hashes = '#'.repeat(level);
  return `${hashes} ${text}`;
}

// ============================================================================
// CODE BLOCKS
// ============================================================================

/**
 * Create a fenced code block
 *
 * @example
 * codeBlock('const x = 1;', 'typescript')
 * // Returns: '```typescript\nconst x = 1;\n```'
 */
export function codeBlock(code: string, language: string = ''): string {
  return `\`\`\`${language}\n${code}\n\`\`\``;
}

/**
 * Create inline code
 *
 * @example
 * inlineCode('console.log')
 * // Returns: '`console.log`'
 */
export function inlineCode(code: string): string {
  // Use double backticks if code contains backticks
  if (code.includes('`')) {
    return `\`\` ${code} \`\``;
  }
  return `\`${code}\``;
}

// ============================================================================
// LISTS
// ============================================================================

/**
 * Create a bullet list
 *
 * @example
 * bulletList(['Item 1', 'Item 2', 'Item 3'])
 * // Returns: '- Item 1\n- Item 2\n- Item 3'
 */
export function bulletList(items: string[], indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  return items.map((item) => `${spaces}- ${item}`).join('\n');
}

/**
 * Create a numbered list
 *
 * @example
 * numberedList(['First', 'Second', 'Third'])
 * // Returns: '1. First\n2. Second\n3. Third'
 */
export function numberedList(items: string[], startFrom: number = 1): string {
  return items.map((item, i) => `${startFrom + i}. ${item}`).join('\n');
}

/**
 * Create a task list (checkboxes)
 *
 * @example
 * taskList([{ text: 'Done', checked: true }, { text: 'Pending', checked: false }])
 * // Returns: '- [x] Done\n- [ ] Pending'
 */
export function taskList(items: Array<{ text: string; checked: boolean }>): string {
  return items.map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`).join('\n');
}

// ============================================================================
// TABLES
// ============================================================================

/**
 * Create a markdown table
 *
 * @example
 * table(
 *   [{ header: 'Name' }, { header: 'Age', align: 'right' }],
 *   [{ Name: 'John', Age: 30 }, { Name: 'Jane', Age: 25 }]
 * )
 */
export function table(columns: TableColumn[], rows: TableRow[]): string {
  if (columns.length === 0) return '';

  const headers = columns.map((col) => col.header);
  const alignments = columns.map((col) => col.align || 'left');

  // Header row
  const headerRow = `| ${headers.join(' | ')} |`;

  // Separator row with alignment
  const separatorRow = `| ${alignments
    .map((align) => {
      switch (align) {
        case 'center':
          return ':---:';
        case 'right':
          return '---:';
        default:
          return '---';
      }
    })
    .join(' | ')} |`;

  // Data rows
  const dataRows = rows.map((row) => {
    const cells = headers.map((header) => {
      const value = row[header];
      return value !== undefined ? String(value) : '';
    });
    return `| ${cells.join(' | ')} |`;
  });

  return [headerRow, separatorRow, ...dataRows].join('\n');
}

/**
 * Create a simple key-value table
 */
export function keyValueTable(data: Record<string, string | number>): string {
  const columns: TableColumn[] = [{ header: 'Key' }, { header: 'Value' }];

  const rows = Object.entries(data).map(([key, value]) => ({
    Key: key,
    Value: String(value),
  }));

  return table(columns, rows);
}

// ============================================================================
// LINKS & IMAGES
// ============================================================================

/**
 * Create a markdown link
 */
export function link(text: string, url: string, title?: string): string {
  if (title) {
    return `[${text}](${url} "${title}")`;
  }
  return `[${text}](${url})`;
}

/**
 * Create a markdown image
 */
export function image(alt: string, url: string, title?: string): string {
  if (title) {
    return `![${alt}](${url} "${title}")`;
  }
  return `![${alt}](${url})`;
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Bold text
 */
export function bold(text: string): string {
  return `**${text}**`;
}

/**
 * Italic text
 */
export function italic(text: string): string {
  return `*${text}*`;
}

/**
 * Strikethrough text
 */
export function strikethrough(text: string): string {
  return `~~${text}~~`;
}

/**
 * Create a blockquote
 */
export function blockquote(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

/**
 * Create a horizontal rule
 */
export function horizontalRule(): string {
  return '---';
}

// ============================================================================
// DOCUMENT BUILDING
// ============================================================================

/**
 * Build a markdown document from sections
 *
 * @example
 * buildDocument([
 *   { title: 'Introduction', level: 1, content: 'Welcome!' },
 *   { title: 'Features', level: 2, content: ['Fast', 'Simple'] }
 * ])
 */
export function buildDocument(sections: MarkdownSection[]): string {
  return sections
    .map((section) => {
      const header = heading(section.title, section.level || 2);
      const content = Array.isArray(section.content)
        ? section.content.join('\n\n')
        : section.content;

      return `${header}\n\n${content}`;
    })
    .join('\n\n');
}

// Note: Use truncate from './text' instead - this was removed to avoid duplication
