/**
 * @module lib/@discovery/modules
 * @description Internal module registry scanner
 *
 * Scans lib/@* modules and extracts exported functions, types, classes.
 * Used to generate AI-friendly documentation of reusable utilities.
 *
 * @example
 * ```ts
 * import { scanLibModules, ModuleInfo } from '@/lib/@discovery';
 *
 * const modules = scanLibModules('/path/to/project');
 * for (const mod of modules) {
 *   console.log(`@${mod.name}: ${mod.exports.length} exports`);
 * }
 * ```
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeSourceFile, type ExportedMember } from '../@ast-analysis';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Information about a lib module
 */
export interface ModuleInfo {
  /** Module name without @ prefix (e.g., 'fs', 'discovery') */
  name: string;
  /** Full module path (e.g., '@/lib/@fs') */
  importPath: string;
  /** Relative path from project root */
  relativePath: string;
  /** Module description from JSDoc */
  description?: string;
  /** Exported members */
  exports: ModuleExport[];
  /** Usage example from JSDoc */
  example?: string;
}

/**
 * Exported member from a module
 */
export interface ModuleExport {
  /** Export name */
  name: string;
  /** Export kind */
  kind: 'function' | 'class' | 'type' | 'interface' | 'enum' | 'const';
  /** Brief description */
  description?: string;
  /** Function signature (for functions) */
  signature?: string;
  /** Parameters (for functions) */
  params?: Array<{ name: string; type?: string }>;
  /** Return type (for functions) */
  returnType?: string;
  /** Whether it's async */
  isAsync?: boolean;
}

/**
 * Result of module scanning
 */
export interface ModuleScanResult {
  /** Scanned modules */
  modules: ModuleInfo[];
  /** Total export count */
  totalExports: number;
  /** Scan duration in ms */
  durationMs: number;
}

// ============================================================================
// MODULE DESCRIPTION EXTRACTION
// ============================================================================

/**
 * Extract module description from index.ts JSDoc
 */
function extractModuleDescription(indexPath: string): {
  description?: string;
  example?: string;
} {
  try {
    const content = fs.readFileSync(indexPath, 'utf-8');

    // Extract @description from JSDoc
    const descMatch = content.match(/@description\s+(.+?)(?=\n\s*\*\s*@|\n\s*\*\/)/s);
    const description = descMatch?.[1]?.trim().replace(/\n\s*\*\s*/g, ' ');

    // Extract @example from JSDoc
    const exampleMatch = content.match(/@example\s*\n\s*\*\s*```[\s\S]*?```/);
    const example = exampleMatch?.[0]
      ?.replace(/@example\s*\n\s*\*\s*/, '')
      .replace(/\n\s*\*\s*/g, '\n')
      .trim();

    return {
      ...(description ? { description } : {}),
      ...(example ? { example } : {}),
    };
  } catch {
    return {};
  }
}

// ============================================================================
// EXPORT EXTRACTION
// ============================================================================

/**
 * Convert ExportedMember to ModuleExport
 */
function toModuleExport(exp: ExportedMember): ModuleExport {
  const result: ModuleExport = {
    name: exp.name,
    kind: exp.kind,
  };

  if (exp.kind === 'function') {
    if (exp.params.length > 0) {
      result.params = exp.params.map((p) => ({
        name: p.name,
        ...(p.type ? { type: p.type } : {}),
      }));
    }
    if (exp.returnType) {
      result.returnType = exp.returnType;
    }
    if (exp.isAsync) {
      result.isAsync = true;
    }
    // Build signature
    const paramStr = exp.params.map((p) => (p.type ? `${p.name}: ${p.type}` : p.name)).join(', ');
    result.signature = `(${paramStr})${exp.returnType ? `: ${exp.returnType}` : ''}`;
  }

  return result;
}

/**
 * Scan a single module directory
 */
