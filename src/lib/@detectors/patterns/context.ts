/**
 * @module lib/@detectors/patterns/context
 * @description Context detection patterns for code analysis
 *
 * Combines:
 * - TS directive detection (@ts-expect-error, @ts-nocheck, @ts-expect-error)
 * - Verb detection for function name analysis
 *
 * For TS directives: checkTsDirectives(), checkTsIgnore(), checkTsNoCheck()
 * For verb detection: extractVerbPrefix(), isVerbLike(), groupByVerbPrefix()
 */

import { isInsideComment } from '@/lib/@ast/swc';
import { createTsDirectiveIssue, type QualityIssue, type TsDirectiveType } from './issue-factory';

// ============================================================================
// TS DIRECTIVE CONSTANTS
// ============================================================================

/** Maximum snippet length for issue display */
const MAX_SNIPPET_LENGTH = 80;

/**
 * Directive detection pattern
 */
interface DirectivePattern {
  /** Regex pattern to match */
  pattern: RegExp;
  /** Type of directive */
  type: TsDirectiveType;
  /** Whether to check for explanation (for ts-expect-error) */
  requiresExplanation?: boolean;
}

/**
 * Patterns for detecting TS directives
 */
const DIRECTIVE_PATTERNS: DirectivePattern[] = [
  {
    pattern: /@ts-ignore/,
    type: 'ts-ignore',
  },
  {
    pattern: /@ts-nocheck/,
    type: 'ts-nocheck',
  },
  {
    pattern: /@ts-expect-error(?!\s+—)/,
    type: 'ts-expect-error',
    requiresExplanation: true,
  },
];

// ============================================================================
// VERB DETECTION CONSTANTS
// ============================================================================

/**
 * Common English verb endings (morphological patterns)
 */
const VERB_ENDINGS = [
  'ate', // create, validate, generate, update
  'ify', // notify, verify, modify, stringify
  'ize', // initialize, serialize, normalize, optimize
  'ise', // (British spelling variants)
  'en', // open, widen, listen, flatten
  'fy', // notify (short form)
] as const;

/**
 * Common verb stem patterns (2-6 characters)
 */
const VERB_STEM_PATTERNS = [
  // CVC pattern (consonant-vowel-consonant) - very common for short verbs
  /^[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz]$/i,
  // CVCC pattern - get, send, find, load, save, etc.
  /^[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz]{2}$/i,
  // CCVC pattern - skip, drop, stop, grab
  /^[bcdfghjklmnpqrstvwxyz]{2}[aeiou][bcdfghjklmnpqrstvwxyz]$/i,
] as const;

/**
 * Vowel ratio bounds for English verbs
 */
const VOWEL_RATIO_BOUNDS = {
  MIN: 0.2,
  MAX: 0.6,
} as const;

/**
 * Length bounds for verb prefixes
 */
const VERB_LENGTH_BOUNDS = {
  MIN: 2,
  MAX: 10,
} as const;

/**
 * Common imperative verb patterns that start function names
 */
const IMPERATIVE_PATTERNS = [
  /^(get|set|put|let|do|go|be|add|try|run|ask|say|see|use)$/i,
  /^(make|take|give|find|keep|call|show|move|pull|push|pick|drop|send|read|load|save|open|hide|sort|test|stop|swap)$/i,
  /^(fetch|build|check|clear|clone|close|count|debug|empty|enter|flush|force|grant|guard|merge|mount|parse|patch|pause|print|query|queue|raise|reset|route|scale|serve|setup|start|store|throw|trace|track|unset|watch|write|yield)$/i,
  /^(attach|bounce|change|commit|create|decode|delete|deploy|detect|enable|encode|ensure|escape|expand|export|extend|filter|finish|format|handle|import|inject|insert|invoke|launch|listen|manage|modify|notify|obtain|output|prefer|reduce|reject|reload|remove|render|report|return|revert|revoke|scroll|search|select|submit|toggle|unfold|unlock|update|upload|upsert)$/i,
  /^(analyze|arrange|capture|collect|compile|compose|compute|connect|consume|convert|declare|default|destroy|disable|display|dispose|divider|execute|extract|flatten|forward|fulfill|hydrate|include|inherit|inspect|install|isolate|iterate|marshal|measure|migrate|monitor|perform|persist|prepare|prevent|process|produce|project|promote|protect|provide|publish|receive|recover|recycle|refresh|release|request|require|resolve|respond|restore|retrieve|reverse|scatter|suspend|trigger|unblock|unmount|unwatch|upgrade|upsertv)$/i,
  /^(activate|allocate|annotate|assemble|authorize|broadcast|calculate|calibrate|challenge|configure|construct|construct|correlate|customize|decrement|decompose|decrement|dehydrate|deprecate|determine|duplicate|eliminate|emphasize|establish|evalnuate|fabricate|facilitate|formalize|generator|highlight|implement|increment|indicate|influence|initiate|intercept|interpret|introduce|normalize|operation|originate|overwrite|partition|propagate|reconcile|reconnect|reinforce|reinstate|renegiate|replicate|reprocess|reschedule|serialize|stimulate|subdivide|subscribe|supersede|synchron|terminate|transcribe|transform|translate|transmit|transpose|uncompress|underscore|unsubscribe|uppercase|validation)$/i,
] as const;

