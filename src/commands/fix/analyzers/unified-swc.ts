/**
 * @module commands/fix/analyzers/unified-swc
 * @description Unified SWC AST analyzer - single parse + visit pass for all detections
 *
 * Combines three analyzers into one:
 * - lint-rules-swc.ts (console, debugger, alert, eval)
 * - type-safety-swc.ts (any, as any, @ts-expect-error, non-null assertion)
 * - hardcoded-swc.ts (magic numbers, URLs, hex colors)
 *
 * Performance benefits:
 * - Single parseSync() call instead of 3
 * - Single visitNode() pass instead of 3
 * - Shared lineOffsets calculation
 * - 3x reduction in AST overhead
 *
 * Usage:
 * ```typescript
 * import { analyzeFileUnified } from './unified-swc';
 *
 * const { lintIssues, typeSafetyIssues, hardcodedValues } = analyzeFileUnified(content, filepath);
 * ```
 */

import type { Node, Span } from '@swc/core';
import { parseSync } from '@swc/core';
import { isCliFile } from '../../../lib/@context';
import { shouldSkipForAnalysis } from '../../../lib/@patterns';
import { shouldSkipFile } from '../../../lib/@patterns/hardcoded/index';
import { calculateLineOffsets, getContext, getSnippet, offsetToLine } from '../../../lib/@swc';
import {
  type DetectorContext,
  detectHardcodedValue,
  detectLintIssue,
  detectModernizationIssue,
  detectSecurityIssue,
  detectTypeSafetyIssue,
  type HardcodedDetection,
  isInConstDeclaration,
  type LintDetection,
  type ModernizationDetection,
  type SecurityDetection,
  type TypeSafetyDetection,
} from '../../../lib/@swc/detectors';
import type { HardcodedValue, QualityIssue } from '../types';

// Note: All detection types and functions are now imported from lib/@swc/detectors

// ============================================================================
// UNIFIED ANALYSIS RESULT
// ============================================================================

/**
 * Unified analysis result containing all detected issues
 */
export interface UnifiedAnalysisResult {
  /** Lint issues (console, debugger, alert, eval, empty-catch) */
  lintIssues: QualityIssue[];
  /** Type-safety issues (any, as any, @ts-expect-error, non-null assertion) */
  typeSafetyIssues: QualityIssue[];
  /** Security issues (command injection, path traversal) */
  securityIssues: QualityIssue[];
  /** Modernization issues (require, legacy patterns) */
  modernizationIssues: QualityIssue[];
  /** Hardcoded values (magic numbers, URLs, hex colors) */
  hardcodedValues: HardcodedValue[];
}

// ============================================================================
// MAIN UNIFIED ANALYZER
// ============================================================================

/**
 * Analyze file using unified SWC AST pass
 *
 * Performs single parse + single visit pass to detect:
 * 1. Lint issues: console, debugger, alert, eval, empty-catch
 * 2. Type-safety issues: any, as any, @ts-expect-error, non-null assertion
 * 3. Security issues: command injection, path traversal
 * 4. Modernization issues: require, legacy patterns
 * 5. Hardcoded values: magic numbers, URLs, hex colors
 *
 * @param content - File content
 * @param filepath - File path
 * @returns Unified analysis result
 */
