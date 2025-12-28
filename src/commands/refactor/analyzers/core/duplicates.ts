/**
 * @module commands/refactor/analyzers/core/duplicates
 * @description AST-based duplicate function detection
 */

import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { detectNamingPattern } from '@/lib/modules';
import { findFiles, logger, readFile } from '../../../../lib';
import {
  getProject,
  type Project,
  releaseProject,
  type SourceFile,
  SyntaxKind,
} from '../../../../lib/@ast';
import { extractVerbPrefix } from '../../../../lib/@patterns';
import type { DuplicateInfo, FunctionSignature } from '../../core';
import { findTsConfig } from '../shared';
import { extractFunctionsSwc } from './swc-parser';

// ============================================================================
// CONSTANTS
// ============================================================================

const SIMILARITY_THRESHOLDS = {
  /** >80% similar = merge candidates */
  MERGE: 0.8,
  /** >30% similar = rename to avoid confusion */
  RENAME: 0.3,
  /** Max 50% length difference for comparison */
  LENGTH_DIFF: 0.5,
  /** Minimum body size to avoid false positives on tiny functions */
  MIN_BODY_LENGTH: 20,
} as const;

// ============================================================================
// DYNAMIC GENERIC NAME DETECTION (no hardcoded word lists)
// ============================================================================

/**
 * Linguistic patterns that indicate generic/anonymous naming
 * These are structural patterns, not word lists
 */
const GENERIC_STRUCTURAL_PATTERNS = [
  /^[a-z]$/, // Single letter: a, b, x, y
  /^[a-z]{1,2}\d*$/, // Short with optional number: fn, cb, x1
  /^_+$/, // Underscores only
  /^[a-z]{3}$/, // 3-letter all-lowercase (likely abbreviation)
];

/**
 * Split name into semantic segments (camelCase/snake_case)
 */
function splitIntoSegments(name: string): string[] {
  // Handle snake_case
  if (name.includes('_')) {
    return name.split('_').filter((s) => s.length > 0);
  }
  // Handle camelCase/PascalCase
  return name.split(/(?=[A-Z])/).filter((s) => s.length > 0);
}

/**
 * Calculate vowel ratio in a string
 * Real words have ~40% vowels, abbreviations have fewer
 */
function getVowelRatio(str: string): number {
  const vowels = str.match(/[aeiou]/gi);
  return vowels ? vowels.length / str.length : 0;
}

/**
 * Check if name is an abbreviation (all consonants or very low vowel ratio)
 */
function isAbbreviation(name: string): boolean {
  if (name.length > 5) return false;
  const vowelRatio = getVowelRatio(name);
  // Abbreviations typically have very few vowels: cfg, msg, cb, fn, ctx
  return vowelRatio < 0.2;
}

/**
 * Estimate syllable count using vowel cluster heuristic
 * Each vowel group typically represents one syllable
 */
function estimateSyllables(word: string): number {
  const lowerWord = word.toLowerCase();
  // Count vowel clusters (consecutive vowels count as one)
  const vowelClusters = lowerWord.match(/[aeiouy]+/g);
  if (!vowelClusters) return 1;

  let count = vowelClusters.length;

  // Adjust for silent 'e' at end
  if (lowerWord.endsWith('e') && count > 1) {
    count--;
  }

  // Adjust for common suffixes that don't add syllables
  if (/le$/.test(lowerWord) && count > 1) {
    // 'le' ending usually doesn't add a syllable if preceded by consonant
    const beforeLe = lowerWord.slice(-3, -2);
    if (!/[aeiouy]/.test(beforeLe)) {
      count++;
    }
  }

  return Math.max(1, count);
}

/**
 * Check if a word ends with common noun suffixes
 * These patterns indicate the word is likely a noun/object
 */