// ============================================================================
// TS DIRECTIVE HELPERS
// ============================================================================

/**
 * Check if the directive is a real TS directive (not just mentioned in JSDoc)
 *
 * Real directives appear immediately after comment start:
 * - // @ts-expect-error    ✓ real directive
 * - /* @ts-nocheck * / ✓ real directive
 * - // @ts-expect-error: reason ✓ real directive with explanation
 * - * - @ts-nocheck comments ✗ JSDoc description
 * - // This fixes @ts-expect-error ✗ not at start
 */
function isRealTsDirective(line: string, matchIndex: number): boolean {
  const beforeMatch = line.slice(0, matchIndex);

  // Check for line comment directive: // @ts-*
  const lineCommentMatch = beforeMatch.match(/\/\/\s*$/);
  if (lineCommentMatch) {
    return true;
  }

  // Check for block comment directive at start: /* @ts-* or /** @ts-*
  // The @ts-* should be at the very start of the comment content
  const blockCommentMatch = beforeMatch.match(/\/\*+\s*$/);
  if (blockCommentMatch) {
    return true;
  }

  // Not a real directive - it's mentioned in the middle of a comment
  return false;
}

/**
 * Create snippet from line, truncating if necessary
 */
function createSnippet(line: string): string {
  const trimmed = line.trim();
  return trimmed.length > MAX_SNIPPET_LENGTH ? trimmed.slice(0, MAX_SNIPPET_LENGTH) : trimmed;
}

// ============================================================================
// TS DIRECTIVE API
// ============================================================================

/**
 * Check for @ts-expect-error, @ts-nocheck, and @ts-expect-error in comments
 *
 * Uses AST-based comment detection to avoid false positives in:
 * - String literals: "@ts-expect-error"
 * - Regex patterns: /@ts-expect-error/
 * - Code: pattern = '@ts-expect-error'
 *
 * Only reports directives that are INSIDE actual comments.
 */
export function checkTsDirectives(content: string, filepath: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');
  let charOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineStartOffset = charOffset;

    for (const { pattern, type } of DIRECTIVE_PATTERNS) {
      const match = pattern.exec(line);
      if (!match) {
        continue;
      }

      // Calculate absolute offset in the full content
      const absoluteOffset = lineStartOffset + match.index;

      // Only report if the directive is inside a comment
      // This filters out regex literals like /@ts-expect-error/ and strings
      if (!isInsideComment(content, absoluteOffset)) {
        continue;
      }

      // Only report if it's a real directive (not just mentioned in JSDoc)
      // Real: // @ts-expect-error, /* @ts-nocheck */
      // Not real: * - @ts-nocheck comments (removes)
      if (!isRealTsDirective(line, match.index)) {
        continue;
      }

      const snippet = createSnippet(line);
      const issue = createTsDirectiveIssue(type, i + 1, snippet, filepath);
      issues.push(issue);
    }

    // Move to next line (+1 for newline character)
    charOffset = lineStartOffset + line.length + 1;
  }

  return issues;
}

/**
 * Check for @ts-expect-error directives only
 */
export function checkTsIgnore(content: string, filepath: string): QualityIssue[] {
  return checkTsDirectives(content, filepath).filter((issue) =>
    issue.message.includes('@ts-ignore'),
  );
}

/**
 * Check for @ts-nocheck directives only
 */
export function checkTsNoCheck(content: string, filepath: string): QualityIssue[] {
  return checkTsDirectives(content, filepath).filter((issue) =>
    issue.message.includes('@ts-nocheck'),
  );
}

/**
 * Count total TS directive issues in a file
 */
