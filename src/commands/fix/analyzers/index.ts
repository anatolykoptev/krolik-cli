/**
 * @module commands/quality/analyzers
 * @description Code quality analyzers - orchestrates all analysis modules
 */

import * as path from 'node:path';
import { fileCache } from '@/lib';
import type { FileAnalysis, QualityOptions } from '../types';

const ERROR_CODE = 30;

export { analyzeSplitPoints, calculateComplexity, extractFunctions } from './complexity';
export { checkMixedConcerns } from './concerns';
// Re-export all analyzer functions
export { detectFileType } from './detectors';
export { checkDocumentation } from './documentation';
export { detectHardcodedValues } from './hardcoded';
export { detectHardcodedSwc } from './hardcoded-swc';
export { checkLintRules_all as checkLintRules, isCliFile, type LintOptions } from './lint-rules';
export { checkLintRulesSwc } from './lint-rules-swc';
export { checkSRP } from './srp';
export { buildThresholds, getThresholdsForPath } from './thresholds';
export { checkTypeSafety } from './type-safety';
export { checkTypeSafetySwc } from './type-safety-swc';

import { extractFunctions } from './complexity';
import { checkMixedConcerns } from './concerns';
// Import for internal use
import { detectFileType } from './detectors';
import { checkDocumentation } from './documentation';
import { detectHardcodedValues } from './hardcoded';
import { detectHardcodedSwc } from './hardcoded-swc';
import { checkLintRules_all } from './lint-rules';
import { checkLintRulesSwc } from './lint-rules-swc';
import { checkSRP } from './srp';
import { buildThresholds, getThresholdsForPath } from './thresholds';
import { checkTypeSafety } from './type-safety';
import { checkTypeSafetySwc } from './type-safety-swc';

/** Use SWC AST-based analyzers (more accurate, no false positives) */
const USE_SWC_ANALYZERS = true;

/**
 * Analyze a single file for quality issues
 * Main entry point that orchestrates all analyzers
 */
export function analyzeFile(
  filepath: string,
  projectRoot: string,
  options: QualityOptions = {},
): FileAnalysis {
  const content = fileCache.get(filepath);
  const lines = content.split('\n');
  const relativePath = path.relative(projectRoot, filepath);

  // Basic metrics
  const blankLines = lines.filter((l) => l.trim() === '').length;
  const commentLines = lines.filter((l) => {
    const t = l.trim();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  }).length;
  const codeLines = lines.length - blankLines - commentLines;

  // Count exports and imports
  const exports = (content.match(/^export\s+/gm) || []).length;
  const imports = (content.match(/^import\s+/gm) || []).length;

  // Detect file type
  const fileType = detectFileType(filepath, content);

  // Extract functions
  const functions = extractFunctions(content);

  // Initialize analysis
  const analysis: FileAnalysis = {
    path: filepath,
    relativePath,
    lines: lines.length,
    blankLines,
    commentLines,
    codeLines,
    functions,
    exports,
    imports,
    fileType,
    issues: [],
  };

  // Build base thresholds from options
  const baseThresholds = buildThresholds(options);

  // Apply path-based overrides
  const thresholds = getThresholdsForPath(relativePath, baseThresholds, options.overrides);

  // Run all analyzers
  analysis.issues.push(...checkSRP(analysis, thresholds));
  analysis.issues.push(...checkMixedConcerns(content, relativePath, fileType));
  analysis.issues.push(...checkDocumentation(functions, relativePath, thresholds.requireJSDoc));

  // Type safety: use SWC AST-based analyzer for better accuracy
  if (USE_SWC_ANALYZERS) {
    analysis.issues.push(...checkTypeSafetySwc(content, relativePath));
  } else {
    analysis.issues.push(...checkTypeSafety(content, relativePath));
  }

  // Lint rules: use SWC AST-based analyzer (no false positives in strings/comments)
  if (USE_SWC_ANALYZERS) {
    analysis.issues.push(...checkLintRulesSwc(content, relativePath));
  } else {
    analysis.issues.push(
      ...checkLintRules_all(content, relativePath, {
        ignoreCliConsole: options.ignoreCliConsole ?? false,
      }),
    );
  }

  // Hardcoded values: use SWC AST-based analyzer for context-aware detection
  if (USE_SWC_ANALYZERS) {
    const hardcoded = detectHardcodedSwc(content, filepath);
    for (const hv of hardcoded) {
      analysis.issues.push({
        file: relativePath,
        line: hv.line,
        severity: hv.type === 'string' ? 'warning' : 'info',
        category: 'hardcoded',
        message: `Hardcoded ${hv.type}: ${String(hv.value).slice(0, ERROR_CODE)}`,
        suggestion: getSuggestionForHardcoded(hv.type),
        snippet: hv.context,
      });
    }
  } else {
    const hardcoded = detectHardcodedValues(content, filepath);
    for (const hv of hardcoded) {
      analysis.issues.push({
        file: relativePath,
        line: hv.line,
        severity: hv.type === 'string' ? 'warning' : 'info',
        category: 'hardcoded',
        message: `Hardcoded ${hv.type}: ${String(hv.value).slice(0, ERROR_CODE)}`,
        suggestion: getSuggestionForHardcoded(hv.type),
        snippet: hv.context,
      });
    }
  }

  return analysis;
}

/**
 * Get suggestion for hardcoded value type
 */
function getSuggestionForHardcoded(type: string): string {
  switch (type) {
    case 'string':
      return 'Move to i18n translations';
    case 'number':
      return 'Extract to named constant';
    case 'url':
      return 'Move to environment variable or config';
    default:
      return 'Extract to theme/constants';
  }
}
