/**
 * @module commands/quality/analyzers
 * @description Code quality analyzers - orchestrates all analysis modules
 */

import * as path from 'node:path';
import { fileCache } from '@/lib';
import type { FileAnalysis, QualityOptions } from '../types';

// Internal imports (only what's used in this file)
import { extractFunctionsSwc } from './complexity-swc';
import { checkMixedConcerns } from './concerns';
import { detectFileType } from './detectors';
import { checkDocumentation } from './documentation';
import { checkReturnTypesSwc } from './return-types-swc';
import { checkSRP } from './srp';
import { buildThresholds, getThresholdsForPath } from './thresholds';
import { analyzeFileUnified } from './unified-swc';

// Re-export all analyzer functions
export {
  analyzeSplitPointsSwc as analyzeSplitPoints,
  calculateComplexitySwc as calculateComplexity,
  extractFunctionsSwc as extractFunctions,
} from './complexity-swc';
export { checkMixedConcerns } from './concerns';
export { detectFileType } from './detectors';
export { checkDocumentation } from './documentation';
export { detectHardcodedValues } from './hardcoded';
export { checkLintRules_all as checkLintRules, isCliFile, type LintOptions } from './lint-rules';
export { checkReturnTypesSwc } from './return-types-swc';
export { checkSRP } from './srp';
export { buildThresholds, getThresholdsForPath } from './thresholds';
export { checkTypeSafety } from './type-safety';
export {
  analyzeFileUnified,
  checkLintRulesSwc,
  checkTypeSafetySwc,
  detectHardcodedSwc,
} from './unified-swc';

const ERROR_CODE = 30;

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
  const functions = extractFunctionsSwc(content);

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

  // ⭐ UNIFIED SWC ANALYZER - Single parse/visit pass for lint, type-safety, security, modernization, and hardcoded detection
  // 5x faster than running separate analyzers (single parseSync + visitNode pass)
  const { lintIssues, typeSafetyIssues, securityIssues, modernizationIssues, hardcodedValues } =
    analyzeFileUnified(content, relativePath);

  // Add all issues directly
  analysis.issues.push(...lintIssues);
  analysis.issues.push(...typeSafetyIssues);
  analysis.issues.push(...securityIssues);
  analysis.issues.push(...modernizationIssues);

  // Convert hardcoded values to quality issues
  for (const hv of hardcodedValues) {
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

  // Return types analyzer (separate from unified for modularity)
  analysis.issues.push(...checkReturnTypesSwc(content, relativePath));

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