export function countTsDirectives(content: string): number {
  let count = 0;
  const lines = content.split('\n');
  let charOffset = 0;

  for (const line of lines) {
    const lineStartOffset = charOffset;

    for (const { pattern } of DIRECTIVE_PATTERNS) {
      const match = pattern.exec(line);
      if (match) {
        const absoluteOffset = lineStartOffset + match.index;
        // Must be inside a comment AND be a real directive
        if (isInsideComment(content, absoluteOffset) && isRealTsDirective(line, match.index)) {
          count++;
        }
      }
    }

    charOffset = lineStartOffset + line.length + 1;
  }

  return count;
}

// ============================================================================
// VERB DETECTION HELPERS
// ============================================================================

/**
 * Calculate vowel ratio in a string
 */
function getVowelRatio(str: string): number {
  if (str.length === 0) return 0;
  const vowels = str.match(/[aeiou]/gi);
  return vowels ? vowels.length / str.length : 0;
}

/**
 * Check if a word has typical English phonotactic structure
 */
function hasValidPhonology(word: string): boolean {
  const lower = word.toLowerCase();

  if (/^[bcdfghjklmnpqrstvwxyz]{4,}/.test(lower)) return false;
  if (/[aeiou]{4,}/.test(lower)) return false;
  if (!/[aeiouy]/i.test(lower)) return false;

  return true;
}

/**
 * Check if a word matches verb morphological patterns
 */
function matchesVerbMorphology(word: string): boolean {
  const lower = word.toLowerCase();

  for (const ending of VERB_ENDINGS) {
    if (lower.endsWith(ending) && lower.length > ending.length + 2) {
      return true;
    }
  }

  if (word.length <= 4) {
    for (const pattern of VERB_STEM_PATTERNS) {
      if (pattern.test(lower)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Split camelCase or PascalCase into segments
 */
function splitCamelCase(name: string): string[] {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .split('_')
    .filter((s) => s.length > 0);
}

// ============================================================================
// VERB DETECTION API
// ============================================================================

/**
 * Check if a word is likely a verb using linguistic heuristics
 */
export function isVerbLike(word: string): boolean {
  if (!word || typeof word !== 'string') return false;

  const lower = word.toLowerCase();

  if (lower.length < VERB_LENGTH_BOUNDS.MIN || lower.length > VERB_LENGTH_BOUNDS.MAX) {
    return false;
  }

  if (!hasValidPhonology(lower)) {
    return false;
  }

  const vowelRatio = getVowelRatio(lower);
  if (vowelRatio < VOWEL_RATIO_BOUNDS.MIN || vowelRatio > VOWEL_RATIO_BOUNDS.MAX) {
    if (lower.length > 3) {
      return false;
    }
  }

  if (matchesVerbMorphology(lower)) {
    return true;
  }

  for (const pattern of IMPERATIVE_PATTERNS) {
    if (pattern.test(lower)) {
      return true;
    }
  }

  if (lower.length <= 4) {
    for (const pattern of VERB_STEM_PATTERNS) {
      if (pattern.test(lower)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extract verb prefix from a camelCase/PascalCase function name
 */
export function extractVerbPrefix(functionName: string): string | null {
  if (!functionName || typeof functionName !== 'string') {
    return null;
  }

  const segments = splitCamelCase(functionName);
  if (segments.length === 0) {
    return null;
  }

  const firstSegment = segments[0];
  if (!firstSegment) {
    return null;
  }

  const lower = firstSegment.toLowerCase();

  if (isVerbLike(lower)) {
    return lower;
  }

  if (lower === 'on' && segments.length > 1) {
    return 'on';
  }

  return null;
}

/**
 * Detect verb prefix using regex pattern (legacy compatibility)
 *
 * @deprecated Use extractVerbPrefix for better linguistic analysis
 */
export function detectVerbPrefix(name: string): string | null {
  return extractVerbPrefix(name);
}

/**
 * Get all verb prefixes from a list of function names
 */
export function groupByVerbPrefix(names: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const name of names) {
    const prefix = extractVerbPrefix(name);
    const key = prefix ?? 'misc';

    const existing = groups.get(key) ?? [];
    existing.push(name);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Check if a function name follows action verb pattern
 */
export function isActionVerbName(name: string): boolean {
  const prefix = extractVerbPrefix(name);
  return prefix !== null && prefix !== 'on';
}

/**
 * Check if a function name follows event handler pattern
 */
export function isEventHandlerName(name: string): boolean {
  const prefix = extractVerbPrefix(name);
  return prefix === 'on';
}
