/**
 * @module lib/@detectors/patterns/backwards-compat
 * @description Detector for backwards-compatibility shim files
 *
 * Detects files that exist only for backwards compatibility and should be deleted:
 * - Files with @deprecated in module JSDoc
 * - Files that only re-export from another location
 * - Files with "Moved to", "Use X instead" comments
 *
 * Solo projects don't need backwards compatibility!
 */

// ============================================================================
// DETECTION PATTERNS
// ============================================================================

/**
 * Patterns that indicate a backwards-compat shim
 */
const DEPRECATED_PATTERNS = [
  // JSDoc @deprecated at module level
  /^\s*\/\*\*[\s\S]*?@deprecated[\s\S]*?\*\//m,
  // Comment: "Moved to X", "This module has been moved"
  /\/[/*]\s*(This\s+module\s+has\s+been\s+moved|Moved\s+to\s+@?[\w/@-]+)/i,
  // Comment: "Use X instead", "Import from X instead"
  /\/[/*]\s*(Use|Import\s+from)\s+['"`]?@?[\w/@.-]+['"`]?\s+instead/i,
  // Comment: "DEPRECATED"
  /\/[/*]\s*DEPRECATED\s*[:.-]/i,
];

/**
 * Patterns for re-export only files
 */
const REEXPORT_PATTERNS = [
  // export { ... } from '...'
  /^export\s*\{[^}]+\}\s*from\s*['"][^'"]+['"]/gm,
  // export * from '...'
  /^export\s*\*\s*from\s*['"][^'"]+['"]/gm,
  // export type { ... } from '...'
  /^export\s+type\s*\{[^}]+\}\s*from\s*['"][^'"]+['"]/gm,
];

/**
 * Result of backwards-compat detection
 */
export interface BackwardsCompatDetection {
  /** File is a backwards-compat shim */
  isShim: boolean;
  /** Confidence level 0-100 */
  confidence: number;
  /** Reason for detection */
  reason: string;
  /** Suggested action */
  suggestion: string;
  /** Target location (where code moved to) */
  movedTo?: string;
  /** Lines with deprecation markers */
  deprecatedLines: number[];
}

// ============================================================================
// DETECTION LOGIC
// ============================================================================

/**
 * Count non-empty, non-comment lines of actual code
 */
function countCodeLines(content: string): number {
  const lines = content.split('\n');
  let codeLines = 0;

  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track block comments
    if (trimmed.startsWith('/*') && !trimmed.includes('*/')) {
      inBlockComment = true;
      continue;
    }
    if (inBlockComment) {
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    // Skip empty lines and single-line comments
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      continue;
    }

    // Skip import/export statements for code count
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
      continue;
    }

    codeLines++;
  }

  return codeLines;
}

/**
 * Count re-export statements
 */
