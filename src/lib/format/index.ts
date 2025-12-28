/**
 * @module lib/format
 * @description Centralized formatting utilities
 *
 * Layered architecture:
 * - Layer 0: core/ - constants, text utilities (no deps)
 * - Layer 1: xml/, json, markdown (may depend on core)
 * - Layer 2: frontmatter (may depend on text)
 *
 * @example
 * import { escapeXml, formatJson, heading, truncate, parseFrontmatter } from '@/lib/format';
 */

// ============================================================================
// LAYER 0: CORE (constants, text utilities)
// ============================================================================

// Constants and abbreviations
export {
  // Limits
  ATTRIBUTE_ABBREVIATIONS,
  // Utility functions
  abbreviatePath,
  abbreviateSeverity,
  BUDGET_DEEP_TOTAL,
  BUDGET_FULL_TOTAL,
  BUDGET_QUICK_TOTAL,
  formatInlineList,
  MAX_DIFF_LINES,
  MAX_INLINE_LIST_ITEMS,
  MAX_MEMORY_ITEMS,
  MAX_PATH_LENGTH,
  MAX_TREE_DEPTH,
  SEVERITY_ABBREVIATIONS,
  TYPE_ABBREVIATIONS,
} from './core/constants';

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
} from './core/text';

// ============================================================================
// LAYER 1: FORMAT-SPECIFIC (xml, json, markdown)
// ============================================================================

// JSON formatting
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
// Markdown formatting
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
// XML formatting
export type {
  AggressiveOptions,
  CompactOptions,
  OptimizationContext,
  OptimizationLevel,
  OptimizeOptions,
  OptimizeResult,
  XmlAttributes,
  XmlElement,
} from './xml';
export {
  buildElement,
  buildXmlDocument,
  cdata,
  escapeXml,
  minifyXmlOutput,
  optimizeXml,
  optimizeXmlAuto,
  selfClosingTag,
  textElement,
  unescapeXml,
  wrapXml,
  XMLOptimizer,
  xmlComment,
} from './xml';

// ============================================================================
// LAYER 2: PARSING (frontmatter)
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
