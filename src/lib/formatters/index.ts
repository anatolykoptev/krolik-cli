/**
 * @module lib/formatters
 * @description Centralized formatting utilities
 *
 * This is the SINGLE source of truth for all formatting operations.
 * All commands should import from here instead of duplicating formatters.
 *
 * @example
 * import { escapeXml, formatJson, heading, truncate } from '@/lib/formatters';
 */

// XML formatting
export {
  escapeXml,
  unescapeXml,
  wrapXml,
  selfClosingTag,
  buildElement,
  buildXmlDocument,
  textElement,
  cdata,
  xmlComment,
} from './xml';
export type { XmlAttributes, XmlElement } from './xml';

// JSON formatting
export {
  formatJson,
  formatJsonCompact,
  formatJsonLines,
  parseJsonSafe,
  parseJsonWithDefault,
  isValidJson,
  mergeJson,
} from './json';
export type { JsonFormatOptions } from './json';

// Markdown formatting
export {
  heading,
  codeBlock,
  inlineCode,
  bulletList,
  numberedList,
  taskList,
  table,
  keyValueTable,
  link,
  image,
  bold,
  italic,
  strikethrough,
  blockquote,
  horizontalRule,
  buildDocument,
  truncate as truncateMd,
} from './markdown';
export type { TableColumn, TableRow, MarkdownSection } from './markdown';

// Text formatting
export {
  truncate,
  truncateMiddle,
  truncateLines,
  padLeft,
  padRight,
  center,
  alignColumns,
  toCamelCase,
  toPascalCase,
  toKebabCase,
  toSnakeCase,
  toConstantCase,
  pluralize,
  formatCount,
  indent,
  dedent,
  wordWrap,
  stripAnsi,
  escapeRegex,
} from './text';
