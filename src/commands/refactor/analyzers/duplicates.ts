/**
 * @module commands/refactor/analyzers/duplicates
 * @description AST-based duplicate function detection
 */

import { createHash } from 'crypto';
import * as path from 'path';
import type { DuplicateInfo, FunctionSignature } from '../core';
import { createProject, type SourceFile, SyntaxKind } from '../../../lib/@ast';
import { findFiles, readFile, logger } from '../../../lib';

// ============================================================================
// CONSTANTS
// ============================================================================

const SIMILARITY_THRESHOLDS = {
  /** >80% similar = merge candidates */
  MERGE: 0.8,
  /** >30% similar = rename to avoid confusion */
  RENAME: 0.3,
  /** Max 50% length difference for comparison */
  LENGTH_DIFF: 0.5,
  /** Minimum body size to avoid false positives on tiny functions */
  MIN_BODY_LENGTH: 20,
} as const;

const LIMITS = {
  /** Maximum files to analyze (prevent resource exhaustion) */
  MAX_FILES: 5000,
  /** Maximum file size in bytes */
  MAX_FILE_SIZE: 1024 * 1024, // 1MB
} as const;

// ============================================================================
// OPTIONS
// ============================================================================

export interface FindDuplicatesOptions {
  verbose?: boolean;
  minSimilarity?: number;
  ignoreTests?: boolean;
}

// ============================================================================
// EXTRACTION
// ============================================================================

/**
 * Extract function signatures from a TypeScript file
 */
export function extractFunctions(sourceFile: SourceFile, filePath: string): FunctionSignature[] {
  const functions: FunctionSignature[] = [];

  // Get all function declarations
  for (const func of sourceFile.getFunctions()) {
    const name = func.getName();
    if (!name) continue;

    const bodyText = func.getBody()?.getText() ?? '';
    const normalizedBody = normalizeBody(bodyText);

    functions.push({
      name,
      file: filePath,
      line: func.getStartLineNumber(),
      params: func.getParameters().map((p) => p.getType().getText()),
      returnType: func.getReturnType().getText(),
      exported: func.isExported(),
      bodyHash: hashBody(normalizedBody),
      normalizedBody,
    });
  }

  // Get exported arrow functions from variable declarations
  for (const varStatement of sourceFile.getVariableStatements()) {
    if (!varStatement.isExported()) continue;

    for (const decl of varStatement.getDeclarations()) {
      const init = decl.getInitializer();
      if (!init) continue;

      // Check if it's an arrow function or function expression
      const initText = init.getText();
      if (!initText.includes('=>') && !initText.startsWith('function')) continue;

      const name = decl.getName();
      const normalizedBody = normalizeBody(initText);

      // Extract parameters from arrow functions
      let params: string[] = [];
      if (init.getKind() === SyntaxKind.ArrowFunction) {
        const arrowFunc = init.asKind(SyntaxKind.ArrowFunction);
        if (arrowFunc) {
          params = arrowFunc.getParameters().map((p) => p.getType().getText());
        }
      }

      functions.push({
        name,
        file: filePath,
        line: decl.getStartLineNumber(),
        params,
        returnType: decl.getType().getText(),
        exported: true,
        bodyHash: hashBody(normalizedBody),
        normalizedBody,
      });
    }
  }

  return functions;
}

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Normalize function body for comparison
 * Removes comments, whitespace variations, normalizes strings and numbers
 */
