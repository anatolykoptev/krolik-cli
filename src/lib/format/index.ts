/**
 * @module lib/format
 * @description Centralized formatting utilities
 *
 * This is the SINGLE source of truth for all formatting operations.
 * All commands should import from here instead of duplicating formatters.
 *
 * Consolidates:
 * - XML formatting (escaping, building)
 * - JSON formatting (pretty-print, compact, parsing)
 * - Markdown formatting (headers, tables, lists)
 * - Text formatting (truncation, padding, case conversion)
 * - Frontmatter parsing (YAML-like frontmatter)
 *
 * @example
 * import { escapeXml, formatJson, heading, truncate, parseFrontmatter } from '@/lib/format';
 */

// ============================================================================
// XML FORMATTING
// ============================================================================

export type { XmlAttributes, XmlElement } from './xml';
export {
  buildElement,
  buildXmlDocument,
  cdata,
  escapeXml,
  selfClosingTag,
  textElement,
  unescapeXml,
  wrapXml,
  xmlComment,
} from './xml';

// ============================================================================
// JSON FORMATTING
// ============================================================================

export type { JsonFormatOptions } from './json';
export {
  formatJson,
  formatJsonCompact,
  formatJsonLines,
  isValidJson,
  mergeJson,
  parseJsonSafe,
  parseJsonWithDefault,
} from './json';

// ============================================================================
// MARKDOWN FORMATTING
// ============================================================================

export type { MarkdownSection, TableColumn, TableRow } from './markdown';
export {
  blockquote,
  bold,
  buildDocument,
  bulletList,
  codeBlock,
  heading,
  horizontalRule,
  image,
  inlineCode,
  italic,
  keyValueTable,
  link,
  numberedList,
  strikethrough,
  table,
  taskList,
} from './markdown';

// ============================================================================
// TEXT FORMATTING
// ============================================================================

export {
  alignColumns,
  center,
  dedent,
  formatCount,
  indent,
  padLeft,
  padRight,
  pluralize,
  stripAnsi,
  toCamelCase,
  toConstantCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
  truncate,
  truncateLines,
  truncateMiddle,
  wordWrap,
} from './text';

// ============================================================================
// FRONTMATTER PARSING
// ============================================================================

export type { CommonFrontmatter, FrontmatterResult } from './frontmatter';
export {
  createFrontmatter,
  getFrontmatterValue,
  hasFrontmatter,
  parseCommonFrontmatter,
  parseFrontmatter,
  stripFrontmatter,
} from './frontmatter';
