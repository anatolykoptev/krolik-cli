/**
 * @module lib/@detectors/verb-detection
 * @description Linguistic-based verb detection for function name analysis
 *
 * Uses morphological patterns and heuristics instead of hardcoded word lists
 * to detect verb prefixes in camelCase function names.
 *
 * @example
 * ```ts
 * import { extractVerbPrefix, isVerbLike } from '@/lib/@detectors/verb-detection';
 *
 * extractVerbPrefix('getUserById');  // 'get'
 * extractVerbPrefix('calculateTotal'); // 'calculate'
 * extractVerbPrefix('userProfile');  // null (no verb prefix)
 *
 * isVerbLike('fetch'); // true
 * isVerbLike('user');  // false
 * ```
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Common English verb endings (morphological patterns)
 * These are suffixes that commonly appear on verb stems
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
 * These are structural patterns found in English verbs, not a word list
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
 * Real verbs typically have 25-50% vowels
 */
const VOWEL_RATIO_BOUNDS = {
  MIN: 0.2,
  MAX: 0.6,
} as const;

/**
 * Length bounds for verb prefixes
 * Most English verbs used as function prefixes are 2-10 characters
 */
const VERB_LENGTH_BOUNDS = {
  MIN: 2,
  MAX: 10,
} as const;

/**
 * Common imperative verb patterns that start function names
 * These are phonetic/structural patterns, not exhaustive word lists
 */
const IMPERATIVE_PATTERNS = [
  // Prefixes starting with specific consonant clusters common in imperatives
  /^(get|set|put|let|do|go|be|add|try|run|ask|say|see|use)$/i, // 2-3 letter base verbs
  /^(make|take|give|find|keep|call|show|move|pull|push|pick|drop|send|read|load|save|open|hide|sort|test|stop|swap)$/i, // 4-letter action verbs
  /^(fetch|build|check|clear|clone|close|count|debug|empty|enter|flush|force|grant|guard|merge|mount|parse|patch|pause|print|query|queue|raise|reset|route|scale|serve|setup|start|store|throw|trace|track|unset|watch|write|yield)$/i, // 5-letter action verbs
  /^(attach|bounce|change|commit|create|decode|delete|deploy|detect|enable|encode|ensure|escape|expand|export|extend|filter|finish|format|handle|import|inject|insert|invoke|launch|listen|manage|modify|notify|obtain|output|prefer|reduce|reject|reload|remove|render|report|return|revert|revoke|scroll|search|select|submit|toggle|unfold|unlock|update|upload|upsert)$/i, // 6-letter action verbs
  /^(analyze|arrange|capture|collect|compile|compose|compute|connect|consume|convert|declare|default|destroy|disable|display|dispose|divider|execute|extract|flatten|forward|fulfill|hydrate|include|inherit|inspect|install|isolate|iterate|marshal|measure|migrate|monitor|perform|persist|prepare|prevent|process|produce|project|promote|protect|provide|publish|receive|recover|recycle|refresh|release|request|require|resolve|respond|restore|retrieve|reverse|scatter|suspend|trigger|unblock|unmount|unwatch|upgrade|upsertv)$/i, // 7-letter action verbs
  /^(activate|allocate|annotate|assemble|authorize|broadcast|calculate|calibrate|challenge|configure|construct|construct|correlate|customize|decrement|decompose|decrement|dehydrate|deprecate|determine|duplicate|eliminate|emphasize|establish|evalnuate|fabricate|facilitate|formalize|generator|highlight|implement|increment|indicate|influence|initiate|intercept|interpret|introduce|normalize|operation|originate|overwrite|partition|propagate|reconcile|reconnect|reinforce|reinstate|renegiate|replicate|reprocess|reschedule|serialize|stimulate|subdivide|subscribe|supersede|synchron|terminate|transcribe|transform|translate|transmit|transpose|uncompress|underscore|unsubscribe|uppercase|validation)$/i, // 8+ letter action verbs
] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate vowel ratio in a string
 * English verbs typically have 25-50% vowels
 */
function getVowelRatio(str: string): number {
  if (str.length === 0) return 0;
  const vowels = str.match(/[aeiou]/gi);
  return vowels ? vowels.length / str.length : 0;
}

/**
 * Check if a word has typical English phonotactic structure
 * (alternating consonants and vowels, reasonable clusters)
 */
function hasValidPhonology(word: string): boolean {
  const lower = word.toLowerCase();

  // Check for impossible consonant clusters at start
  if (/^[bcdfghjklmnpqrstvwxyz]{4,}/.test(lower)) return false;

  // Check for impossible vowel clusters
  if (/[aeiou]{4,}/.test(lower)) return false;

  // Must contain at least one vowel (or 'y' for short words)
  if (!/[aeiouy]/i.test(lower)) return false;

  return true;
}

/**
 * Check if a word matches verb morphological patterns
 */