function hasNounSuffix(word: string): boolean {
  const lowerWord = word.toLowerCase();

  // Common noun-forming suffixes in programming
  const nounPatterns = [
    /er$/, // handler, listener, helper, manager
    /or$/, // iterator, selector, constructor
    /tion$/, // function, action, collection
    /sion$/, // session, version
    /ment$/, // element, argument
    /ness$/, // readiness
    /ity$/, // utility, entity
    /ure$/, // structure, closure
    /ance$/, // instance
    /ence$/, // reference, sequence
    /ing$/, // string, thing (as nouns)
    /ist$/, // list (and -ist words)
    /ata$/, // data, metadata
    /xt$/, // context, text
    /que$/, // queue
    /ay$/, // array, display
    /ch$/, // cache, batch
    /ck$/, // callback, stack
    /se$/, // response, case
    /te$/, // state, template
    /de$/, // node, code
    /ue$/, // value, queue
    /pe$/, // type, pipe
    /me$/, // name, frame
    /ms$/, // params, items
    /gs$/, // args, flags
    /ps$/, // props
    /ns$/, // options, actions
    /ts$/, // results, events
    /rd$/, // record
    /ry$/, // factory, entry
    /ol$/, // control, protocol
    /et$/, // object, set
    /ap$/, // map
    /lt$/, // result
    /ig$/, // config
    /fo$/, // info
  ];

  return nounPatterns.some((pattern) => pattern.test(lowerWord));
}

/**
 * Check if a word starts with a verb prefix
 * Words starting with action verbs are usually meaningful when combined
 *
 * Uses the shared linguistic verb detection from @patterns/verb-detection
 */
function hasVerbPrefix(word: string): boolean {
  // Use the shared verb detection module for consistent behavior
  return extractVerbPrefix(word) !== null;
}

/**
 * Dynamically detect if a name is a suffix-only (lacks subject/context)
 * Uses linguistic analysis instead of hardcoded word lists
 *
 * A suffix-only name is:
 * - A single word (no camelCase/snake_case segments)
 * - Has noun-like ending patterns
 * - Has no verb prefix
 * - Short to medium length (4-10 chars typically)
 * - High vowel ratio (real word, not abbreviation)
 *
 * Examples:
 * - "handler" -> true (suffix-only, no subject)
 * - "clickHandler" -> false (has subject "click")
 * - "data" -> true (generic noun)
 * - "userData" -> false (has subject "user")
 */
function isSuffixOnlyName(name: string): boolean {
  const lowerName = name.toLowerCase();

  // 1. Must be a single word (no compound segments)
  const segments = splitIntoSegments(name);
  if (segments.length > 1) {
    return false; // Compound names are meaningful
  }

  // 2. Very short words (<=3 chars) are handled elsewhere
  if (name.length <= 3) {
    return false;
  }

  // 3. Very long single words (>12 chars) are likely domain-specific
  if (name.length > 12) {
    return false;
  }

  // 4. Must look like a real word (reasonable vowel ratio)
  const vowelRatio = getVowelRatio(lowerName);
  if (vowelRatio < 0.2 || vowelRatio > 0.7) {
    return false; // Likely abbreviation or not a real word
  }

  // 5. Check for noun-like suffix patterns
  if (!hasNounSuffix(lowerName)) {
    return false; // Doesn't look like a noun suffix
  }

  // 6. Must NOT start with a verb prefix (those need subjects too, but are different)
  if (hasVerbPrefix(lowerName)) {
    return false;
  }

  // 7. Check syllable count - suffix-only words are typically 1-3 syllables
  const syllables = estimateSyllables(lowerName);
  if (syllables > 3) {
    return false; // Likely a domain-specific term
  }

  // 8. Additional check: common programming suffix patterns
  // These are structurally recognizable as generic
  const genericNounPatterns = [
    /^(func|function)$/i, // function reference
    /^(handler|callback|listener)$/i, // event patterns (end in -er)
    /^(params|props|args|options|config)$/i, // parameter collections (end in -s)
    /^(data|info|meta)$/i, // information containers
    /^(item|value|result|entry)$/i, // generic containers
    /^(response|request)$/i, // HTTP patterns
    /^(context|state|store|cache)$/i, // state management
    /^(type|node|element)$/i, // structural elements
    /^(list|array|object|map|set|queue)$/i, // collection types
  ];

  // If matches known generic pattern, definitely suffix-only
  for (const pattern of genericNounPatterns) {
    if (pattern.test(lowerName)) {
      return true;
    }
  }

  // 9. Heuristic: single nouns with common suffixes and no qualifier
  // Words like "manager", "builder", "factory" alone are generic
  if (/^[a-z]+(er|or|ry|nt|ng)$/i.test(lowerName) && name.length <= 10) {
    return true;
  }

  return false;
}