export function analyzeFileUnified(content: string, filepath: string): UnifiedAnalysisResult {
  const result: UnifiedAnalysisResult = {
    lintIssues: [],
    typeSafetyIssues: [],
    securityIssues: [],
    modernizationIssues: [],
    hardcodedValues: [],
  };

  // Skip infrastructure files
  const shouldSkipLint = shouldSkipForAnalysis(filepath);
  const shouldSkipTypeSafety =
    filepath.endsWith('.d.ts') ||
    filepath.includes('.test.') ||
    filepath.includes('.spec.') ||
    shouldSkipForAnalysis(filepath);
  const shouldSkipSecurity = shouldSkipForAnalysis(filepath);
  const shouldSkipModernization = shouldSkipForAnalysis(filepath);
  const shouldSkipHardcoded = shouldSkipFile(filepath);

  // If all analyzers should skip, return empty result
  if (
    shouldSkipLint &&
    shouldSkipTypeSafety &&
    shouldSkipSecurity &&
    shouldSkipModernization &&
    shouldSkipHardcoded
  ) {
    return result;
  }

  const isCli = isCliFile(filepath);

  try {
    // Determine syntax based on file extension
    const isTypeScript = filepath.endsWith('.ts') || filepath.endsWith('.tsx');
    const isJsx = filepath.endsWith('.jsx') || filepath.endsWith('.tsx');

    // ⭐ SINGLE PARSE - Parse file once with SWC
    const ast = parseSync(content, {
      syntax: isTypeScript ? 'typescript' : 'ecmascript',
      ...(isTypeScript && isJsx ? { tsx: true } : {}),
      ...(!isTypeScript && isJsx ? { jsx: true } : {}),
      comments: true, // Enable for @ts-ignore detection
    });

    // Workaround for SWC global state bug (span offset accumulation)
    let baseOffset = 0;
    if (ast.body.length > 0) {
      const firstStmt = ast.body[0] as { span?: Span };
      if (firstStmt.span) {
        baseOffset = firstStmt.span.start - 1; // Adjust to 0-based
      }
    }

    // ⭐ SHARED LINE OFFSETS - Calculate once
    const lineOffsets = calculateLineOffsets(content);

    // Collect detections from single AST pass
    const lintDetections: LintDetection[] = [];
    const typeSafetyDetections: TypeSafetyDetection[] = [];
    const securityDetections: SecurityDetection[] = [];
    const modernizationDetections: ModernizationDetection[] = [];
    const hardcodedDetections: HardcodedDetection[] = [];

    // ⭐ SINGLE VISIT - Visit AST once and collect all issue types
    visitNodeUnified(
      ast,
      content,
      filepath,
      {
        skipLint: shouldSkipLint,
        skipTypeSafety: shouldSkipTypeSafety,
        skipSecurity: shouldSkipSecurity,
        skipModernization: shouldSkipModernization,
        skipHardcoded: shouldSkipHardcoded,
      },
      lintDetections,
      typeSafetyDetections,
      securityDetections,
      modernizationDetections,
      hardcodedDetections,
      {
        isTopLevel: true,
        inConstDeclaration: undefined,
        inMemberExpression: undefined,
        parentType: undefined,
      },
    );

    // Convert detections to quality issues
    if (!shouldSkipLint) {
      for (const detection of lintDetections) {
        // Skip console in CLI files
        if (detection.type === 'console' && isCli) {
          continue;
        }

        const issue = createLintIssue(detection, filepath, content, lineOffsets, baseOffset);
        if (issue) {
          result.lintIssues.push(issue);
        }
      }
    }

    if (!shouldSkipTypeSafety) {
      for (const detection of typeSafetyDetections) {
        const issue = createTypeSafetyIssue(detection, filepath, content, lineOffsets, baseOffset);
        if (issue) {
          result.typeSafetyIssues.push(issue);
        }
      }
    }

    if (!shouldSkipSecurity) {
      for (const detection of securityDetections) {
        const issue = createSecurityIssue(detection, filepath, content, lineOffsets, baseOffset);
        if (issue) {
          result.securityIssues.push(issue);
        }
      }
    }

    if (!shouldSkipModernization) {
      for (const detection of modernizationDetections) {
        const issue = createModernizationIssue(
          detection,
          filepath,
          content,
          lineOffsets,
          baseOffset,
        );
        if (issue) {
          result.modernizationIssues.push(issue);
        }
      }
    }

    if (!shouldSkipHardcoded) {
      for (const detection of hardcodedDetections) {
        const value = createHardcodedValue(detection, content, lineOffsets, baseOffset);
        if (value) {
          result.hardcodedValues.push(value);
        }
      }
    }

    // Check @ts-expect-error/@ts-nocheck in comments (regex-based, no AST needed)
    if (!shouldSkipTypeSafety) {
      result.typeSafetyIssues.push(...checkTsDirectives(content, filepath));
    }
  } catch {
    // Parse error - return empty results
  }

  return result;
}

