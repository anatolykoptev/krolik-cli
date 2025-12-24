/**
 * @module lib/formatters
 * @description Centralized formatting utilities
 *
 * This is the SINGLE source of truth for all formatting operations.
 * All commands should import from here instead of duplicating formatters.
 *
 * @example
 * import { escapeXml, formatJson, heading, truncate } from '@/lib/@formatters';
 */

export type { JsonFormatOptions } from './json';
// JSON formatting
export {
  formatJson,
  formatJsonCompact,
  formatJsonLines,
  isValidJson,
  mergeJson,
  parseJsonSafe,
  parseJsonWithDefault,
} from './json';
export type { MarkdownSection, TableColumn, TableRow } from './markdown';
// Markdown formatting
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
  truncate as truncateMd,
} from './markdown';
// Text formatting
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
  // escapeRegex moved to @sanitize/regex - use import from '@/lib' or '@/lib/@sanitize'
} from './text';
export type { XmlAttributes, XmlElement } from './xml';
// XML formatting
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