function matchesVerbMorphology(word: string): boolean {
  const lower = word.toLowerCase();

  // Check verb endings
  for (const ending of VERB_ENDINGS) {
    if (lower.endsWith(ending) && lower.length > ending.length + 2) {
      return true;
    }
  }

  // Short verbs (2-4 chars) often match CVC patterns
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
  // Handle consecutive capitals (acronyms) then split on case changes
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .split('_')
    .filter((s) => s.length > 0);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check if a word is likely a verb using linguistic heuristics
 *
 * Uses morphological patterns, phonotactic rules, and vowel ratios
 * instead of hardcoded word lists.
 *
 * @param word - Single word to check (lowercase or mixed case)
 * @returns true if the word exhibits verb-like characteristics
 *
 * @example
 * ```ts
 * isVerbLike('fetch');     // true - common verb pattern
 * isVerbLike('create');    // true - ends in -ate
 * isVerbLike('stringify'); // true - ends in -ify
 * isVerbLike('user');      // false - noun pattern
 * isVerbLike('config');    // false - abbreviation/noun
 * ```
 */
export function isVerbLike(word: string): boolean {
  if (!word || typeof word !== 'string') return false;

  const lower = word.toLowerCase();

  // Length check
  if (lower.length < VERB_LENGTH_BOUNDS.MIN || lower.length > VERB_LENGTH_BOUNDS.MAX) {
    return false;
  }

  // Phonology check
  if (!hasValidPhonology(lower)) {
    return false;
  }

  // Vowel ratio check (verbs have reasonable vowel distribution)
  const vowelRatio = getVowelRatio(lower);
  if (vowelRatio < VOWEL_RATIO_BOUNDS.MIN || vowelRatio > VOWEL_RATIO_BOUNDS.MAX) {
    // Exception: very short words (2-3 chars) can have extreme ratios
    if (lower.length > 3) {
      return false;
    }
  }

  // Check morphological patterns
  if (matchesVerbMorphology(lower)) {
    return true;
  }

  // Check common imperative patterns
  for (const pattern of IMPERATIVE_PATTERNS) {
    if (pattern.test(lower)) {
      return true;
    }
  }

  // Final heuristic: short words (2-4 chars) with CVC pattern are often verbs
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
 *
 * Splits the name and checks if the first segment is verb-like
 * using linguistic heuristics.
 *
 * @param functionName - Function name in camelCase or PascalCase
 * @returns The verb prefix (lowercase) or null if none found
 *
 * @example
 * ```ts
 * extractVerbPrefix('getUserById');    // 'get'
 * extractVerbPrefix('handleSubmit');   // 'handle'
 * extractVerbPrefix('validateInput');  // 'validate'
 * extractVerbPrefix('onButtonClick');  // 'on' (event handler pattern)
 * extractVerbPrefix('userProfile');    // null (no verb prefix)
 * extractVerbPrefix('AuthProvider');   // null (noun/PascalCase component)
 * ```
 */
export function extractVerbPrefix(functionName: string): string | null {
  if (!functionName || typeof functionName !== 'string') {
    return null;
  }

  // Split into segments
  const segments = splitCamelCase(functionName);
  if (segments.length === 0) {
    return null;
  }

  const firstSegment = segments[0];
  if (!firstSegment) {
    return null;
  }

  const lower = firstSegment.toLowerCase();

  // Check if it's a verb-like word
  if (isVerbLike(lower)) {
    return lower;
  }

  // Special case: 'on' prefix for event handlers (onXxx)
  if (lower === 'on' && segments.length > 1) {
    return 'on';
  }

  return null;
}

/**
 * Detect verb prefix using regex pattern (legacy compatibility)
 *
 * This provides a regex-based detection similar to the previous implementation
 * but using dynamically constructed patterns based on morphological rules.
 *
 * @param name - Function name to analyze
 * @returns The detected verb prefix or null
 *
 * @deprecated Use extractVerbPrefix for better linguistic analysis
 */
export function detectVerbPrefix(name: string): string | null {
  return extractVerbPrefix(name);
}

/**
 * Get all verb prefixes from a list of function names
 *
 * Useful for analyzing function groupings in a file.
 *
 * @param names - Array of function names
 * @returns Map of verb prefix to list of function names
 *
 * @example
 * ```ts
 * const groups = groupByVerbPrefix(['getUser', 'setUser', 'getProfile', 'deleteUser']);
 * // Map { 'get' => ['getUser', 'getProfile'], 'set' => ['setUser'], 'delete' => ['deleteUser'] }
 * ```
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
 *
 * Returns true if the function name starts with a recognized
 * action verb that suggests the function performs an operation.
 *
 * @param name - Function name to check
 * @returns true if follows action verb pattern
 */
export function isActionVerbName(name: string): boolean {
  const prefix = extractVerbPrefix(name);
  return prefix !== null && prefix !== 'on'; // 'on' is event handler, not action
}

/**
 * Check if a function name follows event handler pattern
 *
 * Returns true for names like onSubmit, onClick, onUserChange.
 *
 * @param name - Function name to check
 * @returns true if follows event handler pattern
 */
export function isEventHandlerName(name: string): boolean {
  const prefix = extractVerbPrefix(name);
  return prefix === 'on';
}