// ============================================================================
// BACKWARD COMPATIBILITY WRAPPERS
// ============================================================================

/**
 * Check lint rules using unified analyzer
 * (Backward-compatible wrapper for lint-rules-swc.ts)
 */
export function checkLintRulesSwc(content: string, filepath: string): QualityIssue[] {
  const { lintIssues } = analyzeFileUnified(content, filepath);
  return lintIssues;
}

/**
 * Check type-safety issues using unified analyzer
 * (Backward-compatible wrapper for type-safety-swc.ts)
 */
export function checkTypeSafetySwc(content: string, filepath: string): QualityIssue[] {
  const { typeSafetyIssues } = analyzeFileUnified(content, filepath);
  return typeSafetyIssues;
}

/**
 * Detect hardcoded values using unified analyzer
 * (Backward-compatible wrapper for hardcoded-swc.ts)
 */
export function detectHardcodedSwc(content: string, filepath: string): HardcodedValue[] {
  const { hardcodedValues } = analyzeFileUnified(content, filepath);
  return hardcodedValues;
}

// ============================================================================
// UNIFIED AST VISITOR
// ============================================================================

interface SkipOptions {
  skipLint: boolean;
  skipTypeSafety: boolean;
  skipSecurity: boolean;
  skipModernization: boolean;
  skipHardcoded: boolean;
}

/**
 * Unified AST visitor - single pass collecting all issue types
 */
function visitNodeUnified(
  node: Node,
  content: string,
  filepath: string,
  skipOptions: SkipOptions,
  lintDetections: LintDetection[],
  typeSafetyDetections: TypeSafetyDetection[],
  securityDetections: SecurityDetection[],
  modernizationDetections: ModernizationDetection[],
  hardcodedDetections: HardcodedDetection[],
  context: DetectorContext,
  visited = new WeakSet<object>(),
): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  // Prevent infinite loops from circular references
  if (visited.has(node)) {
    return;
  }
  visited.add(node);

  const nodeType = (node as { type?: string }).type;
  const span = (node as { span?: Span }).span;

  // Update context for MemberExpression
  let inMemberExpression = context.inMemberExpression;
  if (nodeType === 'MemberExpression') {
    const property = (node as { property?: { type?: string } }).property;
    inMemberExpression = property?.type === 'Computed';
  }

  // Update context based on current node
  const newContext: DetectorContext = {
    isTopLevel: context.isTopLevel && nodeType !== 'FunctionDeclaration',
    inConstDeclaration: isInConstDeclaration(node, context),
    inMemberExpression: inMemberExpression,
    parentType: nodeType ?? undefined,
  };

  // ⭐ LINT DETECTION
  if (!skipOptions.skipLint && span) {
    const lintDetection = detectLintIssue(node);
    if (lintDetection) {
      lintDetections.push(lintDetection);
    }
  }

  // ⭐ TYPE-SAFETY DETECTION
  if (!skipOptions.skipTypeSafety && span) {
    const typeSafetyDetection = detectTypeSafetyIssue(node);
    if (typeSafetyDetection) {
      typeSafetyDetections.push(typeSafetyDetection);
    }
  }

  // ⭐ SECURITY DETECTION
  if (!skipOptions.skipSecurity && span) {
    const securityDetection = detectSecurityIssue(node);
    if (securityDetection) {
      securityDetections.push(securityDetection);
    }
  }

  // ⭐ MODERNIZATION DETECTION
  if (!skipOptions.skipModernization && span) {
    const modernizationDetection = detectModernizationIssue(node);
    if (modernizationDetection) {
      modernizationDetections.push(modernizationDetection);
    }
  }

  // ⭐ HARDCODED VALUE DETECTION
  if (!skipOptions.skipHardcoded && span) {
    const hardcodedDetection = detectHardcodedValue(node, content, filepath, newContext, context);
    if (hardcodedDetection) {
      hardcodedDetections.push(hardcodedDetection);
    }
  }

  // Visit children
  for (const key of Object.keys(node)) {
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          visitNodeUnified(
            item as Node,
            content,
            filepath,
            skipOptions,
            lintDetections,
            typeSafetyDetections,
            securityDetections,
            modernizationDetections,
            hardcodedDetections,
            newContext,
            visited,
          );
        }
      }
    } else if (value && typeof value === 'object' && key !== 'span') {
      visitNodeUnified(
        value as Node,
        content,
        filepath,
        skipOptions,
        lintDetections,
        typeSafetyDetections,
        securityDetections,
        modernizationDetections,
        hardcodedDetections,
        newContext,
        visited,
      );
    }
  }
}

