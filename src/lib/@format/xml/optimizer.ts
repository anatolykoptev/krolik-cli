/**
 * @module lib/@format/xml/optimizer
 * @description XML optimization for AI context - 4 levels of token reduction
 *
 * Strategies:
 * - minify: Basic cleanup (already applied by buildXmlDocument)
 * - semantic: Remove metadata, declarations (minimal gain on krolik output)
 * - compact: Smart truncation - keeps structure, limits content (15-25% savings)
 * - aggressive: Maximum optimization - attribute shortening, deduplication (40-60% savings)
 */

import { minifyXmlOutput } from './minify';

// ============================================================================
// TYPES
// ============================================================================

export type OptimizationLevel = 'minify' | 'semantic' | 'compact' | 'aggressive';

/** Context for smart pruning */
export type OptimizationContext = 'architecture' | 'code-review' | 'refactoring' | 'status';

export interface CompactOptions {
  /** Max lines for CDATA/diff content (default: 50) */
  maxDiffLines?: number;
  /** Max items in repeated elements like modules (default: 5) */
  maxRepeatedItems?: number;
  /** Max files in file lists (default: 10) */
  maxFiles?: number;
  /** Shorten absolute paths to relative (default: true) */
  shortenPaths?: boolean;
  /** Remove low-priority sections (default: true) */
  removeLowPriority?: boolean;
}

export interface AggressiveOptions extends CompactOptions {
  /** Shorten attribute names: name→n, path→p, etc. (default: true) */
  shortenAttributes?: boolean;
  /** Compress large numbers: 12345→12.3K (default: true) */
  compressNumbers?: boolean;
  /** Deduplicate repeated strings (default: true) */
  deduplicateStrings?: boolean;
  /** AI context for smart section pruning */
  context?: OptimizationContext;
}

export interface OptimizeOptions {
  /** Optimization level */
  level?: OptimizationLevel;
  /** Auto-select level based on size */
  auto?: boolean;
  /** Remove XML declaration */
  removeDeclaration?: boolean;
  /** Remove empty elements */
  removeEmpty?: boolean;
  /** Compact mode options */
  compact?: CompactOptions;
  /** Aggressive mode options */
  aggressive?: AggressiveOptions;
}

