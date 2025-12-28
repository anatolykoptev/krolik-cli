/**
 * @module commands/refactor/analyzers/core/type-duplicates
 * @description Detection of duplicate interfaces and type aliases
 *
 * Detects:
 * - Interfaces with identical structure (same fields & types)
 * - Type aliases with identical definitions
 * - Similar interfaces (>80% field overlap)
 */

import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { findFiles, logger, readFile, validatePathWithinProject } from '../../../../lib';
import {
  getProject,
  type Project,
  releaseProject,
  type SourceFile,
  SyntaxKind,
} from '../../../../lib/@ast';
import type { TypeDuplicateInfo } from '../../core/types';
import { findTsConfig } from '../shared';

// Re-export for public API
export type { TypeDuplicateInfo } from '../../core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface TypeSignature {
  /** Type name */
  name: string;
  /** File path (relative) */
  file: string;
  /** Line number */
  line: number;
  /** Is exported */
  exported: boolean;
  /** Type kind: interface or type alias */
  kind: 'interface' | 'type';
  /** Normalized structure for comparison */
  normalizedStructure: string;
  /** Hash of normalized structure */
  structureHash: string;
  /** Field names (for interfaces) */
  fields?: string[];
  /** Original definition text */
  definition: string;
}

export interface FindTypeDuplicatesOptions {
  verbose?: boolean;
  minSimilarity?: number;
  ignoreTests?: boolean;
  /** Include type aliases (default: true) */
  includeTypes?: boolean;
  /** Include interfaces (default: true) */
  includeInterfaces?: boolean;
  /** Shared ts-morph Project instance (optional, for performance) */
  project?: Project;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SIMILARITY_THRESHOLDS = {
  /** >80% similar = merge candidates */
  MERGE: 0.8,
  /** >50% similar = consider rename */
  RENAME: 0.5,
} as const;

const LIMITS = {
  MAX_FILES: 5000,
  MAX_FILE_SIZE: 1024 * 1024,
} as const;

// ============================================================================
// EXTRACTION
// ============================================================================

/**
 * Extract interface and type alias signatures from a TypeScript file
 */
export function extractTypes(sourceFile: SourceFile, filePath: string): TypeSignature[] {
  const types: TypeSignature[] = [];

  // Extract interfaces
  for (const iface of sourceFile.getInterfaces()) {
    const name = iface.getName();
    const members = iface.getMembers();

    // Build normalized structure (sorted fields with types)
    const fields: string[] = [];
    const fieldDefs: string[] = [];

    for (const member of members) {
      if (member.getKind() === SyntaxKind.PropertySignature) {
        const prop = member.asKind(SyntaxKind.PropertySignature);
        if (prop) {
          const propName = prop.getName();
          const propType = prop.getType().getText();
          const optional = prop.hasQuestionToken() ? '?' : '';
          fields.push(propName);
          fieldDefs.push(`${propName}${optional}:${normalizeType(propType)}`);
        }
      } else if (member.getKind() === SyntaxKind.MethodSignature) {
        const method = member.asKind(SyntaxKind.MethodSignature);
        if (method) {
          const methodName = method.getName();
          const params = method.getParameters().map((p) => normalizeType(p.getType().getText()));
          const returnType = normalizeType(method.getReturnType().getText());
          fields.push(methodName);
          fieldDefs.push(`${methodName}(${params.join(',')}):${returnType}`);
        }
      }
    }

    // Sort for consistent comparison
    fieldDefs.sort();
    const normalizedStructure = fieldDefs.join(';');

    types.push({
      name,
      file: filePath,
      line: iface.getStartLineNumber(),
      exported: iface.isExported(),
      kind: 'interface',
      normalizedStructure,
      structureHash: hashStructure(normalizedStructure),
      fields: fields.sort(),
      definition: iface.getText().slice(0, 500), // Truncate for display
    });
  }

  // Extract type aliases
  for (const typeAlias of sourceFile.getTypeAliases()) {
    const name = typeAlias.getName();
    const typeNode = typeAlias.getTypeNode();
    const typeText = typeNode?.getText() ?? '';

    const normalizedStructure = normalizeType(typeText);

    types.push({
      name,
      file: filePath,
      line: typeAlias.getStartLineNumber(),
      exported: typeAlias.isExported(),
      kind: 'type',
      normalizedStructure,
      structureHash: hashStructure(normalizedStructure),
      definition: typeAlias.getText().slice(0, 500),
    });
  }

  return types;
}

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Normalize type text for comparison
 */
function normalizeType(typeText: string): string {
  return (
    typeText
      // Remove import paths
      .replace(/import\([^)]+\)\./g, '')
      // Remove whitespace
      .replace(/\s+/g, '')
      // Sort union/intersection members
      .split(/[|&]/)
      .map((t) => t.trim())
      .sort()
      .join('|')
  );
}

/**
 * Hash structure for quick comparison
 */
function hashStructure(structure: string): string {
  return createHash('md5').update(structure).digest('hex');
}