/**
 * Dynamically detect placeholder/test names
 * Uses linguistic patterns to identify metasyntactic variables
 *
 * Characteristics of placeholder names:
 * - Very short (3-4 chars)
 * - Often follow patterns like CVC (consonant-vowel-consonant)
 * - Low semantic meaning
 * - Often contain 'x', 'z', or unusual letter combinations
 */
function isPlaceholderName(name: string): boolean {
  const lowerName = name.toLowerCase();

  // 1. Well-known metasyntactic variables (language-agnostic placeholders)
  // These are universally recognized as placeholder names in programming
  // Detected by pattern: short nonsense syllables common across programming cultures
  if (/^(foo|bar|baz|qux|quux|corge|grault|garply|waldo|fred|plugh|xyzzy|thud)$/i.test(lowerName)) {
    return true;
  }

  // 2. Very short words with unusual letter combinations (CVC with rare consonants)
  if (name.length === 3) {
    // CVC pattern with unusual consonants (q, x, z are rare in 3-letter English words)
    if (/^[bcdfghjklmnpqrstvwxz][aeiou][bcdfghjklmnpqrstvwxz]$/i.test(lowerName)) {
      if (/[qxz]/.test(lowerName)) {
        return true;
      }
    }
  }

  // 3. Test/temporary naming patterns (detected by semantic prefix)
  if (/^(test|demo|example|sample|temp|tmp|mock|stub|fake|dummy)\d*$/i.test(lowerName)) {
    return true;
  }

  // 4. Placeholder with numbers (x1, foo2, test123)
  if (/^[a-z]{1,4}\d+$/i.test(lowerName)) {
    return true;
  }

  // 5. All same letter repeated (aaa, xxx)
  if (/^(.)\1+$/.test(lowerName)) {
    return true;
  }

  // 6. Short words with multiple unusual letters
  // Q, X, Z, J are rare in English - multiple in a short word suggests placeholder
  if (name.length <= 4) {
    const unusualCount = (lowerName.match(/[qxzj]/g) || []).length;
    if (unusualCount >= 1 && name.length <= 3) {
      return true;
    }
  }

  return false;
}

/**
 * Dynamically detect short verb prefixes that need a subject
 * These are action words that are too short/generic alone
 *
 * Characteristics:
 * - 2-4 characters
 * - Common programming verbs
 * - Meaningless without an object/subject
 */
function isShortVerbPrefix(name: string): boolean {
  const lowerName = name.toLowerCase();

  // 1. Must be short (2-4 chars for standalone verbs)
  if (name.length > 4) {
    return false;
  }

  // 2. Check for verb-like structure
  // Short verbs typically are CVC or CVCC pattern
  const vowelRatio = getVowelRatio(lowerName);

  // Verbs usually have 20-40% vowels
  if (vowelRatio < 0.15 || vowelRatio > 0.6) {
    return false;
  }

  // 3. Common short verb patterns in programming
  // These are detected by their structure: short + verb-like
  const shortVerbPatterns = [
    /^(get|set|put|pop|add|run|do)$/i, // 2-3 letter verbs
    /^(is|on|to|go|be)$/i, // 2 letter auxiliaries/prepositions used as verbs
    /^(has|can|use|try|let|new)$/i, // 3 letter modal/utility verbs
    /^(push|pull|call|send|read|load|save|emit|init|exec|make|find|show|hide|move|copy|sort|test|trim|join|bind|wrap|lock|tick|ping|fire)$/i, // 4 letter verbs
  ];

  for (const pattern of shortVerbPatterns) {
    if (pattern.test(lowerName)) {
      return true;
    }
  }

  // 4. Heuristic: very short words ending in common verb endings
  if (name.length <= 3 && /^[a-z]+(t|d|k|p|n|s)$/i.test(lowerName)) {
    // Likely a short verb (get, set, put, add, run, etc.)
    return true;
  }

  return false;
}