export interface OptimizeResult {
  /** Optimized XML */
  output: string;
  /** Original size in characters */
  originalSize: number;
  /** Optimized size in characters */
  optimizedSize: number;
  /** Compression ratio (0-1) */
  ratio: number;
  /** Applied optimization level */
  level: OptimizationLevel;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Size thresholds for auto-selection */
const SIZE_THRESHOLDS = {
  /** Below this: use minify only */
  small: 10_000,
  /** Below this: use compact */
  medium: 50_000,
  /** Above medium: use aggressive */
};

/** Default compact options */
const DEFAULT_COMPACT: Required<CompactOptions> = {
  maxDiffLines: 50,
  maxRepeatedItems: 5,
  maxFiles: 10,
  shortenPaths: true,
  removeLowPriority: true,
};

/** Default aggressive options */
const DEFAULT_AGGRESSIVE: Required<AggressiveOptions> = {
  ...DEFAULT_COMPACT,
  maxDiffLines: 30, // More aggressive truncation
  maxRepeatedItems: 3,
  shortenAttributes: true,
  compressNumbers: true,
  deduplicateStrings: true,
  context: undefined as unknown as OptimizationContext,
};

/** Low priority sections that can be removed in compact mode */
const LOW_PRIORITY_SECTIONS = [
  'by-category', // Duplicate info from top-modules
  'file-patterns', // Static info, AI knows this
  'import-conventions', // Static info
  'naming-conventions', // Static info
  'execution-order', // Usually empty
];

/** Additional sections to remove in aggressive mode */
const AGGRESSIVE_REMOVE_SECTIONS = [
  ...LOW_PRIORITY_SECTIONS,
  'entry-points', // Often empty
  'quick-reference', // Duplicates other info
  'ai-navigation', // Static conventions
];

/** Repeated element patterns to limit */
const REPEATED_ELEMENTS = [
  { parent: 'top-modules', child: 'module' },
  { parent: 'category', child: 'module' },
  { parent: 'recent-commits', child: 'commit' },
  { parent: 'affected-files', child: 'file' },
  { parent: 'misplaced-files', child: 'file' },
  { parent: 'warning', child: 'file' },
  { parent: 'error', child: 'file' },
];

/** Attribute name shortcuts for aggressive mode */
const ATTRIBUTE_SHORTCUTS: Record<string, string> = {
  name: 'n',
  path: 'p',
  lines: 'l',
  count: 'c',
  type: 't',
  score: 's',
  level: 'lv',
  category: 'cat',
  imports: 'imp',
  exports: 'exp',
  description: 'desc',
  'imported-by': 'by',
  'depends-on': 'dep',
  'used-by': 'use',
};

// ============================================================================
// OPTIMIZATION STRATEGIES
// ============================================================================

/**
 * Level 1: Basic minification (already applied by buildXmlDocument)
 */
function optimizeMinify(xml: string): string {
  return minifyXmlOutput(xml);
}

/**
 * Level 2: Semantic optimization
 * - Remove XML declaration
 * - Remove empty elements
 */
function optimizeSemantic(xml: string, options: OptimizeOptions = {}): string {
  let result = optimizeMinify(xml);

  // Remove XML declaration
  if (options.removeDeclaration !== false) {
    result = result.replace(/<\?xml[^?]*\?>/gi, '');
  }

  // Remove empty elements
  if (options.removeEmpty !== false) {
    result = result.replace(/<(\w+)><\/\1>/g, '');
    result = result.replace(/<(\w+)>\s*<\/\1>/g, '');
  }

  return result.trim();
}

/**
 * Level 3: Compact optimization
 * - Keeps XML structure intact
 * - Truncates long content (diffs, CDATA)
 * - Limits repeated elements (modules, files)
 * - Shortens absolute paths
 * - Removes low-priority sections
 *
 * Token savings: 15-25%
 */
function optimizeCompact(xml: string, options: OptimizeOptions = {}): string {
  const opts = { ...DEFAULT_COMPACT, ...options.compact };
  let result = optimizeSemantic(xml, options);

  // 1. Truncate CDATA sections (diffs, code blocks)
  result = truncateCdata(result, opts.maxDiffLines);

  // 2. Limit repeated elements
  result = limitRepeatedElements(result, opts.maxRepeatedItems);

  // 3. Shorten absolute paths
  if (opts.shortenPaths) {
    result = shortenAbsolutePaths(result);
  }

  // 4. Remove low-priority sections
  if (opts.removeLowPriority) {
    result = removeSections(result, LOW_PRIORITY_SECTIONS);
  }

  // 5. Compact attributes (remove verbose ones)
  result = removeVerboseAttributes(result);

  return result.trim();
}

/**
 * Level 4: Aggressive optimization (MAXIMUM)
 * - Everything from compact
 * - Shorten attribute names (name→n, path→p)
 * - Compress large numbers (12345→12.3K)
 * - Deduplicate repeated strings
 * - Context-aware section pruning
 *
 * Token savings: 40-60%
 */
function optimizeAggressive(xml: string, options: OptimizeOptions = {}): string {
  const opts = { ...DEFAULT_AGGRESSIVE, ...options.aggressive };
  let result = optimizeSemantic(xml, options);

  // 1. Context-aware pruning (if specified)
  if (opts.context) {
    result = pruneForContext(result, opts.context);
  }

  // 2. Truncate CDATA sections (more aggressive)
  result = truncateCdata(result, opts.maxDiffLines);

  // 3. Limit repeated elements (more aggressive)
  result = limitRepeatedElements(result, opts.maxRepeatedItems);

  // 4. Shorten absolute paths
  if (opts.shortenPaths) {
    result = shortenAbsolutePaths(result);
  }

  // 5. Remove more sections
  result = removeSections(result, AGGRESSIVE_REMOVE_SECTIONS);

  // 6. Shorten attribute names
  if (opts.shortenAttributes) {
    result = shortenAttributeNames(result);
  }

  // 7. Compress large numbers
  if (opts.compressNumbers) {
    result = compressNumbers(result);
  }

  // 8. Deduplicate repeated strings
  if (opts.deduplicateStrings) {
    result = deduplicateStrings(result);
  }

  // 9. Remove verbose attributes
  result = removeVerboseAttributes(result);

  // 10. Final cleanup - remove redundant wrapper tags
  result = removeRedundantWrappers(result);

  return result.trim();
}

// ============================================================================
// COMPACT HELPERS
// ============================================================================

/**
 * Truncate CDATA sections (diffs, code blocks)
 */
function truncateCdata(xml: string, maxLines: number): string {
  return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (match, content: string) => {
    const lines = content.split('\n');
    if (lines.length <= maxLines) return match;

    const truncated = lines.slice(0, maxLines).join('\n');
    const remaining = lines.length - maxLines;
    return `<![CDATA[${truncated}\n...+${remaining}]]>`;
  });
}