// Note: detectLintIssue is now imported from lib/@swc/detectors

// Note: detectSecurityIssue is now imported from lib/@swc/detectors

// Note: detectModernizationIssue is now imported from lib/@swc/detectors

// Note: detectTypeSafetyIssue and isAnyType are now imported from lib/@swc/detectors

// Note: isInConstDeclaration, isArrayIndex, and detectHardcodedValue are now imported from lib/@swc/detectors

// ============================================================================
// ISSUE CREATION
// ============================================================================

/**
 * Create quality issue from lint detection
 */
function createLintIssue(
  detection: LintDetection,
  filepath: string,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
): QualityIssue | null {
  // Adjust for SWC's global offset accumulation bug
  const adjustedOffset = detection.offset - baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, lineOffsets);
  const snippet = getSnippet(content, adjustedOffset, lineOffsets);

  switch (detection.type) {
    case 'console':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'lint',
        message: `Unexpected console statement: console.${detection.method ?? 'log'}`,
        suggestion: 'Remove console statement or use a proper logging library',
        snippet,
        fixerId: 'no-console',
      };

    case 'debugger':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'error',
        category: 'lint',
        message: 'Unexpected debugger statement',
        suggestion: 'Remove debugger statement before committing',
        snippet,
        fixerId: 'no-debugger',
      };

    case 'alert':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'lint',
        message: `Unexpected native dialog: ${detection.method ?? 'alert'}()`,
        suggestion: 'Use a modal component instead of native browser dialogs',
        snippet,
        fixerId: 'no-alert',
      };

    case 'eval':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'error',
        category: 'lint',
        message: 'eval() is a security risk',
        suggestion:
          'Avoid eval() - use safer alternatives like JSON.parse() or Function constructor',
        snippet,
        fixerId: 'no-eval',
      };

    case 'empty-catch':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'lint',
        message: 'Empty catch block',
        suggestion: 'Add error handling logic or at minimum log the error',
        snippet,
        fixerId: 'no-empty-catch',
      };

    default:
      return null;
  }
}

/**
 * Create quality issue from type-safety detection
 */
function createTypeSafetyIssue(
  detection: TypeSafetyDetection,
  filepath: string,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
): QualityIssue | null {
  const adjustedOffset = detection.offset - baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, lineOffsets);
  const snippet = getSnippet(content, adjustedOffset, lineOffsets);

  switch (detection.type) {
    case 'any-annotation':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'type-safety',
        message: 'Using `any` type',
        suggestion: 'Use proper TypeScript types, `unknown`, or generics',
        snippet,
        fixerId: 'no-any',
      };

    case 'any-assertion':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'type-safety',
        message: 'Type assertion to `any`',
        suggestion: 'Use proper type assertion or fix the underlying type issue',
        snippet,
        fixerId: 'no-any',
      };

    case 'non-null':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'info',
        category: 'type-safety',
        message: 'Non-null assertion operator (!)',
        suggestion: 'Use optional chaining (?.) or proper null checks',
        snippet,
        fixerId: 'no-non-null-assertion',
      };

    case 'any-param':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'type-safety',
        message: 'Using `any` in parameter type',
        suggestion: 'Use proper TypeScript parameter type or `unknown`',
        snippet,
        fixerId: 'no-any',
      };

    case 'any-array':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'type-safety',
        message: 'Using `any[]` array type',
        suggestion: 'Use proper array element type',
        snippet,
        fixerId: 'no-any',
      };

    case 'double-assertion':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'info',
        category: 'type-safety',
        message: 'Double type assertion (as unknown as)',
        suggestion: 'Consider using proper type guards or fixing the underlying type issue',
        snippet,
        fixerId: 'no-double-assertion',
      };

    default:
      return null;
  }
}

