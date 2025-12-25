/**
 * @module lib/@swc/example
 * @description Example usage of @swc infrastructure
 *
 * These examples demonstrate common patterns for using the SWC AST utilities.
 * Use these as templates for building your own analyzers.
 */

import * as crypto from 'node:crypto';
import type { CallExpression, FunctionDeclaration, Identifier, NumericLiteral } from './index';
import {
  countNodeTypes,
  findNodesByType,
  getNodeSpan,
  getNodeText,
  getNodeType,
  offsetToPosition,
  parseFile,
  visitNode,
  visitNodeWithCallbacks,
} from './index';

/**
 * Example 1: Find all debugger statements
 */
export function findDebuggerStatements(filePath: string, content: string) {
  const { ast, lineOffsets } = parseFile(filePath, content);
  const debuggers: Array<{ line: number; column: number }> = [];

  visitNodeWithCallbacks(ast, {
    onDebuggerStatement: (node) => {
      const span = getNodeSpan(node);
      if (span) {
        const pos = offsetToPosition(span.start, lineOffsets);
        debuggers.push({ line: pos.line, column: pos.column });
      }
    },
  });

  return debuggers;
}

/**
 * Example 2: Find console.log calls
 */
export function findConsoleLogs(filePath: string, content: string) {
  const { ast, lineOffsets } = parseFile(filePath, content);
  const logs: Array<{ line: number; text: string; method: string }> = [];

  visitNodeWithCallbacks(ast, {
    onCallExpression: (node) => {
      const call = node as unknown as CallExpression;
      const callee = call.callee;

      // Check if it's console.* call
      if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        (callee.object as Identifier).value === 'console'
      ) {
        const span = getNodeSpan(node);
        if (span) {
          const pos = offsetToPosition(span.start, lineOffsets);
          const method =
            callee.property.type === 'Identifier'
              ? (callee.property as Identifier).value
              : 'unknown';

          logs.push({
            line: pos.line,
            text: getNodeText(node, content) ?? '',
            method,
          });
        }
      }
    },
  });

  return logs;
}

/**
 * Example 3: Extract all exported functions
 */
export function findExportedFunctions(filePath: string, content: string) {
  const { ast, lineOffsets } = parseFile(filePath, content);
  const functions: Array<{ name: string; line: number; async: boolean }> = [];

  visitNodeWithCallbacks(ast, {
    onFunctionDeclaration: (node, context) => {
      if (context.isExported) {
        const func = node as unknown as FunctionDeclaration;
        const span = getNodeSpan(node);
        const pos = span ? offsetToPosition(span.start, lineOffsets) : { line: 0 };

        functions.push({
          name: func.identifier?.value ?? 'anonymous',
          line: pos.line,
          async: func.async ?? false,
        });
      }
    },
  });

  return functions;
}

/**
 * Example 4: Find magic numbers (numeric literals outside of specific contexts)
 */
export function findMagicNumbers(filePath: string, content: string) {
  const { ast, lineOffsets } = parseFile(filePath, content);
  const magicNumbers: Array<{ value: number; line: number; text: string }> = [];

  // Common non-magic numbers
  const commonNumbers = new Set([0, 1, -1, 2, 10, 100, 1000]);

  visitNodeWithCallbacks(ast, {
    onNumericLiteral: (node, context) => {
      const literal = node as unknown as NumericLiteral;
      const value = literal.value;

      // Skip common numbers
      if (commonNumbers.has(value)) {
        return;
      }

      // Skip array indices (simplified check)
      const parentType = context.parent ? getNodeType(context.parent) : '';
      if (parentType === 'MemberExpression') {
        return;
      }

      const span = getNodeSpan(node);
      if (span) {
        const pos = offsetToPosition(span.start, lineOffsets);
        magicNumbers.push({
          value,
          line: pos.line,
          text: getNodeText(node, content) ?? String(value),
        });
      }
    },
  });

  return magicNumbers;
}

/**
 * Example 5: Count different node types in a file
 */