/**
 * Limit repeated elements (modules, files, commits)
 */
function limitRepeatedElements(xml: string, maxItems: number): string {
  let result = xml;

  for (const { parent, child } of REPEATED_ELEMENTS) {
    const parentRegex = new RegExp(
      `(<${parent}[^>]*>)((?:<${child}[^>]*(?:/>|>[^<]*</${child}>)\\s*)+)(</${parent}>)`,
      'gi',
    );

    result = result.replace(parentRegex, (match, open: string, children: string, close: string) => {
      const childRegex = new RegExp(`<${child}[^>]*(?:/>|>[^<]*</${child}>)`, 'gi');
      const childMatches = children.match(childRegex) || [];

      if (childMatches.length <= maxItems) return match;

      const kept = childMatches.slice(0, maxItems).join('');
      const remaining = childMatches.length - maxItems;

      return `${open}${kept}<+${remaining}/>${close}`;
    });
  }

  return result;
}

/**
 * Shorten absolute paths to relative
 */
function shortenAbsolutePaths(xml: string): string {
  return xml.replace(/(path|file|src)="([^"]+)"/g, (match, attr: string, path: string) => {
    if (path.startsWith('/Users/') || path.startsWith('/home/')) {
      const projectMatch = path.match(/\/(?:piternow[^/]*|krolik[^/]*)\/(.+)$/);
      if (projectMatch) {
        return `${attr}="${projectMatch[1]}"`;
      }
    }
    return match;
  });
}

/**
 * Remove specified sections
 */
function removeSections(xml: string, sections: string[]): string {
  let result = xml;

  for (const section of sections) {
    result = result.replace(new RegExp(`<${section}[^>]*/>`, 'gi'), '');
    result = result.replace(new RegExp(`<${section}[^>]*>[\\s\\S]*?</${section}>`, 'gi'), '');
  }

  return result;
}

/**
 * Remove verbose attributes
 */
function removeVerboseAttributes(xml: string): string {
  let result = xml;

  result = result.replace(/\s+sorted-by="[^"]*"/g, '');
  result = result.replace(/\s+deduplicated="true"/g, '');
  result = result.replace(/description="([^"]{60})[^"]*"/g, 'desc="$1..."');

  return result;
}

// ============================================================================
// AGGRESSIVE HELPERS
// ============================================================================

/**
 * Shorten common attribute names
 */
function shortenAttributeNames(xml: string): string {
  let result = xml;

  for (const [long, short] of Object.entries(ATTRIBUTE_SHORTCUTS)) {
    // Only replace standalone attribute names (word boundary)
    result = result.replace(new RegExp(`\\b${long}=`, 'g'), `${short}=`);
  }

  return result;
}

/**
 * Compress large numbers (1234 → 1.2K, 1234567 → 1.2M)
 */
function compressNumbers(xml: string): string {
  return xml.replace(/="(\d+)"/g, (match, num) => {
    const n = parseInt(num, 10);

    if (n >= 1_000_000) {
      return `="${(n / 1_000_000).toFixed(1)}M"`;
    }
    if (n >= 10_000) {
      return `="${(n / 1_000).toFixed(1)}K"`;
    }

    return match;
  });
}

/**
 * Deduplicate repeated long strings
 */
function deduplicateStrings(xml: string): string {
  // Find repeated long paths (>30 chars, appears 2+ times)
  const pathMatches = xml.match(/path="([^"]{30,})"/g) || [];
  const counts = new Map<string, number>();

  for (const m of pathMatches) {
    counts.set(m, (counts.get(m) || 0) + 1);
  }

  let result = xml;
  let refIndex = 0;
  const dict: string[] = [];

  for (const [fullMatch, count] of counts.entries()) {
    if (count >= 2) {
      const ref = `$${refIndex++}`;
      const pathValue = fullMatch.match(/path="([^"]+)"/)?.[1] || '';
      dict.push(`${ref}=${pathValue}`);
      result = result.split(fullMatch).join(`path="${ref}"`);
    }
  }

  // Add dictionary at the start if we have deduplications
  if (dict.length > 0) {
    result = `<_d>${dict.join('|')}</_d>${result}`;
  }

  return result;
}

