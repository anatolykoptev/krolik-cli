/**
 * @module commands/fix/analyzers/lint-rules-swc
 * @description SWC AST-based lint analyzer - replaces regex-based detection
 *
 * Uses SWC AST visitor pattern for accurate detection:
 * - console.log/warn/error/debug - CallExpression with MemberExpression
 * - debugger - DebuggerStatement node
 * - alert/confirm/prompt - CallExpression with Identifier
 * - eval() - CallExpression with Identifier
 *
 * Advantages over regex:
 * - Context-aware (no false positives in strings/comments)
 * - Accurate node detection (no need for string context checks)
 * - Faster for large files (single AST pass)
 * - Handles complex expressions correctly
 */

import type { Node, Span } from '@swc/core';
import { parseSync } from '@swc/core';
import { isCliFile } from '../../../lib/@context';
import { shouldSkipForAnalysis } from '../../../lib/@patterns';
import type { QualityIssue } from '../types';

/**
 * Console methods to detect
 */
const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;

/**
 * Browser dialog functions to detect
 */
const DIALOG_FUNCTIONS = ['alert', 'confirm', 'prompt'] as const;

/**
 * Lint issue detected by AST visitor
 */
interface LintIssueDetection {
  type: 'console' | 'debugger' | 'alert' | 'eval';
  line: number;
  column: number;
  method?: string; // For console.log, alert, etc.
}

/**
 * Check lint rules using SWC AST parsing
 *
 * Detects:
 * 1. console.log/warn/error/debug
 * 2. debugger statements
 * 3. alert/confirm/prompt calls
 * 4. eval() calls
 *
 * @param content - File content
 * @param filepath - File path (for CLI file detection)
 * @returns Array of quality issues
 */
export function checkLintRulesSwc(content: string, filepath: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Skip infrastructure files (pattern definitions, constants, etc.)
  if (shouldSkipForAnalysis(filepath)) {
    return issues;
  }

  const isCli = isCliFile(filepath);

  try {
    // Determine syntax based on file extension
    const isTypeScript = filepath.endsWith('.ts') || filepath.endsWith('.tsx');
    const isJsx = filepath.endsWith('.jsx') || filepath.endsWith('.tsx');

    // Parse file with SWC
    const ast = parseSync(content, {
      syntax: isTypeScript ? 'typescript' : 'ecmascript',
      // Use tsx for .tsx files, jsx for .jsx files
      ...(isTypeScript && isJsx ? { tsx: true } : {}),
      ...(! isTypeScript && isJsx ? { jsx: true } : {}),
      comments: false,
    });

    // IMPORTANT: SWC has a global state bug where span offsets accumulate across parseSync calls
    // Workaround: Calculate the base offset by checking the first non-whitespace character position
    //  and assuming that's where SWC started counting from
    let baseOffset = 0;
    if (ast.body.length > 0) {
      const firstStmt = ast.body[0] as { span?: Span };
      if (firstStmt.span) {
        // The first statement should start at or near offset 1 (SWC uses 1-based offsets)
        // If it's much higher, we have accumulated state
        baseOffset = firstStmt.span.start - 1; // Adjust to 0-based
      }
    }

    // Calculate line offsets for position mapping
    const lineOffsets = calculateLineOffsets(content);

    // Collect all lint issues
    const detections: LintIssueDetection[] = [];

    // Visit AST and collect issues
    visitNode(ast, (node) => {
      const detection = detectLintIssue(node);
      if (detection) {
        detections.push(detection);
      }
    });

    // Convert detections to quality issues
    for (const detection of detections) {
      // Skip console in CLI files
      if (detection.type === 'console' && isCli) {
        continue;
      }

      const issue = createQualityIssue(detection, filepath, content, lineOffsets, baseOffset);
      if (issue) {
        issues.push(issue);
      }
    }
  } catch {
    // Parse error - skip this file (return empty array)
    // This is expected for non-TS/JS files or severely malformed code
  }

  return issues;
}

/**
 * Calculate line offsets for position mapping
 */