export function analyzeNodeTypes(filePath: string, content: string) {
  const { ast } = parseFile(filePath, content);

  const counts = countNodeTypes(ast, [
    'FunctionDeclaration',
    'ArrowFunctionExpression',
    'CallExpression',
    'Identifier',
    'IfStatement',
    'ReturnStatement',
  ]);

  return Object.fromEntries(counts);
}

/**
 * Example 6: Find all function bodies and calculate complexity
 */
export function calculateComplexity(filePath: string, content: string) {
  const { ast, lineOffsets } = parseFile(filePath, content);
  const complexities: Array<{ name: string; line: number; complexity: number }> = [];

  visitNodeWithCallbacks(ast, {
    onFunctionDeclaration: (node) => {
      const func = node as unknown as FunctionDeclaration;
      const span = getNodeSpan(node);
      const pos = span ? offsetToPosition(span.start, lineOffsets) : { line: 0 };

      // Simple complexity: count decision points
      let complexity = 1; // Base complexity

      visitNode(node, (n) => {
        const type = getNodeType(n);
        if (
          type === 'IfStatement' ||
          type === 'WhileStatement' ||
          type === 'ForStatement' ||
          type === 'ConditionalExpression' ||
          type === 'LogicalExpression'
        ) {
          complexity++;
        }
      });

      complexities.push({
        name: func.identifier?.value ?? 'anonymous',
        line: pos.line,
        complexity,
      });
    },
  });

  return complexities;
}

/**
 * Example 7: Find duplicate code blocks using hashing
 */
export function findDuplicateBlocks(filePath: string, content: string) {
  const { ast } = parseFile(filePath, content);
  const blocks = new Map<string, number>();

  visitNodeWithCallbacks(ast, {
    onFunctionDeclaration: (node) => {
      const text = getNodeText(node, content);
      if (text) {
        const hash = crypto.createHash('md5').update(text).digest('hex');
        blocks.set(hash, (blocks.get(hash) ?? 0) + 1);
      }
    },
    onArrowFunctionExpression: (node) => {
      const text = getNodeText(node, content);
      if (text) {
        const hash = crypto.createHash('md5').update(text).digest('hex');
        blocks.set(hash, (blocks.get(hash) ?? 0) + 1);
      }
    },
  });

  // Return only duplicates
  const duplicates: Array<{ hash: string; count: number }> = [];
  blocks.forEach((count, hash) => {
    if (count > 1) {
      duplicates.push({ hash, count });
    }
  });

  return duplicates;
}

/**
 * Example 8: Extract all string literals (for i18n analysis)
 */
export function extractStringLiterals(filePath: string, content: string) {
  const { ast, lineOffsets } = parseFile(filePath, content);
  const strings: Array<{ value: string; line: number }> = [];

  visitNodeWithCallbacks(ast, {
    onStringLiteral: (node) => {
      const literal = node as unknown as { value: string };
      const span = getNodeSpan(node);
      if (span) {
        const pos = offsetToPosition(span.start, lineOffsets);
        strings.push({
          value: literal.value,
          line: pos.line,
        });
      }
    },
  });

  return strings;
}

/**
 * Example 9: Find all import statements
 */
export function extractImports(filePath: string, content: string) {
  const { ast } = parseFile(filePath, content);
  const imports: Array<{ module: string; specifiers: string[] }> = [];

  visitNodeWithCallbacks(ast, {
    onImportDeclaration: (node) => {
      const importDecl = node as unknown as {
        source: { value: string };
        specifiers: Array<{ local: { value: string } }>;
      };

      imports.push({
        module: importDecl.source.value,
        specifiers: importDecl.specifiers.map((s) => s.local.value),
      });
    },
  });

  return imports;
}

/**
 * Example 10: Simple usage - count all function types
 */
export function countFunctions(filePath: string, content: string) {
  const { ast } = parseFile(filePath, content);

  const functionDecls = findNodesByType(ast, 'FunctionDeclaration').length;
  const functionExprs = findNodesByType(ast, 'FunctionExpression').length;
  const arrowFunctions = findNodesByType(ast, 'ArrowFunctionExpression').length;

  return {
    declarations: functionDecls,
    expressions: functionExprs,
    arrows: arrowFunctions,
    total: functionDecls + functionExprs + arrowFunctions,
  };
}