/**
 * Prune sections based on AI context (conservative approach)
 * Only removes explicitly known low-value sections for each context
 */
function pruneForContext(xml: string, context: OptimizationContext): string {
  // Define what to REMOVE for each context (not what to keep)
  const CONTEXT_REMOVE: Record<OptimizationContext, string[]> = {
    architecture: ['reusable-modules', 'file-size-analysis', 'recent-commits'],
    'code-review': ['ai-config', 'reusable-modules', 'architecture-health'],
    refactoring: ['ai-config', 'git', 'recent-commits'],
    status: ['ai-config', 'reusable-modules', 'architecture-health', 'domains'],
  };

  const sectionsToRemove = CONTEXT_REMOVE[context] || [];
  return removeSections(xml, sectionsToRemove);
}

/**
 * Remove redundant wrapper tags
 */
function removeRedundantWrappers(xml: string): string {
  const wrappers = ['module-list', 'file-list', 'commit-list', 'items', 'entries'];

  let result = xml;
  for (const wrapper of wrappers) {
    result = result.replace(new RegExp(`<${wrapper}>([\\s\\S]*?)</${wrapper}>`, 'g'), '$1');
  }

  return result;
}

// ============================================================================
// MAIN OPTIMIZER
// ============================================================================

/**
 * Optimize XML for AI consumption
 *
 * @example
 * // Recommended: compact mode (best balance)
 * const result = optimizeXml(xml, { level: 'compact' });
 *
 * @example
 * // Maximum optimization
 * const result = optimizeXml(xml, {
 *   level: 'aggressive',
 *   aggressive: { context: 'code-review' }
 * });
 */
export function optimizeXml(xml: string, options: OptimizeOptions = {}): OptimizeResult {
  const originalSize = xml.length;

  // Determine optimization level
  let level: OptimizationLevel;

  if (options.auto) {
    if (originalSize < SIZE_THRESHOLDS.small) {
      level = 'minify';
    } else if (originalSize < SIZE_THRESHOLDS.medium) {
      level = 'compact';
    } else {
      level = 'aggressive';
    }
  } else {
    level = options.level ?? 'minify';
  }

  // Apply optimization
  let output: string;

  switch (level) {
    case 'aggressive':
      output = optimizeAggressive(xml, options);
      break;
    case 'compact':
      output = optimizeCompact(xml, options);
      break;
    case 'semantic':
      output = optimizeSemantic(xml, options);
      break;
    default:
      output = optimizeMinify(xml);
      break;
  }

  const optimizedSize = output.length;

  return {
    output,
    originalSize,
    optimizedSize,
    ratio: originalSize > 0 ? 1 - optimizedSize / originalSize : 0,
    level,
  };
}

/**
 * Quick optimize with auto-level selection
 */
export function optimizeXmlAuto(xml: string): string {
  return optimizeXml(xml, { auto: true }).output;
}

/**
 * Create XMLOptimizer instance for repeated use
 */
export class XMLOptimizer {
  private defaultOptions: OptimizeOptions;

  constructor(options: OptimizeOptions = {}) {
    this.defaultOptions = options;
  }

  optimize(xml: string, options?: OptimizeOptions): OptimizeResult {
    return optimizeXml(xml, { ...this.defaultOptions, ...options });
  }

  minify(xml: string): string {
    return optimizeXml(xml, { level: 'minify' }).output;
  }

  semantic(xml: string): string {
    return optimizeXml(xml, { level: 'semantic' }).output;
  }

  compact(xml: string, options?: CompactOptions): string {
    return optimizeXml(xml, options ? { level: 'compact', compact: options } : { level: 'compact' })
      .output;
  }

  aggressive(xml: string, options?: AggressiveOptions): string {
    return optimizeXml(
      xml,
      options ? { level: 'aggressive', aggressive: options } : { level: 'aggressive' },
    ).output;
  }

  auto(xml: string): string {
    return optimizeXml(xml, { auto: true }).output;
  }
}