function normalizeBody(body: string): string {
  return body
    // Remove single-line comments
    .replace(/\/\/.*$/gm, '')
    // Remove multi-line comments (non-greedy)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Normalize all strings to placeholder (handle escapes)
    .replace(/'(?:[^'\\]|\\.)*'/g, "'STR'")
    .replace(/"(?:[^"\\]|\\.)*"/g, '"STR"')
    .replace(/`(?:[^`\\]|\\.)*`/g, '`STR`')
    // Normalize numbers
    .replace(/\b\d+\.?\d*\b/g, 'NUM')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Hash function body using MD5
 */
function hashBody(body: string): string {
  return createHash('md5').update(body).digest('hex');
}

// ============================================================================
// SIMILARITY
// ============================================================================

/**
 * Calculate similarity between two function bodies
 * Returns 0-1 (1 = identical)
 */
function calculateSimilarity(body1: string, body2: string): number {
  if (body1 === body2) return 1;

  const len1 = body1.length;
  const len2 = body2.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) return 1;

  // For very different lengths, quick exit
  if (Math.abs(len1 - len2) / maxLen > SIMILARITY_THRESHOLDS.LENGTH_DIFF) return 0;

  // Token-based Jaccard similarity
  const tokens1 = new Set(body1.split(/\s+/));
  const tokens2 = new Set(body2.split(/\s+/));

  const intersection = [...tokens1].filter((t) => tokens2.has(t)).length;
  const union = new Set([...tokens1, ...tokens2]).size;

  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculate pairwise similarity for multiple functions
 * Returns the minimum similarity (conservative approach)
 */
function calculateGroupSimilarity(funcs: FunctionSignature[]): number {
  if (funcs.length < 2) return 0;

  const similarities: number[] = [];
  for (let i = 0; i < funcs.length - 1; i++) {
    for (let j = i + 1; j < funcs.length; j++) {
      const fi = funcs[i];
      const fj = funcs[j];
      if (fi && fj) {
        similarities.push(calculateSimilarity(fi.normalizedBody, fj.normalizedBody));
      }
    }
  }

  return similarities.length > 0 ? Math.min(...similarities) : 0;
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

/**
 * Find duplicate functions in a directory
 */
export async function findDuplicates(
  targetPath: string,
  projectRoot: string,
  options: FindDuplicatesOptions = {},
): Promise<DuplicateInfo[]> {
  const { verbose = false, ignoreTests = true } = options;
  const duplicates: DuplicateInfo[] = [];

  // Find all TypeScript files using correct API
  const allFiles = await findFiles(targetPath, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules', 'dist', '.next', 'coverage'],
  });

  // Filter out test files and .d.ts
  let files = allFiles.filter((f) => !f.endsWith('.d.ts'));
  if (ignoreTests) {
    files = files.filter((f) => !f.includes('.test.') && !f.includes('.spec.'));
  }

  // Resource exhaustion protection
  if (files.length > LIMITS.MAX_FILES) {
    logger.warn(`Too many files (${files.length}), limiting to ${LIMITS.MAX_FILES}`);
    files = files.slice(0, LIMITS.MAX_FILES);
  }

  // Create ts-morph project with correct parameter name
  const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
  const project = createProject({ tsConfigPath });

  // Extract all functions from all files
  const allFunctions: FunctionSignature[] = [];

  for (const file of files) {
    try {
      const content = readFile(file);
      if (!content) continue;

      // Skip large files
      if (content.length > LIMITS.MAX_FILE_SIZE) {
        if (verbose) {
          logger.warn(`Skipping large file: ${path.relative(projectRoot, file)}`);
        }
        continue;
      }

      // Add source file to project if not already there
      let sourceFile = project.getSourceFile(file);
      if (!sourceFile) {
        sourceFile = project.createSourceFile(file, content, { overwrite: true });
      }

      const relPath = path.relative(projectRoot, file);
      const functions = extractFunctions(sourceFile, relPath);
      allFunctions.push(...functions);
    } catch (error) {
      if (verbose) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.warn(`Failed to parse ${path.relative(projectRoot, file)}: ${message}`);
      }
      // Continue processing other files
    }
  }

  // Group functions by name
  const byName = new Map<string, FunctionSignature[]>();
  for (const func of allFunctions) {
    const existing = byName.get(func.name) ?? [];
    existing.push(func);
    byName.set(func.name, existing);
  }

  // Find duplicates (same name in multiple files)
  for (const [name, funcs] of byName) {
    if (funcs.length < 2) continue;

    // Calculate pairwise similarities (not just first two!)
    const similarity = calculateGroupSimilarity(funcs);

    // Determine recommendation based on similarity
    let recommendation: 'merge' | 'rename' | 'keep-both' = 'keep-both';
    if (similarity > SIMILARITY_THRESHOLDS.MERGE) {
      recommendation = 'merge';
    } else if (similarity > SIMILARITY_THRESHOLDS.RENAME) {
      recommendation = 'rename';
    }

    duplicates.push({
      name,
      locations: funcs.map((f) => ({
        file: f.file,
        line: f.line,
        exported: f.exported,
      })),
      similarity,
      recommendation,
    });
  }

  // Also find functions with identical bodies but different names
  const byHash = new Map<string, FunctionSignature[]>();
  for (const func of allFunctions) {
    if (func.normalizedBody.length < SIMILARITY_THRESHOLDS.MIN_BODY_LENGTH) continue;

    const existing = byHash.get(func.bodyHash) ?? [];
    existing.push(func);
    byHash.set(func.bodyHash, existing);
  }

  for (const [, funcs] of byHash) {
    if (funcs.length < 2) continue;

    // Skip if all have the same name (already caught above)
    const uniqueNames = new Set(funcs.map((f) => f.name));
    if (uniqueNames.size === 1) continue;

    // Find the "main" name (most exported, or alphabetically first)
    const sortedNames = [...uniqueNames].sort((a, b) => {
      const aExported = funcs.some((f) => f.name === a && f.exported);
      const bExported = funcs.some((f) => f.name === b && f.exported);
      if (aExported && !bExported) return -1;
      if (!aExported && bExported) return 1;
      return a.localeCompare(b);
    });

    duplicates.push({
      name: `[identical body] ${sortedNames.join(' / ')}`,
      locations: funcs.map((f) => ({
        file: f.file,
        line: f.line,
        exported: f.exported,
      })),
      similarity: 1,
      recommendation: 'merge',
    });
  }

  return duplicates;
}

/**
 * Quick scan for potential duplicates without full AST parsing
 */
export async function quickScanDuplicates(targetPath: string): Promise<string[]> {
  const functionNames: Map<string, string[]> = new Map();

  const files = await findFiles(targetPath, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules', 'dist', '.next'],
  });

  // Filter out .d.ts files
  const sourceFiles = files.filter((f) => !f.endsWith('.d.ts'));

  for (const file of sourceFiles) {
    const content = readFile(file);
    if (!content) continue;

    // Quick regex scan for function/const declarations
    // Match: export function name / export async function name
    const exportedFunctions = content.match(/export\s+(async\s+)?function\s+(\w+)/g) ?? [];
    // Match: export const name =
    const exportedConsts = content.match(/export\s+const\s+(\w+)\s*=/g) ?? [];

    for (const match of exportedFunctions) {
      const name = match.replace(/export\s+(async\s+)?function\s+/, '');
      const existing = functionNames.get(name) ?? [];
      existing.push(file);
      functionNames.set(name, existing);
    }

    for (const match of exportedConsts) {
      const name = match.replace(/export\s+const\s+/, '').replace(/\s*=$/, '');
      const existing = functionNames.get(name) ?? [];
      existing.push(file);
      functionNames.set(name, existing);
    }
  }

  return [...functionNames.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([name, files]) => `${name}: ${files.join(', ')}`);
}
