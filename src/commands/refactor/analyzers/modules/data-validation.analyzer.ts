/**
 * @module commands/refactor/analyzers/modules/data-validation.analyzer
 * @description Data Validation Analyzer for the registry-based architecture
 *
 * Validates data consistency in const array declarations:
 * - Duplicate items (by id, title, name, email fields)
 * - Inconsistent data patterns (multiple emails, URLs)
 * - Data integrity issues
 *
 * Unlike code analysis, this analyzer focuses on DATA bugs that
 * static analysis tools typically miss.
 *
 * @example
 * ```typescript
 * import { dataValidationAnalyzer } from './modules/data-validation.analyzer';
 * import { analyzerRegistry } from '../registry';
 *
 * // Register the analyzer
 * analyzerRegistry.register(dataValidationAnalyzer);
 *
 * // Run with context
 * const results = await analyzerRegistry.runAll(ctx);
 * const dataResult = results.get('data-validation');
 * ```
 */

import * as path from 'node:path';
import type {
  ArrayExpression,
  ExprOrSpread,
  KeyValueProperty,
  Node,
  ObjectExpression,
  Span,
} from '@swc/core';
import { offsetToPosition, parseFile } from '../../../../lib/@ast/swc';
import { findFiles, readFile } from '../../../../lib/@core/fs';
import type { Analyzer } from '../registry';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Type of data validation issue
 */
export type DataIssueType = 'duplicate-item' | 'inconsistent-data' | 'missing-field';

/**
 * Severity of the data issue
 */
export type DataIssueSeverity = 'error' | 'warning' | 'info';

/**
 * A data validation issue
 */
export interface DataIssue {
  /** Type of issue */
  type: DataIssueType;
  /** Severity level */
  severity: DataIssueSeverity;
  /** Relative file path */
  file: string;
  /** Line number where the issue occurs (1-based) */
  line: number;
  /** The field that has the problem */
  field?: string;
  /** The problematic value */
  value?: string;
  /** Human-readable message */
  message: string;
  /** Original line number (for duplicates) */
  originalLine?: number;
}

/**
 * Data validation analysis result
 */