function scanModule(modulePath: string, projectRoot: string): ModuleInfo | null {
  const indexPath = path.join(modulePath, 'index.ts');
  if (!fs.existsSync(indexPath)) {
    return null;
  }

  const moduleName = path.basename(modulePath).replace(/^@/, '');
  const relativePath = path.relative(projectRoot, modulePath);

  // Extract description from index.ts
  const { description, example } = extractModuleDescription(indexPath);

  // Find all .ts files in the module
  const exports: ModuleExport[] = [];
  const seenNames = new Set<string>();

  // Scan index.ts and all direct .ts files
  const files = fs
    .readdirSync(modulePath)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  for (const file of files) {
    const filePath = path.join(modulePath, file);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    const result = analyzeSourceFile(filePath);
    if (!result.success) continue;

    for (const exp of result.exports) {
      // Skip duplicates (re-exports)
      if (seenNames.has(exp.name)) continue;
      seenNames.add(exp.name);

      exports.push(toModuleExport(exp));
    }
  }

  // Sort: functions first, then types, then rest
  exports.sort((a, b) => {
    const kindOrder = { function: 0, class: 1, type: 2, interface: 3, enum: 4, const: 5 };
    return (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9);
  });

  return {
    name: moduleName,
    importPath: `@/lib/@${moduleName}`,
    relativePath,
    ...(description ? { description } : {}),
    exports,
    ...(example ? { example } : {}),
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Scan all lib/@* modules in the project
 *
 * @param projectRoot - Project root directory
 * @param libPath - Optional custom lib path (default: src/lib)
 * @returns Module scan result with all modules and their exports
 *
 * @example
 * ```ts
 * const result = scanLibModules('/path/to/project');
 * console.log(`Found ${result.modules.length} modules with ${result.totalExports} exports`);
 *
 * for (const mod of result.modules) {
 *   console.log(`\n@${mod.name}:`);
 *   for (const exp of mod.exports) {
 *     console.log(`  - ${exp.name} (${exp.kind})`);
 *   }
 * }
 * ```
 */
export function scanLibModules(projectRoot: string, libPath?: string): ModuleScanResult {
  const startTime = Date.now();
  const libDir = libPath ?? path.join(projectRoot, 'src', 'lib');

  if (!fs.existsSync(libDir)) {
    return { modules: [], totalExports: 0, durationMs: Date.now() - startTime };
  }

  const modules: ModuleInfo[] = [];
  let totalExports = 0;

  // Find all @* directories
  const entries = fs.readdirSync(libDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('@')) {
      continue;
    }

    const modulePath = path.join(libDir, entry.name);
    const moduleInfo = scanModule(modulePath, projectRoot);

    if (moduleInfo && moduleInfo.exports.length > 0) {
      modules.push(moduleInfo);
      totalExports += moduleInfo.exports.length;
    }
  }

  // Sort modules by name
  modules.sort((a, b) => a.name.localeCompare(b.name));

  return {
    modules,
    totalExports,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Format modules as AI-friendly markdown
 *
 * @param result - Module scan result
 * @returns Markdown documentation
 */
export function formatModulesMarkdown(result: ModuleScanResult): string {
  if (result.modules.length === 0) {
    return '> No reusable lib modules found.';
  }

  const lines: string[] = [];
  lines.push('### Reusable Lib Modules');
  lines.push('');
  lines.push(`> ${result.modules.length} modules, ${result.totalExports} exports`);
  lines.push('');

  for (const mod of result.modules) {
    // Module header
    lines.push(`#### \`${mod.importPath}\``);
    if (mod.description) {
      lines.push(mod.description);
    }
    lines.push('');

    // Group exports by kind
    const functions = mod.exports.filter((e) => e.kind === 'function');
    const types = mod.exports.filter((e) => ['type', 'interface', 'enum'].includes(e.kind));
    const classes = mod.exports.filter((e) => e.kind === 'class');

    // Functions
    if (functions.length > 0) {
      lines.push('**Functions:**');
      for (const fn of functions) {
        const asyncPrefix = fn.isAsync ? 'async ' : '';
        lines.push(`- \`${asyncPrefix}${fn.name}${fn.signature || '()'}\``);
      }
      lines.push('');
    }

    // Types
    if (types.length > 0) {
      lines.push('**Types:**');
      lines.push(types.map((t) => `\`${t.name}\``).join(', '));
      lines.push('');
    }

    // Classes
    if (classes.length > 0) {
      lines.push('**Classes:**');
      lines.push(classes.map((c) => `\`${c.name}\``).join(', '));
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Get module by name
 *
 * @param result - Module scan result
 * @param name - Module name (with or without @ prefix)
 * @returns Module info or undefined
 */
export function getModule(result: ModuleScanResult, name: string): ModuleInfo | undefined {
  const cleanName = name.replace(/^@/, '');
  return result.modules.find((m) => m.name === cleanName);
}

/**
 * Search exports across all modules
 *
 * @param result - Module scan result
 * @param query - Search query (matches name)
 * @returns Matching exports with module info
 */
export function searchExports(
  result: ModuleScanResult,
  query: string,
): Array<{ module: ModuleInfo; export: ModuleExport }> {
  const matches: Array<{ module: ModuleInfo; export: ModuleExport }> = [];
  const lowerQuery = query.toLowerCase();

  for (const mod of result.modules) {
    for (const exp of mod.exports) {
      if (exp.name.toLowerCase().includes(lowerQuery)) {
        matches.push({ module: mod, export: exp });
      }
    }
  }

  return matches;
}
