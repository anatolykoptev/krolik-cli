/**
 * @module commands/quality/analyzers/concerns
 * @description Mixed concerns detection (UI + logic in same file)
 */

import type { QualityIssue } from '../types';

/**
 * Patterns indicating different concerns
 */
const CONCERN_PATTERNS = {
  ui: [/className\s*=/, /style\s*=/, /<\w+.*>/, /return\s*\(/, /useState|useEffect|useRef/],
  logic: [
    /async\s+function/,
    /await\s+/,
    /fetch\(/,
    /prisma\./,
    /\.create\(|\.update\(|\.delete\(/,
  ],
  validation: [/z\.\w+\(/, /\.parse\(/, /\.safeParse\(/, /yup\./],
  api: [/router\s*\(/, /procedure\s*\(/, /createTRPCRouter/, /mutation\s*\(/, /query\s*\(/],
};

/**
 * Minimum pattern matches to consider a concern present
 */
const MIN_CONCERN_MATCHES = 2;

/**
 * File types that can have mixed patterns (excluded from checks)
 */
const EXCLUDED_FILE_TYPES = new Set(['hook', 'util', 'test', 'config']);

/**
 * Check for mixed concerns (UI + logic in same file)
 */
export function checkMixedConcerns(
  content: string,
  filepath: string,
  fileType: string,
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Skip hooks, utils, tests - they can have mixed patterns
  if (EXCLUDED_FILE_TYPES.has(fileType)) {
    return issues;
  }

  const detectedConcerns: string[] = [];

  for (const [concern, patterns] of Object.entries(CONCERN_PATTERNS)) {
    const matches = patterns.filter((p) => p.test(content));
    if (matches.length >= MIN_CONCERN_MATCHES) {
      detectedConcerns.push(concern);
    }
  }

  // Component with heavy logic
  if (
    fileType === 'component' &&
    detectedConcerns.includes('logic') &&
    detectedConcerns.includes('ui')
  ) {
    // Check if it's significant logic (not just simple fetch)
    const logicPatterns = CONCERN_PATTERNS.logic.filter((p) => p.test(content));
    if (logicPatterns.length >= MIN_CONCERN_MATCHES) {
      issues.push({
        file: filepath,
        severity: 'warning',
        category: 'mixed-concerns',
        message: 'Component contains significant business logic',
        suggestion: 'Extract logic to custom hook (useXxx) or service file',
      });
    }
  }

  // Router with validation inline (should use shared schemas)
  if (fileType === 'router' && detectedConcerns.includes('validation')) {
    // Check if validation is inline (not imported)
    const hasInlineSchema = /input:\s*z\.\w+\(\{/.test(content);
    if (hasInlineSchema) {
      issues.push({
        file: filepath,
        severity: 'info',
        category: 'mixed-concerns',
        message: 'Router has inline Zod schemas',
        suggestion: 'Extract schemas to shared/src/schemas/ for reuse',
      });
    }
  }

  return issues;
}