function calculateLineOffsets(content: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/**
 * Convert byte offset to line number
 * Note: SWC uses 1-based byte offsets (first char is at offset 1)
 */
function offsetToLine(offset: number, lineOffsets: number[]): number {
  // SWC offsets are 1-based, convert to 0-based for our calculation
  const zeroBasedOffset = offset - 1;

  // Binary search for efficiency
  let low = 0;
  let high = lineOffsets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const currentOffset = lineOffsets[mid] ?? 0;
    const nextOffset = lineOffsets[mid + 1] ?? Number.MAX_SAFE_INTEGER;

    if (zeroBasedOffset >= currentOffset && zeroBasedOffset < nextOffset) {
      return mid + 1; // 1-based line numbers
    }

    if (zeroBasedOffset < currentOffset) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return 1; // Default to line 1
}

/**
 * Visit all nodes in the AST
 */
function visitNode(node: Node, callback: (node: Node) => void): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  callback(node);

  // Visit children
  for (const key of Object.keys(node)) {
    const value = (node as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          visitNode(item as Node, callback);
        }
      }
    } else if (value && typeof value === 'object') {
      visitNode(value as Node, callback);
    }
  }
}

/**
 * Detect lint issue from AST node
 */
function detectLintIssue(node: Node): LintIssueDetection | null {
  const nodeType = (node as { type?: string }).type;
  const span = (node as { span?: Span }).span;

  if (!span) {
    return null;
  }

  // 1. Debugger statement
  if (nodeType === 'DebuggerStatement') {
    return {
      type: 'debugger',
      line: span.start,
      column: 0,
    };
  }

  // 2. CallExpression or OptionalChainingExpression - check for console, alert, eval
  if (nodeType === 'CallExpression' || nodeType === 'OptionalChainingExpression') {
    const callExpr = node as {
      callee?: Node;
      base?: Node; // For OptionalChainingExpression
      span?: Span;
    };

    // Get the actual callee (might be in 'base' for optional chaining)
    const callee = callExpr.callee ?? callExpr.base;
    if (!callee) {
      return null;
    }

    const calleeType = (callee as { type?: string }).type;

    // 2a. MemberExpression - console.log, console.error, etc.
    if (calleeType === 'MemberExpression') {
      const memberExpr = callee as {
        object?: Node;
        property?: Node;
      };

      const object = memberExpr.object;
      const property = memberExpr.property;

      if (!object || !property) {
        return null;
      }

      // Check if object is "console"
      const objectType = (object as { type?: string }).type;
      if (objectType === 'Identifier') {
        const objectValue = (object as { value?: string }).value;
        if (objectValue === 'console') {
          // Check if property is a console method
          const propertyType = (property as { type?: string }).type;
          if (propertyType === 'Identifier') {
            const propertyValue = (property as { value?: string }).value;
            if (propertyValue && CONSOLE_METHODS.includes(propertyValue as (typeof CONSOLE_METHODS)[number])) {
              return {
                type: 'console',
                line: span.start,
                column: 0,
                method: propertyValue,
              };
            }
          }
        }
      }
    }

    // 2b. Identifier - alert(), confirm(), prompt(), eval()
    if (calleeType === 'Identifier') {
      const identifier = callee as { value?: string };
      const identifierValue = identifier.value;

      if (!identifierValue) {
        return null;
      }

      // Check for alert/confirm/prompt
      if (DIALOG_FUNCTIONS.includes(identifierValue as (typeof DIALOG_FUNCTIONS)[number])) {
        return {
          type: 'alert',
          line: span.start,
          column: 0,
          method: identifierValue,
        };
      }

      // Check for eval
      if (identifierValue === 'eval') {
        return {
          type: 'eval',
          line: span.start,
          column: 0,
          method: 'eval',
        };
      }
    }
  }

  return null;
}

/**
 * Create quality issue from detection
 */
function createQualityIssue(
  detection: LintIssueDetection,
  filepath: string,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
): QualityIssue | null {
  // Adjust for SWC's global offset accumulation bug
  const adjustedOffset = detection.line - baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, lineOffsets);
  const lines = content.split('\n');
  const lineContent = lines[lineNumber - 1] ?? '';
  const snippet = lineContent.trim().slice(0, 60);

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
        suggestion: 'Avoid eval() - use safer alternatives like JSON.parse() or Function constructor',
        snippet,
        fixerId: 'no-eval',
      };

    default:
      return null;
  }
}