function countReexports(content: string): number {
  let count = 0;
  for (const pattern of REEXPORT_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * Extract "moved to" target from content
 */
function extractMovedTo(content: string): string | undefined {
  // Try to find "Moved to @/lib/foo" - require lowercase letter after last /
  // This avoids matching placeholders like "@/lib/X" in documentation
  const movedToMatch = content.match(
    /Moved\s+to\s+['"`]?(@[\w/@.-]+\/[a-z][\w-]*|\.\.?\/[\w/@.-]+)['"`]?/i,
  );
  if (movedToMatch) return movedToMatch[1];

  const importFromMatch = content.match(
    /Import\s+(?:from\s+)?['"`]?(@[\w/@.-]+|\.\.?\/[\w/@.-]+)['"`]?\s+instead/i,
  );
  if (importFromMatch) return importFromMatch[1];

  // Try to find target from re-exports
  const reexportMatch = content.match(/export\s*\*\s*from\s*['"]([^'"]+)['"]/);
  if (reexportMatch) return reexportMatch[1];

  return undefined;
}

/**
 * Find lines with deprecation markers
 */
function findDeprecatedLines(content: string): number[] {
  const lines = content.split('\n');
  const deprecatedLines: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (
      line.includes('@deprecated') ||
      /\/[/*]\s*DEPRECATED/i.test(line) ||
      /\/[/*]\s*(Moved\s+to|Use\s+.*instead)/i.test(line)
    ) {
      deprecatedLines.push(i + 1);
    }
  }

  return deprecatedLines;
}

/**
 * Detect if a file is a backwards-compatibility shim
 */
export function detectBackwardsCompat(content: string, filepath: string): BackwardsCompatDetection {
  // Skip self-detection (this file describes the pattern, not a shim itself)
  if (filepath.includes('backwards-compat')) {
    return {
      isShim: false,
      confidence: 0,
      reason: 'detector file excluded',
      suggestion: 'File appears to contain active code',
      deprecatedLines: [],
    };
  }

  const deprecatedLines = findDeprecatedLines(content);
  const movedTo = extractMovedTo(content);
  const codeLines = countCodeLines(content);
  const reexportCount = countReexports(content);

  // Check for deprecated patterns
  let hasDeprecatedPattern = false;
  for (const pattern of DEPRECATED_PATTERNS) {
    if (pattern.test(content)) {
      hasDeprecatedPattern = true;
      break;
    }
  }

  // Calculate confidence
  let confidence = 0;
  const reasons: string[] = [];

  // Strong signals
  if (hasDeprecatedPattern) {
    confidence += 40;
    reasons.push('@deprecated marker found');
  }

  if (movedTo) {
    confidence += 30;
    reasons.push(`redirects to ${movedTo}`);
  }

  // Re-export only file (no actual code) - but only if deprecated
  // Normal index.ts barrel exports are not shims
  if (reexportCount > 0 && codeLines === 0 && hasDeprecatedPattern) {
    confidence += 30;
    reasons.push('only contains re-exports');
  }

  // Small file with deprecation markers
  if (deprecatedLines.length > 0 && codeLines < 10) {
    confidence += 20;
    reasons.push('small file with deprecation');
  }

  // Check if it's an index.ts that just re-exports
  const isIndexFile = filepath.endsWith('/index.ts') || filepath.endsWith('\\index.ts');
  if (isIndexFile && reexportCount > 0 && hasDeprecatedPattern) {
    confidence += 10;
    reasons.push('deprecated index file');
  }

  const isShim = confidence >= 50;

  // Build result with conditionally included optional properties
  const result: BackwardsCompatDetection = {
    isShim,
    confidence: Math.min(100, confidence),
    reason: reasons.join(', ') || 'no backwards-compat patterns found',
    suggestion: isShim
      ? `Delete this file and update imports to use ${movedTo || 'the new location'} directly`
      : 'File appears to contain active code',
    deprecatedLines,
  };

  // Only add movedTo if it's defined
  if (movedTo) {
    result.movedTo = movedTo;
  }

  return result;
}

/**
 * Check if a file should be flagged as backwards-compat shim
 * Returns true if confidence >= threshold (default 50)
 */
export function isBackwardsCompatShim(content: string, filepath: string, threshold = 50): boolean {
  const detection = detectBackwardsCompat(content, filepath);
  return detection.confidence >= threshold;
}

// ============================================================================
// BATCH DETECTION
// ============================================================================

/**
 * Backwards-compat file info
 */
export interface BackwardsCompatFile {
  path: string;
  detection: BackwardsCompatDetection;
}

/**
 * Detect backwards-compat files from a list
 */
export function detectBackwardsCompatFiles(
  files: Array<{ path: string; content: string }>,
  threshold = 50,
): BackwardsCompatFile[] {
  const results: BackwardsCompatFile[] = [];

  for (const file of files) {
    const detection = detectBackwardsCompat(file.content, file.path);
    if (detection.confidence >= threshold) {
      results.push({
        path: file.path,
        detection,
      });
    }
  }

  // Sort by confidence (highest first)
  return results.sort((a, b) => b.detection.confidence - a.detection.confidence);
}