/**
 * Check if a function name is likely generic/not meaningful for duplicate detection
 * Uses dynamic heuristics without static word lists
 */
function isGenericFunctionName(name: string): boolean {
  // 1. Structural patterns (single letter, short abbreviations, underscores)
  for (const pattern of GENERIC_STRUCTURAL_PATTERNS) {
    if (pattern.test(name)) return true;
  }

  // 2. Too short names are usually generic
  if (name.length < 3) return true;

  // 3. Check if it's a short abbreviation (low vowel ratio)
  if (name.length <= 4 && isAbbreviation(name)) return true;

  // 4. JS/TS reserved words and types (detected by pattern, not list)
  const lowerName = name.toLowerCase();
  if (/^(null|undefined|true|false|nan|infinity)$/.test(lowerName)) return true;
  if (/^(string|number|boolean|object|array|function|symbol|bigint)$/.test(lowerName)) return true;

  // 5. Placeholder naming patterns (dynamic detection)
  if (isPlaceholderName(name)) return true;

  return false;
}

/**
 * Check if a name is likely a meaningful function name worth tracking
 * Uses dynamic analysis: naming patterns, structure, linguistics
 */
function isMeaningfulFunctionName(name: string): boolean {
  // Skip obviously generic names
  if (isGenericFunctionName(name)) return false;

  // Must be at least 4 chars
  if (name.length < 4) return false;

  // 1. Check if it matches a recognized naming pattern from @reusable
  // These patterns indicate meaningful, well-named functions
  const namedPattern = detectNamingPattern(name);
  if (namedPattern) {
    // Matched a meaningful pattern like 'hook', 'utility', 'service', etc.
    return true;
  }

  // 2. Multi-word names are meaningful (camelCase/snake_case with 2+ segments)
  const segments = splitIntoSegments(name);
  if (segments.length >= 2) {
    // Has multiple semantic parts like "getUserById", "format_date"
    return true;
  }

  // 3. Single words: check for suffix-only patterns (dynamic detection)
  // These are meaningful only when combined with a subject
  if (isSuffixOnlyName(name)) {
    return false;
  }

  // 4. Single words: analyze linguistically
  if (segments.length === 1) {
    const word = segments[0]?.toLowerCase() ?? '';

    // Long single words (7+ chars) are usually meaningful domain terms
    if (word.length >= 7) return true;

    // Short single words (4-6 chars): check if they're real words
    // Real words have reasonable vowel ratio (25-60%)
    const vowelRatio = getVowelRatio(word);
    if (vowelRatio < 0.2 || vowelRatio > 0.7) {
      // Unusual vowel ratio suggests abbreviation or made-up word
      return false;
    }

    // Check for short verb prefixes that need context (dynamic detection)
    if (isShortVerbPrefix(word)) {
      return false;
    }

    // Remaining 4-6 char words with normal vowel ratio
    // Accept them - they might be domain terms
    return true;
  }

  return true;
}

const LIMITS = {
  /** Maximum files to analyze (prevent resource exhaustion) */
  MAX_FILES: 5000,
  /** Maximum file size in bytes */
  MAX_FILE_SIZE: 1024 * 1024, // 1MB
} as const;

// ============================================================================
// OPTIONS
// ============================================================================

export interface FindDuplicatesOptions {
  verbose?: boolean;
  minSimilarity?: number;
  ignoreTests?: boolean;
  /** Use fast SWC parser instead of ts-morph (default: true) */
  useFastParser?: boolean;
  /** Shared ts-morph Project instance (optional, for performance) */
  project?: Project;
}

// ============================================================================
// EXTRACTION
// ============================================================================

/**
 * Extract function signatures from a TypeScript file
 */