export interface DataValidationAnalysis {
  /** All issues found */
  issues: DataIssue[];
  /** Issues grouped by severity */
  bySeverity: {
    error: DataIssue[];
    warning: DataIssue[];
    info: DataIssue[];
  };
  /** Issues grouped by type */
  byType: {
    'duplicate-item': DataIssue[];
    'inconsistent-data': DataIssue[];
    'missing-field': DataIssue[];
  };
  /** Summary counts */
  summary: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
    filesScanned: number;
    arraysAnalyzed: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Fields that should be unique within an array (duplicate detection)
 */
const UNIQUE_KEY_FIELDS = ['id', 'key', 'slug', 'code'];

/**
 * Fields that often have duplicates when data is copy-pasted incorrectly
 */
const IDENTITY_FIELDS = ['title', 'name', 'label', 'email'];

/**
 * Patterns for detecting data consistency issues
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\/[^\s]+$/;

/**
 * Directories to skip during scanning
 */
const SKIP_DIRS = ['node_modules', 'dist', '.next', 'build', '.turbo', 'coverage', '.pnpm'];

// ============================================================================
// AST HELPERS
// ============================================================================

/**
 * Context for AST visiting
 */
interface VisitContext {
  isConst: boolean;
  variableName?: string;
}

/**
 * Information about a const array declaration
 */
interface ConstArrayInfo {
  name: string;
  arrayNode: ArrayExpression;
  line: number;
}

/**
 * Extract literal value from AST node
 */
function extractLiteralValue(node: Node | undefined): string | number | boolean | null {
  if (!node) return null;

  const nodeType = (node as { type?: string }).type;

  switch (nodeType) {
    case 'StringLiteral':
      return (node as { value?: string }).value ?? null;
    case 'NumericLiteral':
      return (node as { value?: number }).value ?? null;
    case 'BooleanLiteral':
      return (node as { value?: boolean }).value ?? null;
    case 'NullLiteral':
      return null;
    case 'TemplateLiteral': {
      // For simple template literals without expressions
      const quasis = (node as { quasis?: Array<{ raw?: string }> }).quasis;
      if (quasis && quasis.length === 1) {
        return quasis[0]?.raw ?? null;
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Get property value from an object expression
 */
function getObjectProperty(
  obj: ObjectExpression,
  propertyName: string,
): string | number | boolean | null {
  for (const prop of obj.properties ?? []) {
    const propType = (prop as { type?: string }).type;
    if (propType !== 'KeyValueProperty') continue;

    const kvProp = prop as KeyValueProperty;
    const keyType = (kvProp.key as { type?: string }).type;

    let keyName: string | null = null;
    if (keyType === 'Identifier') {
      keyName = (kvProp.key as { value?: string }).value ?? null;
    } else if (keyType === 'StringLiteral') {
      keyName = (kvProp.key as { value?: string }).value ?? null;
    }

    if (keyName === propertyName) {
      return extractLiteralValue(kvProp.value as Node);
    }
  }

  return null;
}

/**
 * Get line number from SWC span
 */
function getLineFromSpan(
  span: Span | undefined,
  lineOffsets: number[],
  baseOffset: number,
): number {
  if (!span) return 1;
  const normalizedStart = Math.max(0, span.start - baseOffset - 1);
  return offsetToPosition(normalizedStart, lineOffsets).line;
}

/**
 * Visit AST nodes and collect const array declarations
 */
function collectConstArrays(
  node: Node,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
  context: VisitContext = { isConst: false },
  result: ConstArrayInfo[] = [],
): ConstArrayInfo[] {
  if (!node || typeof node !== 'object') {
    return result;
  }

  const nodeType = (node as { type?: string }).type;

  // Track const declarations
  if (nodeType === 'VariableDeclaration') {
    const decl = node as { kind?: string; declarations?: Node[] };
    const isConst = decl.kind === 'const';

    for (const declarator of decl.declarations ?? []) {
      collectConstArrays(
        declarator,
        content,
        lineOffsets,
        baseOffset,
        { ...context, isConst },
        result,
      );
    }
    return result;
  }

  // Track variable name
  if (nodeType === 'VariableDeclarator') {
    const decl = node as { id?: { type?: string; value?: string }; init?: Node };
    const idNode = decl.id;

    if (idNode?.type === 'Identifier' && idNode.value) {
      const newContext = { ...context, variableName: idNode.value };

      if (decl.init) {
        collectConstArrays(decl.init, content, lineOffsets, baseOffset, newContext, result);
      }
    }
    return result;
  }

  // Collect const array expressions
  if (nodeType === 'ArrayExpression' && context.isConst && context.variableName) {
    const arrayNode = node as ArrayExpression;
    const span = (node as { span?: Span }).span;
    const line = getLineFromSpan(span, lineOffsets, baseOffset);

    result.push({
      name: context.variableName,
      arrayNode,
      line,
    });
    // Don't recurse into array - we process it separately
    return result;
  }

  // Recurse into children
  for (const key of Object.keys(node)) {
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          collectConstArrays(item as Node, content, lineOffsets, baseOffset, context, result);
        }
      }
    } else if (value && typeof value === 'object') {
      collectConstArrays(value as Node, content, lineOffsets, baseOffset, context, result);
    }
  }

  return result;
}

/**
 * Find duplicate items in an array by key fields
 */
function findDuplicateItems(
  arrayInfo: ConstArrayInfo,
  lineOffsets: number[],
  baseOffset: number,
  debug = false,
): DataIssue[] {
  const issues: DataIssue[] = [];
  const elements = arrayInfo.arrayNode.elements ?? [];

  // Track seen values for unique fields
  const seenUnique = new Map<string, { line: number; field: string; value: string }>();
  // Track seen values for identity fields (report only first duplicate)
  const seenIdentity = new Map<string, { line: number; field: string; value: string }>();

  if (debug) {
    console.log(`[data-validation]     Checking ${elements.length} elements for duplicates`);
  }

  for (const element of elements) {
    if (!element) continue;

    // SWC array elements are ExprOrSpread - extract the expression
    const exprOrSpread = element as unknown as ExprOrSpread;
    const expr = exprOrSpread.spread ? null : exprOrSpread.expression;

    if (!expr) {
      if (debug) {
        console.log(`[data-validation]     Element is spread or null - skipping`);
      }
      continue;
    }

    const elementType = (expr as { type?: string }).type;

    if (debug) {
      console.log(`[data-validation]     Element type: ${elementType}`);
    }

    if (elementType !== 'ObjectExpression') {
      if (debug) {
        console.log(`[data-validation]       Skipping - not an ObjectExpression`);
      }
      continue;
    }

    const obj = expr as unknown as ObjectExpression;
    const span = (expr as unknown as { span?: Span }).span;
    const line = getLineFromSpan(span, lineOffsets, baseOffset);

    if (debug) {
      console.log(`[data-validation]     Element at line ${line}:`);
      console.log(`[data-validation]       Properties count: ${obj.properties?.length ?? 0}`);
    }

    // Check unique key fields (id, key, slug, code) - these MUST be unique
    for (const field of UNIQUE_KEY_FIELDS) {
      const value = getObjectProperty(obj, field);
      if (value === null) continue;

      const stringValue = String(value);
      const key = `${field}:${stringValue}`;

      if (debug) {
        console.log(`[data-validation]       ${field} = "${stringValue}"`);
      }

      const existing = seenUnique.get(key);
      if (existing) {
        if (debug) {
          console.log(`[data-validation]       ⚠️  DUPLICATE ${field} found!`);
        }
        issues.push({
          type: 'duplicate-item',
          severity: 'error',
          file: '', // Will be set by caller
          line,
          field,
          value: stringValue,
          message: `Duplicate ${field}="${stringValue}" (first occurrence at line ${existing.line})`,
          originalLine: existing.line,
        });
      } else {
        seenUnique.set(key, { line, field, value: stringValue });
      }
    }

    // Check identity fields (title, name, etc.) - duplicates are warnings
    for (const field of IDENTITY_FIELDS) {
      const value = getObjectProperty(obj, field);
      if (value === null) continue;

      const stringValue = String(value);
      const key = `${field}:${stringValue}`;

      if (debug) {
        console.log(`[data-validation]       ${field} = "${stringValue}"`);
      }

      const existing = seenIdentity.get(key);
      if (existing) {
        if (debug) {
          console.log(`[data-validation]       ⚠️  DUPLICATE ${field} found!`);
        }
        issues.push({
          type: 'duplicate-item',
          severity: 'warning',
          file: '', // Will be set by caller
          line,
          field,
          value: stringValue,
          message: `Duplicate ${field}="${stringValue}" - possible copy-paste error (original at line ${existing.line})`,
          originalLine: existing.line,
        });
      } else {
        seenIdentity.set(key, { line, field, value: stringValue });
      }
    }
  }

  return issues;
}

/**
 * Find inconsistent data patterns in an array
 */
function findInconsistentData(
  arrayInfo: ConstArrayInfo,
  lineOffsets: number[],
  baseOffset: number,
): DataIssue[] {
  const issues: DataIssue[] = [];
  const elements = arrayInfo.arrayNode.elements ?? [];

  // Collect all email-like values
  const emails = new Map<string, number>(); // email -> first line
  // Collect all URL domains
  const urlDomains = new Map<string, number>(); // domain -> first line

  for (const element of elements) {
    if (!element) continue;

    // SWC array elements are ExprOrSpread - extract the expression
    const exprOrSpread = element as unknown as ExprOrSpread;
    const expr = exprOrSpread.spread ? null : exprOrSpread.expression;

    if (!expr) continue;

    const elementType = (expr as { type?: string }).type;
    if (elementType !== 'ObjectExpression') continue;

    const obj = expr as unknown as ObjectExpression;
    const span = (expr as unknown as { span?: Span }).span;
    const line = getLineFromSpan(span, lineOffsets, baseOffset);

    // Check all properties for email/URL patterns
    for (const prop of obj.properties ?? []) {
      const propType = (prop as { type?: string }).type;
      if (propType !== 'KeyValueProperty') continue;

      const kvProp = prop as KeyValueProperty;
      const value = extractLiteralValue(kvProp.value as Node);
      if (typeof value !== 'string') continue;

      // Check for email
      if (EMAIL_PATTERN.test(value)) {
        if (!emails.has(value)) {
          emails.set(value, line);
        }
      }

      // Check for URL and extract domain
      if (URL_PATTERN.test(value)) {
        try {
          const url = new URL(value);
          const domain = url.hostname;
          if (!urlDomains.has(domain)) {
            urlDomains.set(domain, line);
          }
        } catch {
          // Invalid URL
        }
      }
    }
  }

  // Report if multiple different emails (possible inconsistency)
  if (emails.size > 1) {
    const emailList = [...emails.keys()];
    issues.push({
      type: 'inconsistent-data',
      severity: 'info',
      file: '', // Will be set by caller
      line: arrayInfo.line,
      message: `Multiple different emails in array: ${emailList.slice(0, 3).join(', ')}${emailList.length > 3 ? '...' : ''} - verify this is intentional`,
    });
  }

  // Report if multiple different URL domains (possible inconsistency)
  if (urlDomains.size > 2) {
    const domainList = [...urlDomains.keys()];
    issues.push({
      type: 'inconsistent-data',
      severity: 'info',
      file: '', // Will be set by caller
      line: arrayInfo.line,
      message: `Multiple URL domains in array: ${domainList.slice(0, 3).join(', ')}${domainList.length > 3 ? '...' : ''} - verify consistency`,
    });
  }

  return issues;
}

// ============================================================================
// DATA VALIDATION ANALYZER
// ============================================================================

/**
 * Analyzer for detecting data integrity issues in const arrays.
 *
 * Scans TypeScript/JavaScript files for const array declarations
 * and validates data consistency within them.
 *
 * Features:
 * - Detects duplicate items by key fields (id, name, title, etc.)
 * - Detects inconsistent data patterns (multiple emails, URLs)
 * - Uses SWC for fast AST parsing
 * - Groups issues by severity for prioritized fixing
 */
export const dataValidationAnalyzer: Analyzer<DataValidationAnalysis> = {
  metadata: {
    id: 'data-validation',
    name: 'Data Validation',
    description: 'Validates data consistency in const arrays (duplicates, inconsistencies)',
    defaultEnabled: true,
    // No dependencies - independent analyzer
  },

  /**
   * Determines if the analyzer should run.
   *
   * Always runs unless explicitly disabled.
   *
   * @param ctx - The analyzer context
   * @returns true unless explicitly disabled
   */
  shouldRun(ctx) {
    return ctx.options.includeDataValidation !== false;
  },

  /**
   * Analyzes const arrays for data integrity issues.
   *
   * @param ctx - The analyzer context
   * @returns Promise resolving to the analysis result
   */
  async analyze(ctx) {
    const { projectRoot } = ctx;
    const allIssues: DataIssue[] = [];
    let filesScanned = 0;
    let arraysAnalyzed = 0;

    // Debug mode detection
    const debug = Boolean(ctx.options.verbose) || process.env.DEBUG_PERF === '1';

    try {
      // Find TypeScript/JavaScript files
      const files = findFiles(projectRoot, {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        skipDirs: SKIP_DIRS,
      });

      if (debug) {
        console.log(`[data-validation] Found ${files.length} files to scan`);
      }

      for (const filePath of files) {
        const content = readFile(filePath);
        if (!content) continue;

        filesScanned++;
        const relativePath = path.relative(projectRoot, filePath);

        try {
          // Parse with SWC
          const { ast, lineOffsets, baseOffset } = parseFile(filePath, content);

          // Collect const array declarations
          const constArrays = collectConstArrays(ast, content, lineOffsets, baseOffset);

          if (debug && constArrays.length > 0) {
            console.log(
              `[data-validation] ${relativePath}: found ${constArrays.length} const arrays`,
            );
            for (const arr of constArrays) {
              const elements = arr.arrayNode.elements?.length ?? 0;
              console.log(
                `[data-validation]   - ${arr.name} (${elements} items) at line ${arr.line}`,
              );
            }
          }

          for (const arrayInfo of constArrays) {
            arraysAnalyzed++;

            // Find duplicates
            const duplicates = findDuplicateItems(arrayInfo, lineOffsets, baseOffset, debug);
            if (debug && duplicates.length > 0) {
              console.log(
                `[data-validation]   - ${arrayInfo.name}: ${duplicates.length} duplicates found`,
              );
            }
            for (const issue of duplicates) {
              issue.file = relativePath;
              allIssues.push(issue);
            }

            // Find inconsistencies
            const inconsistencies = findInconsistentData(arrayInfo, lineOffsets, baseOffset);
            if (debug && inconsistencies.length > 0) {
              console.log(
                `[data-validation]   - ${arrayInfo.name}: ${inconsistencies.length} inconsistencies found`,
              );
            }
            for (const issue of inconsistencies) {
              issue.file = relativePath;
              allIssues.push(issue);
            }
          }
        } catch (error) {
          // Parse error - skip this file
          if (debug) {
            console.log(
              `[data-validation] ${relativePath}: parse error - ${error instanceof Error ? error.message : 'unknown'}`,
            );
          }
        }
      }

      if (debug) {
        console.log(
          `[data-validation] Summary: ${filesScanned} files scanned, ${arraysAnalyzed} arrays analyzed, ${allIssues.length} issues found`,
        );
      }

      // Group issues
      const bySeverity: DataValidationAnalysis['bySeverity'] = {
        error: [],
        warning: [],
        info: [],
      };

      const byType: DataValidationAnalysis['byType'] = {
        'duplicate-item': [],
        'inconsistent-data': [],
        'missing-field': [],
      };

      for (const issue of allIssues) {
        bySeverity[issue.severity].push(issue);
        byType[issue.type].push(issue);
      }

      return {
        status: 'success',
        data: {
          issues: allIssues,
          bySeverity,
          byType,
          summary: {
            total: allIssues.length,
            errors: bySeverity.error.length,
            warnings: bySeverity.warning.length,
            infos: bySeverity.info.length,
            filesScanned,
            arraysAnalyzed,
          },
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error during data validation',
      };
    }
  },
};