/**
 * Create quality issue from security detection
 */
function createSecurityIssue(
  detection: SecurityDetection,
  filepath: string,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
): QualityIssue | null {
  const adjustedOffset = detection.offset - baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, lineOffsets);
  const snippet = getSnippet(content, adjustedOffset, lineOffsets);

  switch (detection.type) {
    case 'command-injection':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'error',
        category: 'security',
        message: `Command injection risk: ${detection.method ?? 'execSync'}() with template literal`,
        suggestion: 'Validate and sanitize user input, or use execFile with array arguments',
        snippet,
        fixerId: 'no-command-injection',
      };

    case 'path-traversal':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'security',
        message: `Path traversal risk: ${detection.method ?? 'path.join'}() with unvalidated input`,
        suggestion:
          'Validate path components before joining, or use path.normalize() and check boundaries',
        snippet,
        fixerId: 'no-path-traversal',
      };

    default:
      return null;
  }
}

/**
 * Create quality issue from modernization detection
 */
function createModernizationIssue(
  detection: ModernizationDetection,
  filepath: string,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
): QualityIssue | null {
  const adjustedOffset = detection.offset - baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, lineOffsets);
  const snippet = getSnippet(content, adjustedOffset, lineOffsets);

  switch (detection.type) {
    case 'require':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'modernization',
        message: `Legacy ${detection.method ?? 'require'}() call`,
        suggestion: 'Use ES6 import instead: import x from "module"',
        snippet,
        fixerId: 'no-require',
      };

    default:
      return null;
  }
}

/**
 * Create hardcoded value from detection
 */
function createHardcodedValue(
  detection: HardcodedDetection,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
): HardcodedValue | null {
  const adjustedOffset = detection.offset - baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, lineOffsets);
  const context = getContext(content, adjustedOffset, lineOffsets);

  return {
    value: detection.value,
    type: detection.type,
    line: lineNumber,
    context,
  };
}

/**
 * Check for @ts-expect-error and @ts-nocheck in comments
 */
function checkTsDirectives(content: string, filepath: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Check for @ts-expect-error
    if (/@ts-ignore/.test(trimmed)) {
      // Skip if it's inside a string literal
      const firstQuote = trimmed.indexOf("'");
      const firstDoubleQuote = trimmed.indexOf('"');
      const firstBacktick = trimmed.indexOf('`');
      const commentPos = trimmed.indexOf('@ts-ignore');

      const inString =
        (firstQuote !== -1 && firstQuote < commentPos) ||
        (firstDoubleQuote !== -1 && firstDoubleQuote < commentPos) ||
        (firstBacktick !== -1 && firstBacktick < commentPos);

      if (!inString) {
        issues.push({
          file: filepath,
          line: i + 1,
          severity: 'error',
          category: 'type-safety',
          message: '@ts-ignore suppresses TypeScript errors',
          suggestion: 'Fix the type error instead of ignoring it',
          snippet: trimmed.slice(0, 80),
          fixerId: 'no-ts-ignore',
        });
      }
    }

    // Check for @ts-nocheck (typically at top of file)
    if (/@ts-nocheck/.test(trimmed)) {
      issues.push({
        file: filepath,
        line: i + 1,
        severity: 'error',
        category: 'type-safety',
        message: '@ts-nocheck disables TypeScript checking for entire file',
        suggestion: 'Remove @ts-nocheck and fix type errors',
        snippet: trimmed.slice(0, 80),
        fixerId: 'no-ts-ignore',
      });
    }

    // Check for @ts-expect-error without explanation
    if (/@ts-expect-error(?!\s+—)/.test(trimmed)) {
      issues.push({
        file: filepath,
        line: i + 1,
        severity: 'info',
        category: 'type-safety',
        message: '@ts-expect-error without explanation',
        suggestion: 'Add a comment explaining why this is expected',
        snippet: trimmed.slice(0, 80),
        fixerId: 'no-ts-ignore',
      });
    }
  }

  return issues;
}