export function extractFunctions(sourceFile: SourceFile, filePath: string): FunctionSignature[] {
  const functions: FunctionSignature[] = [];

  // Get all function declarations
  for (const func of sourceFile.getFunctions()) {
    const name = func.getName();
    if (!name) continue;

    const bodyText = func.getBody()?.getText() ?? '';
    const normalizedBody = normalizeBody(bodyText);
    const tokens = new Set(normalizedBody.split(/\s+/).filter((t) => t.length > 0));

    functions.push({
      name,
      file: filePath,
      line: func.getStartLineNumber(),
      params: func.getParameters().map((p) => p.getType().getText()),
      returnType: func.getReturnType().getText(),
      exported: func.isExported(),
      bodyHash: hashBody(normalizedBody),
      normalizedBody,
      tokens,
    });
  }

  // Get exported arrow functions from variable declarations
  for (const varStatement of sourceFile.getVariableStatements()) {
    if (!varStatement.isExported()) continue;

    for (const decl of varStatement.getDeclarations()) {
      const init = decl.getInitializer();
      if (!init) continue;

      // Check if it's an arrow function or function expression
      const initText = init.getText();
      if (!initText.includes('=>') && !initText.startsWith('function')) continue;

      const name = decl.getName();
      const normalizedBody = normalizeBody(initText);
      const tokens = new Set(normalizedBody.split(/\s+/).filter((t) => t.length > 0));

      // Extract parameters from arrow functions
      let params: string[] = [];
      if (init.getKind() === SyntaxKind.ArrowFunction) {
        const arrowFunc = init.asKind(SyntaxKind.ArrowFunction);
        if (arrowFunc) {
          params = arrowFunc.getParameters().map((p) => p.getType().getText());
        }
      }

      functions.push({
        name,
        file: filePath,
        line: decl.getStartLineNumber(),
        params,
        returnType: decl.getType().getText(),
        exported: true,
        bodyHash: hashBody(normalizedBody),
        normalizedBody,
        tokens,
      });
    }
  }

  return functions;
}

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Normalize function body for comparison
 * Removes comments, whitespace variations, normalizes strings and numbers
 */