// ============================================================================
// SIMILARITY
// ============================================================================

/**
 * Calculate structural similarity between two types
 */
function calculateTypeSimilarity(type1: TypeSignature, type2: TypeSignature): number {
  // Exact match
  if (type1.structureHash === type2.structureHash) {
    return 1;
  }

  // For interfaces, compare field overlap
  if (type1.kind === 'interface' && type2.kind === 'interface' && type1.fields && type2.fields) {
    const fields1 = new Set(type1.fields);
    const fields2 = new Set(type2.fields);

    const intersection = [...fields1].filter((f) => fields2.has(f)).length;
    const union = new Set([...fields1, ...fields2]).size;

    return union === 0 ? 0 : intersection / union;
  }

  // For type aliases, compare token similarity
  const tokens1 = new Set(type1.normalizedStructure.split(/[^a-zA-Z0-9_]/));
  const tokens2 = new Set(type2.normalizedStructure.split(/[^a-zA-Z0-9_]/));

  const intersection = [...tokens1].filter((t) => tokens2.has(t)).length;
  const union = new Set([...tokens1, ...tokens2]).size;

  return union === 0 ? 0 : intersection / union;
}

/**
 * Find common and different fields between interfaces
 */
function analyzeFieldDifference(
  type1: TypeSignature,
  type2: TypeSignature,
): { common: string[]; onlyIn1: string[]; onlyIn2: string[] } {
  const fields1 = new Set(type1.fields ?? []);
  const fields2 = new Set(type2.fields ?? []);

  return {
    common: [...fields1].filter((f) => fields2.has(f)),
    onlyIn1: [...fields1].filter((f) => !fields2.has(f)),
    onlyIn2: [...fields2].filter((f) => !fields1.has(f)),
  };
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

/**
 * Find duplicate types in a directory
 */
export async function findTypeDuplicates(
  targetPath: string,
  projectRoot: string,
  options: FindTypeDuplicatesOptions = {},
): Promise<TypeDuplicateInfo[]> {
  const {
    verbose = false,
    ignoreTests = true,
    includeTypes = true,
    includeInterfaces = true,
  } = options;

  // Security: validate path is within project
  const pathValidation = validatePathWithinProject(projectRoot, targetPath);
  if (!pathValidation.valid) {
    throw new Error(`Security: ${pathValidation.error ?? 'Path outside project'}`);
  }

  const duplicates: TypeDuplicateInfo[] = [];

  // Find all TypeScript files
  const allFiles = await findFiles(targetPath, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules', 'dist', '.next', 'coverage'],
  });

  // Filter files
  let files = allFiles.filter((f) => !f.endsWith('.d.ts'));
  if (ignoreTests) {
    files = files.filter((f) => !f.includes('.test.') && !f.includes('.spec.'));
  }

  // Limit files
  if (files.length > LIMITS.MAX_FILES) {
    logger.warn(`Too many files (${files.length}), limiting to ${LIMITS.MAX_FILES}`);
    files = files.slice(0, LIMITS.MAX_FILES);
  }

  // Create ts-morph project
  // Use shared project if provided, otherwise get from pool
  // Support monorepo by finding tsconfig in package or project root
  const project =
    options.project ??
    (() => {
      const tsConfigPath = findTsConfig(targetPath, projectRoot);
      return tsConfigPath ? getProject({ tsConfigPath }) : getProject({});
    })();

  const shouldReleaseProject = !options.project;

  // Extract all types
  const allTypes: TypeSignature[] = [];

  try {
    for (const file of files) {
      try {
        const content = readFile(file);
        if (!content) continue;
        if (content.length > LIMITS.MAX_FILE_SIZE) continue;

        let sourceFile = project.getSourceFile(file);
        if (!sourceFile) {
          sourceFile = project.createSourceFile(file, content, { overwrite: true });
        }

        const relPath = path.relative(projectRoot, file);
        const types = extractTypes(sourceFile, relPath);

        // Filter by kind
        const filteredTypes = types.filter((t) => {
          if (t.kind === 'interface' && !includeInterfaces) return false;
          if (t.kind === 'type' && !includeTypes) return false;
          return true;
        });

        allTypes.push(...filteredTypes);
      } catch (error) {
        if (verbose) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          logger.warn(`Failed to parse ${path.relative(projectRoot, file)}: ${message}`);
        }
      }
    }

    // Group by name (same name in multiple files)
    const byName = new Map<string, TypeSignature[]>();
    for (const type of allTypes) {
      const existing = byName.get(type.name) ?? [];
      existing.push(type);
      byName.set(type.name, existing);
    }

    // Find duplicates by name
    for (const [name, types] of byName) {
      if (types.length < 2) continue;

      // Calculate similarity
      let minSimilarity = 1;

      // Short-circuit for 2-element groups
      if (types.length === 2) {
        const t1 = types[0];
        const t2 = types[1];
        if (t1 && t2) {
          minSimilarity = calculateTypeSimilarity(t1, t2);
        }
      } else {
        for (let i = 0; i < types.length - 1; i++) {
          for (let j = i + 1; j < types.length; j++) {
            const ti = types[i];
            const tj = types[j];
            if (ti && tj) {
              const sim = calculateTypeSimilarity(ti, tj);
              minSimilarity = Math.min(minSimilarity, sim);

              // Early exit when below threshold - can't improve
              if (minSimilarity < SIMILARITY_THRESHOLDS.MERGE) break;
            }
          }
          // Early exit outer loop if already below threshold
          if (minSimilarity < SIMILARITY_THRESHOLDS.MERGE) break;
        }
      }

      // Determine kind
      const kinds = new Set(types.map((t) => t.kind));
      const kind = kinds.size === 1 ? [...kinds][0]! : 'mixed';

      // Recommendation
      let recommendation: 'merge' | 'rename' | 'keep-both' = 'keep-both';
      if (minSimilarity > SIMILARITY_THRESHOLDS.MERGE) {
        recommendation = 'merge';
      } else if (minSimilarity > SIMILARITY_THRESHOLDS.RENAME) {
        recommendation = 'rename';
      }

      // Analyze differences for interfaces
      let commonFields: string[] | undefined;
      let difference: string | undefined;

      if (kind === 'interface' && types.length === 2 && types[0] && types[1]) {
        const diff = analyzeFieldDifference(types[0], types[1]);
        commonFields = diff.common;
        if (diff.onlyIn1.length > 0 || diff.onlyIn2.length > 0) {
          difference = `Only in ${types[0].file}: ${diff.onlyIn1.join(', ') || 'none'}; Only in ${types[1].file}: ${diff.onlyIn2.join(', ') || 'none'}`;
        }
      }

      const duplicateInfo: TypeDuplicateInfo = {
        name,
        kind,
        locations: types.map((t) => ({
          file: t.file,
          line: t.line,
          exported: t.exported,
          name: t.name,
        })),
        similarity: minSimilarity,
        recommendation,
      };

      if (commonFields) duplicateInfo.commonFields = commonFields;
      if (difference) duplicateInfo.difference = difference;

      duplicates.push(duplicateInfo);
    }

    // Find types with identical structures but different names
    const byHash = new Map<string, TypeSignature[]>();
    for (const type of allTypes) {
      // Skip empty structures
      if (type.normalizedStructure.length < 5) continue;

      const existing = byHash.get(type.structureHash) ?? [];
      existing.push(type);
      byHash.set(type.structureHash, existing);
    }

    for (const [, types] of byHash) {
      if (types.length < 2) continue;

      // Skip if all have same name (already caught above)
      const uniqueNames = new Set(types.map((t) => t.name));
      if (uniqueNames.size === 1) continue;

      // Sort names for consistent output
      const sortedNames = [...uniqueNames].sort((a, b) => {
        const aExported = types.some((t) => t.name === a && t.exported);
        const bExported = types.some((t) => t.name === b && t.exported);
        if (aExported && !bExported) return -1;
        if (!aExported && bExported) return 1;
        return a.localeCompare(b);
      });

      const kinds = new Set(types.map((t) => t.kind));
      const kind = kinds.size === 1 ? [...kinds][0]! : 'mixed';

      duplicates.push({
        name: `[identical structure] ${sortedNames.join(' / ')}`,
        kind,
        locations: types.map((t) => ({
          file: t.file,
          line: t.line,
          exported: t.exported,
          name: t.name,
        })),
        similarity: 1,
        recommendation: 'merge',
      });
    }

    return duplicates;
  } finally {
    // Release project back to pool if we created it
    if (shouldReleaseProject) {
      releaseProject(project);
    }
  }
}

/**
 * Quick scan for type duplicates without full AST parsing
 */
export async function quickScanTypeDuplicates(targetPath: string): Promise<string[]> {
  const typeNames = new Map<string, string[]>();

  const files = await findFiles(targetPath, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules', 'dist', '.next'],
  });

  const sourceFiles = files.filter((f) => !f.endsWith('.d.ts'));

  for (const file of sourceFiles) {
    const content = readFile(file);
    if (!content) continue;

    // Match: export interface Name
    const interfaces = content.match(/export\s+interface\s+(\w+)/g) ?? [];
    // Match: export type Name =
    const types = content.match(/export\s+type\s+(\w+)\s*=/g) ?? [];

    for (const match of interfaces) {
      const name = match.replace(/export\s+interface\s+/, '');
      const existing = typeNames.get(name) ?? [];
      existing.push(file);
      typeNames.set(name, existing);
    }

    for (const match of types) {
      const name = match.replace(/export\s+type\s+/, '').replace(/\s*=$/, '');
      const existing = typeNames.get(name) ?? [];
      existing.push(file);
      typeNames.set(name, existing);
    }
  }

  return [...typeNames.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([name, files]) => `${name}: ${files.join(', ')}`);
}
