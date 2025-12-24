/**
 * @module commands/fix/strategies/hardcoded/generators
 * @description Fix generators for hardcoded values using AST
 *
 * NOTE: Uses lib/ast for centralized ts-morph utilities.
 */

import { SyntaxKind, type NumericLiteral, type VariableDeclaration } from 'ts-morph';
import type { FixOperation } from '../../types';
import { ALLOWED_NUMBERS } from './constants';
import { generateConstName } from './naming';
import {
  findInsertionPoint,
  isInsideTypeDefinition,
  isInsideString,
  isInsideConstObjectLiteral,
  isInsideConstDeclaration,
  extractASTContext,
} from './ast-utils';
import { formatWithPrettier, createFullFileReplace } from '../shared';

// ============================================================================
// NUMBER FIX GENERATOR
// ============================================================================

/**
 * Extract magic number into a named constant using AST
 *
 * Features:
 * - Uses AST context for better constant names
 * - Skips numbers in const object literals (intentional mappings)
 * - Smart filtering of false positives
 * - Prettier formatting for clean output
 */
export async function generateNumberFix(
  content: string,
  file: string,
  message: string,
  snippet: string | undefined,
): Promise<FixOperation | null> {
  // Extract the target value
  const match = message.match(/(\d+)/);
  if (!match) return null;
  const targetValue = parseInt(match[1] || '0', 10);

  // Skip allowed numbers
  if (ALLOWED_NUMBERS.has(targetValue)) return null;

  try {
    const { astPool } = require('../../core/ast-pool');
    const [sourceFile, cleanup] = astPool.createSourceFile(content, 'temp.ts');

    try {
      // Find ALL numeric literals with this value that are safe to replace
      const candidates = sourceFile.getDescendantsOfKind(SyntaxKind.NumericLiteral).filter((n: NumericLiteral) => {
      const value = n.getLiteralValue();
      return (
        value === targetValue &&
        !isInsideTypeDefinition(n) &&
        !isInsideString(n) &&
        !isInsideConstObjectLiteral(n)
      );
    });

    if (candidates.length === 0) return null;

    // Extract AST context from first candidate for better naming
    const astContext = extractASTContext(candidates[0]!);

    // Generate constant name from context
    const context = snippet || message;
    const constName = generateConstName(targetValue, context, astContext);

    // Check if constant already exists
    const existingConst = sourceFile
      .getVariableDeclarations()
      .find((v: VariableDeclaration) => v.getName() === constName);

    if (!existingConst) {
      // Find insertion point and add constant
      const insertPos = findInsertionPoint(sourceFile);
      const constDecl = `\nconst ${constName} = ${targetValue};\n`;
      sourceFile.insertText(insertPos, constDecl);
    }

    // After insertion, re-find candidates (positions have changed)
    // Replace ALL matching literals (not just first)
    // IMPORTANT: Skip the literal inside the const declaration we just created!
    const updatedCandidates = sourceFile.getDescendantsOfKind(SyntaxKind.NumericLiteral).filter((n: NumericLiteral) => {
      const value = n.getLiteralValue();
      return (
        value === targetValue &&
        !isInsideTypeDefinition(n) &&
        !isInsideString(n) &&
        !isInsideConstObjectLiteral(n) &&
        !isInsideConstDeclaration(n, constName)
      );
    });

    // Replace ALL candidates (from last to first to preserve positions)
    for (let i = updatedCandidates.length - 1; i >= 0; i--) {
      updatedCandidates[i]?.replaceWithText(constName);
    }

      // Format with Prettier for clean output
      const formattedContent = await formatWithPrettier(sourceFile.getFullText(), file);

      return createFullFileReplace(file, content, formattedContent);
    } finally {
      cleanup();
    }
  } catch {
    // AST parsing failed - skip this fix
    return null;
  }
}

// ============================================================================
// URL FIX GENERATOR
// ============================================================================

/**
 * Extract URL into a named constant
 */
export async function generateUrlFix(
  content: string,
  file: string,
  snippet: string | undefined,
): Promise<FixOperation | null> {
  if (!snippet) return null;

  const urlMatch = snippet.match(/(["'`])(https?:\/\/[^"'`\s]+)\1/);
  if (!urlMatch) return null;

  const url = urlMatch[2] || '';
  const quote = urlMatch[1] || '"';

  // Generate constant name from URL
  let constName = 'API_URL';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').replace(/\./g, '_').toUpperCase();

    // Add path hint if meaningful
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0 && pathParts[0] !== 'api') {
      constName = `${host}_${pathParts[0]!.toUpperCase()}_URL`;
    } else {
      constName = `${host}_URL`;
    }
  } catch {
    // Keep default
  }

  try {
    const { astPool } = require('../../core/ast-pool');
    const [sourceFile, cleanup] = astPool.createSourceFile(content, 'temp.ts');

    try {
      // Check if constant exists
      const existingConst = sourceFile
      .getVariableDeclarations()
      .find((v: VariableDeclaration) => v.getName() === constName);

    if (!existingConst) {
      const insertPos = findInsertionPoint(sourceFile);
      const constDecl = `\nconst ${constName} = ${quote}${url}${quote};\n`;
      sourceFile.insertText(insertPos, constDecl);
    }

      // Find and replace the URL string
      const stringLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral);
      for (const literal of stringLiterals) {
        if (literal.getLiteralValue() === url) {
          literal.replaceWithText(constName);
          break;
        }
      }

      // Format with Prettier for clean output
      const formattedContent = await formatWithPrettier(sourceFile.getFullText(), file);

      return createFullFileReplace(file, content, formattedContent);
    } finally {
      cleanup();
    }
  } catch {
    return null;
  }
}