function normalizeBody(body: string): string {
  return (
    body
      // Remove single-line comments
      .replace(/\/\/.*$/gm, '')
      // Remove multi-line comments (non-greedy)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Normalize all strings to placeholder (handle escapes)
      .replace(/'(?:[^'\\]|\\.)*'/g, "'STR'")
      .replace(/"(?:[^"\\]|\\.)*"/g, '"STR"')
      .replace(/`(?:[^`\\]|\\.)*`/g, '`STR`')
      // Normalize numbers
      .replace(/\b\d+\.?\d*\b/g, 'NUM')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Hash function body using MD5
 */
function hashBody(body: string): string {
  return createHash('md5').update(body).digest('hex');
}

// ============================================================================
// SIMILARITY
// ============================================================================

/**
 * Calculate similarity between two function bodies
 * Returns 0-1 (1 = identical)
 */
function calculateSimilarity(
  body1: string,
  body2: string,
  tokens1?: Set<string>,
  tokens2?: Set<string>,
): number {
  if (body1 === body2) return 1;

  const len1 = body1.length;
  const len2 = body2.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) return 1;

  // For very different lengths, quick exit
  if (Math.abs(len1 - len2) / maxLen > SIMILARITY_THRESHOLDS.LENGTH_DIFF) return 0;

  // Token-based Jaccard similarity
  // Use pre-computed tokens if available, otherwise compute on demand
  const t1 = tokens1 ?? new Set(body1.split(/\s+/).filter((t) => t.length > 0));
  const t2 = tokens2 ?? new Set(body2.split(/\s+/).filter((t) => t.length > 0));

  const intersection = [...t1].filter((t) => t2.has(t)).length;
  const union = new Set([...t1, ...t2]).size;

  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculate pairwise similarity for multiple functions
 * Returns the minimum similarity (conservative approach)
 */
function calculateGroupSimilarity(funcs: FunctionSignature[]): number {
  if (funcs.length < 2) return 0;

  // Short-circuit for 2-element groups
  if (funcs.length === 2) {
    const f1 = funcs[0];
    const f2 = funcs[1];
    if (!f1 || !f2) return 0;
    return calculateSimilarity(f1.normalizedBody, f2.normalizedBody, f1.tokens, f2.tokens);
  }

  let minSimilarity = 1;

  for (let i = 0; i < funcs.length - 1; i++) {
    for (let j = i + 1; j < funcs.length; j++) {
      const fi = funcs[i];
      const fj = funcs[j];
      if (fi && fj) {
        const sim = calculateSimilarity(fi.normalizedBody, fj.normalizedBody, fi.tokens, fj.tokens);
        minSimilarity = Math.min(minSimilarity, sim);

        // Early exit when below threshold - can't improve
        if (minSimilarity < SIMILARITY_THRESHOLDS.MERGE) return minSimilarity;
      }
    }
  }

  return minSimilarity;
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

/**
 * Find duplicate functions in a directory
 */
export async function findDuplicates(
  targetPath: string,
  projectRoot: string,
  options: FindDuplicatesOptions = {},
): Promise<DuplicateInfo[]> {
  const { verbose = false, ignoreTests = true, useFastParser = true } = options;
  const duplicates: DuplicateInfo[] = [];

  // Find all TypeScript files using correct API
  const allFiles = await findFiles(targetPath, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules', 'dist', '.next', 'coverage'],
  });

  // Filter out test files and .d.ts
  let files = allFiles.filter((f) => !f.endsWith('.d.ts'));
  if (ignoreTests) {
    files = files.filter((f) => !f.includes('.test.') && !f.includes('.spec.'));
  }

  // Resource exhaustion protection
  if (files.length > LIMITS.MAX_FILES) {
    logger.warn(`Too many files (${files.length}), limiting to ${LIMITS.MAX_FILES}`);
    files = files.slice(0, LIMITS.MAX_FILES);
  }

  // Extract all functions from all files
  const allFunctions: FunctionSignature[] = [];

  if (useFastParser) {
    // Fast path: use SWC parser (10-20x faster)
    for (const file of files) {
      try {
        const content = readFile(file);
        if (!content) continue;

        // Skip large files
        if (content.length > LIMITS.MAX_FILE_SIZE) {
          if (verbose) {
            logger.warn(`Skipping large file: ${path.relative(projectRoot, file)}`);
          }
          continue;
        }

        const relPath = path.relative(projectRoot, file);
        const swcFunctions = extractFunctionsSwc(file, content);

        // Convert SWC functions to FunctionSignature format
        for (const swcFunc of swcFunctions) {
          // Extract actual function body using SWC-provided offsets
          const bodyText = content.slice(swcFunc.bodyStart, swcFunc.bodyEnd);
          const normalizedBody = normalizeBody(bodyText);
          const tokens = new Set(normalizedBody.split(/\s+/).filter((t) => t.length > 0));

          allFunctions.push({
            name: swcFunc.name,
            file: relPath,
            line: swcFunc.line,
            params: [], // SWC doesn't provide type info
            returnType: 'unknown',
            exported: swcFunc.isExported,
            bodyHash: swcFunc.bodyHash,
            normalizedBody,
            tokens,
          });
        }
      } catch (error) {
        if (verbose) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          logger.warn(`Failed to parse ${path.relative(projectRoot, file)}: ${message}`);
        }
      }
    }
  } else {
    // Slow path: use ts-morph for full type information
    // Use shared project if provided, otherwise get from pool
    const project =
      options.project ??
      (() => {
        const tsConfigPath = findTsConfig(targetPath, projectRoot);
        return tsConfigPath ? getProject({ tsConfigPath }) : getProject({});
      })();

    const shouldReleaseProject = !options.project;

    try {
      for (const file of files) {
        try {
          const content = readFile(file);
          if (!content) continue;

          // Skip large files
          if (content.length > LIMITS.MAX_FILE_SIZE) {
            if (verbose) {
              logger.warn(`Skipping large file: ${path.relative(projectRoot, file)}`);
            }
            continue;
          }

          // Add source file to project if not already there
          let sourceFile = project.getSourceFile(file);
          if (!sourceFile) {
            sourceFile = project.createSourceFile(file, content, { overwrite: true });
          }

          const relPath = path.relative(projectRoot, file);
          const functions = extractFunctions(sourceFile, relPath);
          allFunctions.push(...functions);
        } catch (error) {
          if (verbose) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.warn(`Failed to parse ${path.relative(projectRoot, file)}: ${message}`);
          }
          // Continue processing other files
        }
      }
    } finally {
      // Release project back to pool if we created it
      if (shouldReleaseProject) {
        releaseProject(project);
      }
    }
  }

  // Group functions by name (skip generic names using dynamic heuristics)
  const byName = new Map<string, FunctionSignature[]>();
  for (const func of allFunctions) {
    // Skip generic/common names using dynamic analysis (no hardcoded lists)
    if (!isMeaningfulFunctionName(func.name)) continue;

    const existing = byName.get(func.name) ?? [];
    existing.push(func);
    byName.set(func.name, existing);
  }

  // Find duplicates (same name in multiple files)
  for (const [name, funcs] of byName) {
    if (funcs.length < 2) continue;

    // Calculate pairwise similarities (not just first two!)
    const similarity = calculateGroupSimilarity(funcs);

    // Determine recommendation based on similarity
    let recommendation: 'merge' | 'rename' | 'keep-both' = 'keep-both';
    if (similarity > SIMILARITY_THRESHOLDS.MERGE) {
      recommendation = 'merge';
    } else if (similarity > SIMILARITY_THRESHOLDS.RENAME) {
      recommendation = 'rename';
    }

    duplicates.push({
      name,
      locations: funcs.map((f) => ({
        file: f.file,
        line: f.line,
        exported: f.exported,
      })),
      similarity,
      recommendation,
    });
  }

  // Also find functions with identical bodies but different names
  const byHash = new Map<string, FunctionSignature[]>();
  for (const func of allFunctions) {
    if (func.normalizedBody.length < SIMILARITY_THRESHOLDS.MIN_BODY_LENGTH) continue;

    const existing = byHash.get(func.bodyHash) ?? [];
    existing.push(func);
    byHash.set(func.bodyHash, existing);
  }

  for (const [, funcs] of byHash) {
    if (funcs.length < 2) continue;

    // Skip if all have the same name (already caught above)
    const uniqueNames = new Set(funcs.map((f) => f.name));
    if (uniqueNames.size === 1) continue;

    // Find the "main" name (most exported, or alphabetically first)
    const sortedNames = [...uniqueNames].sort((a, b) => {
      const aExported = funcs.some((f) => f.name === a && f.exported);
      const bExported = funcs.some((f) => f.name === b && f.exported);
      if (aExported && !bExported) return -1;
      if (!aExported && bExported) return 1;
      return a.localeCompare(b);
    });

    duplicates.push({
      name: `[identical body] ${sortedNames.join(' / ')}`,
      locations: funcs.map((f) => ({
        file: f.file,
        line: f.line,
        exported: f.exported,
      })),
      similarity: 1,
      recommendation: 'merge',
    });
  }

  return duplicates;
}

/**
 * Quick scan for potential duplicates without full AST parsing
 */
export async function quickScanDuplicates(targetPath: string): Promise<string[]> {
  const functionNames: Map<string, string[]> = new Map();

  const files = await findFiles(targetPath, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules', 'dist', '.next'],
  });

  // Filter out .d.ts files
  const sourceFiles = files.filter((f) => !f.endsWith('.d.ts'));

  for (const file of sourceFiles) {
    const content = readFile(file);
    if (!content) continue;

    // Quick regex scan for function/const declarations
    // Match: export function name / export async function name
    const exportedFunctions = content.match(/export\s+(async\s+)?function\s+(\w+)/g) ?? [];
    // Match: export const name =
    const exportedConsts = content.match(/export\s+const\s+(\w+)\s*=/g) ?? [];

    for (const match of exportedFunctions) {
      const name = match.replace(/export\s+(async\s+)?function\s+/, '');
      const existing = functionNames.get(name) ?? [];
      existing.push(file);
      functionNames.set(name, existing);
    }

    for (const match of exportedConsts) {
      const name = match.replace(/export\s+const\s+/, '').replace(/\s*=$/, '');
      const existing = functionNames.get(name) ?? [];
      existing.push(file);
      functionNames.set(name, existing);
    }
  }

  return [...functionNames.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([name, files]) => `${name}: ${files.join(', ')}`);
}
