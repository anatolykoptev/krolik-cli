/**
 * @module commands/fix/fixers/any-type/analyzer
 * @description AST-based analyzer for `any` type usage using ts-morph
 *
 * Uses ts-morph for 100% accurate detection of `any` types in:
 * - Type annotations: `const x: any`
 * - Type assertions: `x as any`
 * - Generic parameters: `Array<any>`
 *
 * Benefits over regex:
 * - Correctly skips `any` inside strings
 * - Correctly skips `any` inside comments
 * - Correctly skips `any` as part of identifiers (e.g., `company`)
 * - Provides exact byte positions for precise fixes
 */

import { astPool, Node, SyntaxKind } from '@/lib/@ast';
import type { QualityIssue } from '../../core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface AnyTypeLocation {
  line: number;
  column: number;
  startOffset: number;
  endOffset: number;
  kind: 'type-annotation' | 'as-expression' | 'generic-param' | 'other';
  parentContext?: string;
}

// ============================================================================
// ANALYZER
// ============================================================================

/**
 * Analyze content for `any` type usage using ts-morph AST
 */
export function analyzeAnyTypeAST(content: string, file: string): QualityIssue[] {
  // Skip .d.ts and test files
  if (file.endsWith('.d.ts') || file.includes('.test.') || file.includes('.spec.')) {
    return [];
  }

  // Skip non-TypeScript files
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
    return [];
  }

  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      // Find all 'any' keyword nodes
      const anyNodes = sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword);

      // Track seen lines to avoid duplicate issues per line
      const seenLines = new Set<number>();

      for (const anyNode of anyNodes) {
        const line = anyNode.getStartLineNumber();

        // Avoid duplicate issues for same line
        if (seenLines.has(line)) continue;
        seenLines.add(line);

        const lineContent = lines[line - 1] ?? '';
        const trimmed = lineContent.trim();

        // Determine context
        const context = determineAnyContext(anyNode);

        issues.push({
          file,
          line,
          severity: 'warning',
          category: 'type-safety',
          message: `Using \`any\` type${context ? ` (${context})` : ''}`,
          suggestion: 'Use proper TypeScript types, `unknown`, or generics',
          snippet: trimmed.slice(0, 60),
          fixerId: 'any-type',
        });
      }

      return issues;
    } finally {
      cleanup();
    }
  } catch {
    // If parsing fails, return empty (file has syntax errors)
    return [];
  }
}

/**
 * Determine the context where `any` is used
 */
function determineAnyContext(node: Node): string | undefined {
  const parent = node.getParent();
  if (!parent) return undefined;

  // Check if it's an as-expression: x as any
  if (Node.isAsExpression(parent)) {
    return 'type assertion';
  }

  // Check if inside type parameter: Array<any>
  const typeParamAncestor = node.getFirstAncestorByKind(SyntaxKind.TypeReference);
  if (typeParamAncestor) {
    // Get the type name
    const typeName = typeParamAncestor.getTypeName();
    if (typeName) {
      return `generic parameter in ${typeName.getText()}`;
    }
    return 'generic parameter';
  }

  // If not an as-expression or generic param, it's likely a type annotation
  // e.g., const x: any, function foo(arg: any)
  return 'type annotation';
}

/**
 * Find all `any` type locations with exact positions for fixing
 *
 * Returns detailed location info needed for creating precise patches
 */
export function findAnyTypeLocations(content: string, file: string): AnyTypeLocation[] {
  const locations: AnyTypeLocation[] = [];

  // Skip non-TypeScript files
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
    return [];
  }

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      // Find all 'any' keyword nodes
      const anyNodes = sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword);

      for (const anyNode of anyNodes) {
        const line = anyNode.getStartLineNumber();
        const column = anyNode.getStartLinePos();
        const startOffset = anyNode.getStart();
        const endOffset = anyNode.getEnd();

        // Determine kind
        let kind: AnyTypeLocation['kind'] = 'type-annotation'; // Default
        const parent = anyNode.getParent();

        if (parent && Node.isAsExpression(parent)) {
          kind = 'as-expression';
        } else if (anyNode.getFirstAncestorByKind(SyntaxKind.TypeReference)) {
          kind = 'generic-param';
        }

        locations.push({
          line,
          column,
          startOffset,
          endOffset,
          kind,
        });
      }

      return locations;
    } finally {
      cleanup();
    }
  } catch {
    return [];
  }
}
