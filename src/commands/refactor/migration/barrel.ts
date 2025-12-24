/**
 * @module commands/refactor/migration/barrel
 * @description Barrel file (index.ts) management
 *
 * Updates barrel files after file migrations.
 */

import * as path from 'path';
import { readFile, writeFile, exists, escapeRegex } from '../../../lib';

// ============================================================================
// BARREL FILE UPDATE
// ============================================================================

/**
 * Update the main barrel file (lib/index.ts) after migrations
 */
export async function updateBarrelFile(
  projectRoot: string,
  movedFiles: Array<{ from: string; to: string }>,
): Promise<boolean> {
  const barrelPath = path.join(projectRoot, 'src', 'lib', 'index.ts');

  if (!exists(barrelPath)) {
    return false;
  }

  let content = readFile(barrelPath);
  if (!content) {
    return false;
  }

  for (const { from, to } of movedFiles) {
    const oldImportPath = from.replace('.ts', '').replace(/\\/g, '/');
    const newImportPath = to.replace('.ts', '').replace(/\\/g, '/');

    // Update export statements
    const oldPattern = new RegExp(
      `(from\\s+['"]\\.\\/?)${escapeRegex(oldImportPath)}(['"])`,
      'g'
    );
    content = content.replace(oldPattern, `$1${newImportPath}$2`);
  }

  return writeFile(barrelPath, content);
}

/**
 * Generate barrel content for a directory
 */
export function generateBarrelContent(
  dirName: string,
  exports: string[],
): string {
  return `/**
 * @module ${dirName}
 * @description Auto-generated barrel export
 */

${exports.join('\n')}
`;
}

/**
 * Analyze file for export types
 */
export function analyzeExports(content: string): {
  hasDefault: boolean;
  hasNamed: boolean;
} {
  return {
    hasDefault: /export\s+default\s+/.test(content),
    hasNamed: /export\s+(const|function|class|interface|type|enum)/.test(content),
  };
}

/**
 * Generate export statement for a file
 */
export function generateExportStatement(
  fileName: string,
  hasDefault: boolean,
  hasNamed: boolean,
): string[] {
  const name = fileName.replace('.ts', '');
  const statements: string[] = [];

  if (hasDefault && hasNamed) {
    statements.push(`export { default as ${name} } from './${name}';`);
    statements.push(`export * from './${name}';`);
  } else if (hasDefault) {
    statements.push(`export { default as ${name} } from './${name}';`);
  } else if (hasNamed) {
    statements.push(`export * from './${name}';`);
  }

  return statements;
}
