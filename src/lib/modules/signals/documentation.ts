/**
 * @module lib/modules/signals/documentation
 * @description JSDoc/documentation analysis for reusable code detection
 *
 * Extracts metadata from documentation to assess reusability intent.
 */

import * as fs from 'node:fs';
import { type DocumentationSignals, REUSABILITY_KEYWORDS } from '../types';

// ============================================================================
// SCORING CONSTANTS
// ============================================================================

const SCORES = {
  /** Score for @module JSDoc */
  HAS_MODULE_DOC: 15,
  /** Score for @example blocks */
  HAS_EXAMPLES: 10,
  /** Score for @public or @api tags */
  HAS_PUBLIC_API: 10,
  /** Score for mentioning reusability */
  MENTIONS_REUSABLE: 5,
  /** Score for @see references */
  HAS_SEE_ALSO: 3,
  /** Score for having any docs */
  HAS_ANY_DOCS: 5,
};

// ============================================================================
// JSDOC PATTERNS
// ============================================================================

/**
 * Match JSDoc comment blocks
 */
const JSDOC_PATTERN = /\/\*\*[\s\S]*?\*\//g;

/**
 * Match @module tag
 */
const MODULE_TAG_PATTERN = /@module\s+\S+/;

/**
 * Match @example tag and content
 */
const EXAMPLE_TAG_PATTERN = /@example[\s\S]*?(?=\n\s*\*\s*@|\n\s*\*\/)/;

/**
 * Match @public or @api tags
 */
const PUBLIC_API_PATTERN = /@(public|api)\b/;

/**
 * Match @see tag
 */
const SEE_TAG_PATTERN = /@see\s+\S+/;

/**
 * Match @description tag
 */
const DESCRIPTION_TAG_PATTERN = /@description\s+[\s\S]*?(?=\n\s*\*\s*@|\n\s*\*\/)/;

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Check if content contains reusability keywords
 */
function mentionsReusability(content: string): boolean {
  const lowerContent = content.toLowerCase();

  for (const keyword of REUSABILITY_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Extract all JSDoc comments from content
 */
function extractJsDocComments(content: string): string[] {
  const matches = content.match(JSDOC_PATTERN);
  return matches ?? [];
}

/**
 * Check if content has any JSDoc comments
 */
function hasAnyJsDoc(content: string): boolean {
  return JSDOC_PATTERN.test(content);
}

/**
 * Check if content has @module tag
 */
function hasModuleTag(content: string): boolean {
  return MODULE_TAG_PATTERN.test(content);
}

/**
 * Check if content has @example tags
 */
function hasExampleTag(content: string): boolean {
  return EXAMPLE_TAG_PATTERN.test(content);
}

/**
 * Check if content has @public or @api tags
 */
function hasPublicApiTag(content: string): boolean {
  return PUBLIC_API_PATTERN.test(content);
}

/**
 * Check if content has @see tags
 */
function hasSeeTag(content: string): boolean {
  return SEE_TAG_PATTERN.test(content);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyze documentation signals for a file
 *
 * @param filePath - Path to the file
 * @param content - Optional file content (reads from disk if not provided)
 * @returns Documentation signals with score
 *
 * @example
 * ```ts
 * const signals = analyzeDocumentationSignals('/path/to/utils.ts');
 * // { hasModuleDoc: true, hasExamples: true, score: 25, ... }
 * ```
 */
export function analyzeDocumentationSignals(
  filePath: string,
  content?: string,
): DocumentationSignals {
  let fileContent: string;

  try {
    fileContent = content ?? fs.readFileSync(filePath, 'utf-8');
  } catch {
    return {
      hasModuleDoc: false,
      hasExamples: false,
      hasPublicApi: false,
      mentionsReusable: false,
      hasSeeAlso: false,
      hasAnyDocs: false,
      score: 0,
    };
  }

  // Extract all JSDoc comments for analysis
  const jsDocComments = extractJsDocComments(fileContent);
  const allJsDoc = jsDocComments.join('\n');

  // Check for various documentation patterns
  const hasModuleDoc = hasModuleTag(allJsDoc);
  const hasExamples = hasExampleTag(allJsDoc);
  const hasPublicApi = hasPublicApiTag(allJsDoc);
  const hasSeeAlso = hasSeeTag(allJsDoc);
  const reusabilityMentioned = mentionsReusability(allJsDoc);
  const hasAnyDocs = hasAnyJsDoc(fileContent);

  // Calculate score
  let score = 0;

  if (hasModuleDoc) {
    score += SCORES.HAS_MODULE_DOC;
  }
  if (hasExamples) {
    score += SCORES.HAS_EXAMPLES;
  }
  if (hasPublicApi) {
    score += SCORES.HAS_PUBLIC_API;
  }
  if (reusabilityMentioned) {
    score += SCORES.MENTIONS_REUSABLE;
  }
  if (hasSeeAlso) {
    score += SCORES.HAS_SEE_ALSO;
  }
  if (hasAnyDocs && !hasModuleDoc) {
    score += SCORES.HAS_ANY_DOCS;
  }

  return {
    hasModuleDoc,
    hasExamples,
    hasPublicApi,
    mentionsReusable: reusabilityMentioned,
    hasSeeAlso,
    hasAnyDocs,
    score,
  };
}

/**
 * Extract module description from JSDoc
 *
 * @param filePath - Path to the file
 * @param content - Optional file content
 * @returns Module description or undefined
 */
export function extractModuleDescription(filePath: string, content?: string): string | undefined {
  let fileContent: string;

  try {
    fileContent = content ?? fs.readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }

  // Find first JSDoc block
  const jsDocMatch = fileContent.match(JSDOC_PATTERN);
  if (!jsDocMatch) return undefined;

  const firstJsDoc = jsDocMatch[0];

  // Try to extract @description
  const descMatch = firstJsDoc.match(DESCRIPTION_TAG_PATTERN);
  if (descMatch) {
    return descMatch[0]
      .replace(/@description\s*/, '')
      .replace(/\n\s*\*\s*/g, ' ')
      .trim();
  }

  // Fall back to first line after /**
  const lines = firstJsDoc.split('\n');
  for (const line of lines.slice(1)) {
    const cleanLine = line.replace(/^\s*\*\s*/, '').trim();
    if (cleanLine && !cleanLine.startsWith('@')) {
      return cleanLine;
    }
  }

  return undefined;
}

/**
 * Count code examples in a file
 *
 * @param content - File content
 * @returns Number of @example blocks
 */
export function countExamples(content: string): number {
  const matches = content.match(/@example/g);
  return matches?.length ?? 0;
}

/**
 * Check if file has API documentation (beyond just type signatures)
 *
 * @param content - File content
 * @returns True if file has substantial documentation
 */
export function hasSubstantialDocumentation(content: string): boolean {
  const jsDocComments = extractJsDocComments(content);

  // Need at least one JSDoc comment with substantial content
  for (const comment of jsDocComments) {
    // Strip comment markers and tags
    const textContent = comment
      .replace(/\/\*\*|\*\//g, '')
      .replace(/^\s*\*\s*/gm, '')
      .replace(/@\w+[^\n]*/g, '')
      .trim();

    // At least 50 characters of actual documentation
    if (textContent.length >= 50) {
      return true;
    }
  }

  return false;
}
