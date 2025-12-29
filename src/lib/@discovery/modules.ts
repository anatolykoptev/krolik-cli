/**
 * @module lib/@discovery/modules
 * @description Universal module registry scanner with nested module support
 *
 * Scans lib/ directories recursively and extracts exported functions, types, classes.
 * A directory is considered a module if it has an index.ts file.
 *
 * Features:
 * - Discovers top-level modules (e.g., @fs, analysis)
 * - Discovers nested modules (e.g., core/fs, integrations/context7)
 * - Handles wrapper modules that re-export from subdirectories
 * - Generates proper import paths for all module depths
 *
 * @example
 * ```ts
 * import { scanLibModules, ModuleInfo } from '@/lib/@discovery';
 *
 * const result = scanLibModules('/path/to/project');
 * for (const mod of result.modules) {
 *   console.log(`${mod.importPath}: ${mod.exports.length} exports`);
 *   // @/lib/@fs: 5 exports
 *   // @/lib/@core: 12 exports (wrapper)
 *   // @/lib/@core/fs: 3 exports
 *   // @/lib/@integrations/context7: 25 exports
 * }
 * ```
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeSourceFile, type ExportedMember } from './source-analyzer';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Information about a lib module
 */
export interface ModuleInfo {
  /** Module name without @ prefix (e.g., 'fs', 'discovery', 'context7') */
  name: string;
  /** Full module import path (e.g., '@/lib/@fs', '@/lib/@integrations/context7') */
  importPath: string;
  /** Relative path from project root */
  relativePath: string;
  /** Module description from JSDoc */
  description?: string;
  /** Exported members */
  exports: ModuleExport[];
  /** Usage example from JSDoc */
  example?: string;
  /** Nesting depth (0 = top-level, 1 = one level deep, etc.) */
  depth: number;
  /** Parent module name if nested (e.g., 'core' for 'core/fs') */
  parentModule?: string;
  /** Whether this module has child modules */
  hasChildren: boolean;
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

/**
 * Internal options for recursive scanning
 */
interface ScanOptions {
  /** Maximum depth to scan (default: 3) */
  maxDepth: number;
  /** Current depth in recursion */
  currentDepth: number;
  /** Parent module path segments (e.g., ['core'] for core/fs) */
  parentSegments: string[];
  /** Base lib directory */
  libDir: string;
  /** Project root directory */
  projectRoot: string;
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

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default maximum depth for recursive scanning */
const DEFAULT_MAX_DEPTH = 3;

/** Patterns to skip when scanning directories */
const SKIP_PATTERNS: readonly RegExp[] = [
  /^\./, // Hidden directories (.git, .cache, etc.)
  /^__/, // Double underscore directories (__tests__, __mocks__, etc.)
  /\.test$/, // Test directories
  /\.spec$/, // Spec directories
  /^node_modules$/, // Node modules
];

/** Export kind priority for sorting (lower = higher priority) */
const EXPORT_KIND_ORDER: Record<ModuleExport['kind'], number> = {
  function: 0,
  class: 1,
  type: 2,
  interface: 3,
  enum: 4,
  const: 5,
};

// ============================================================================
// MODULE SCANNING
// ============================================================================

/**
 * Check if a directory should be skipped during scanning.
 *
 * @param dirName - Directory name to check
 * @returns True if the directory should be skipped
 */
function shouldSkipDirectory(dirName: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(dirName));
}

/**
 * Check if a directory has child modules (subdirectories with index.ts).
 *
 * @param dirPath - Directory path to check
 * @returns True if any subdirectory has an index.ts file
 */
function hasChildModules(dirPath: string): boolean {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.some((entry) => {
      if (!entry.isDirectory() || shouldSkipDirectory(entry.name)) {
        return false;
      }
      const indexPath = path.join(dirPath, entry.name, 'index.ts');
      return fs.existsSync(indexPath);
    });
  } catch {
    return false;
  }
}

/**
 * Extract the display name for a module from its directory name.
 * Strips the @ prefix if present.
 *
 * @param dirName - Directory name (e.g., '@fs', 'context7')
 * @returns Clean module name (e.g., 'fs', 'context7')
 */
function getModuleDisplayName(dirName: string): string {
  return dirName.startsWith('@') ? dirName.slice(1) : dirName;
}

/**
 * Build the import path for a module.
 *
 * @param libDir - Base lib directory
 * @param modulePath - Full path to the module
 * @returns Import path (e.g., '@/lib/@fs', '@/lib/@core/fs')
 */
function buildImportPath(libDir: string, modulePath: string): string {
  const relativeTolLib = path.relative(libDir, modulePath);
  return `@/lib/${relativeTolLib}`;
}

/**
 * Collect exports from all .ts files in a module directory (non-recursive).
 *
 * @param modulePath - Path to the module directory
 * @returns Array of module exports
 */
function collectModuleExports(modulePath: string): ModuleExport[] {
  const exports: ModuleExport[] = [];
  const seenNames = new Set<string>();

  // Get all .ts files in the module (excluding test files)
  let files: string[];
  try {
    files = fs
      .readdirSync(modulePath)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.spec.ts'));
  } catch {
    return exports;
  }

  for (const file of files) {
    const filePath = path.join(modulePath, file);

    // Ensure it's a file, not a directory
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    // Read and analyze the file
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const result = analyzeSourceFile(filePath, content);
    if (!result.success) continue;

    // Add unique exports
    for (const exp of result.exports) {
      if (seenNames.has(exp.name)) continue;
      seenNames.add(exp.name);
      exports.push(toModuleExport(exp));
    }
  }

  // Sort exports by kind priority, then by name
  exports.sort((a, b) => {
    const kindDiff = (EXPORT_KIND_ORDER[a.kind] ?? 9) - (EXPORT_KIND_ORDER[b.kind] ?? 9);
    if (kindDiff !== 0) return kindDiff;
    return a.name.localeCompare(b.name);
  });

  return exports;
}

/**
 * Scan a single module directory and return its info.
 *
 * @param modulePath - Full path to the module directory
 * @param options - Scan options with context
 * @returns ModuleInfo or null if not a valid module
 */
function scanSingleModule(modulePath: string, options: ScanOptions): ModuleInfo | null {
  const indexPath = path.join(modulePath, 'index.ts');

  // A module must have an index.ts file
  if (!fs.existsSync(indexPath)) {
    return null;
  }

  const dirName = path.basename(modulePath);
  const moduleName = getModuleDisplayName(dirName);
  const relativePath = path.relative(options.projectRoot, modulePath);
  const importPath = buildImportPath(options.libDir, modulePath);
  const hasChildren = hasChildModules(modulePath);

  // Extract JSDoc description and example
  const { description, example } = extractModuleDescription(indexPath);

  // Collect all exports from the module
  const exports = collectModuleExports(modulePath);

  // Determine parent module name from path segments
  const lastSegment = options.parentSegments.at(-1);
  const parentModule = lastSegment ? getModuleDisplayName(lastSegment) : undefined;

  return {
    name: moduleName,
    importPath,
    relativePath,
    exports,
    depth: options.currentDepth,
    hasChildren,
    ...(description ? { description } : {}),
    ...(example ? { example } : {}),
    ...(parentModule ? { parentModule } : {}),
  };
}

/**
 * Recursively scan a directory for modules.
 *
 * This function discovers all modules (directories with index.ts) at the current level
 * and recursively scans subdirectories up to maxDepth.
 *
 * @param currentDir - Directory to scan
 * @param options - Scan options
 * @returns Array of discovered modules
 */
function scanDirectoryRecursive(currentDir: string, options: ScanOptions): ModuleInfo[] {
  const modules: ModuleInfo[] = [];

  // Stop if we've reached max depth
  if (options.currentDepth > options.maxDepth) {
    return modules;
  }

  // Get directory entries
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return modules;
  }

  for (const entry of entries) {
    // Skip non-directories
    if (!entry.isDirectory()) continue;

    // Skip hidden/internal directories
    if (shouldSkipDirectory(entry.name)) continue;

    const modulePath = path.join(currentDir, entry.name);
    const indexPath = path.join(modulePath, 'index.ts');
    const hasIndex = fs.existsSync(indexPath);

    if (hasIndex) {
      // This is a module - scan it
      const moduleInfo = scanSingleModule(modulePath, options);

      if (moduleInfo) {
        // Include modules even with 0 exports if they have children
        // (wrapper modules that only re-export)
        if (moduleInfo.exports.length > 0 || moduleInfo.hasChildren) {
          modules.push(moduleInfo);
        }
      }

      // If this module has children, recurse into it
      if (hasChildModules(modulePath)) {
        const childModules = scanDirectoryRecursive(modulePath, {
          ...options,
          currentDepth: options.currentDepth + 1,
          parentSegments: [...options.parentSegments, entry.name],
        });
        modules.push(...childModules);
      }
    } else {
      // No index.ts at this level, but check if there are modules deeper
      // This handles cases like lib/@integrations/ where integrations has no index
      // but integrations/context7 does
      const childModules = scanDirectoryRecursive(modulePath, {
        ...options,
        currentDepth: options.currentDepth + 1,
        parentSegments: [...options.parentSegments, entry.name],
      });
      modules.push(...childModules);
    }
  }

  return modules;
}

// ============================================================================
// MODULE SORTING
// ============================================================================

/**
 * Compare two modules for sorting.
 *
 * Sorting order:
 * 1. By depth (top-level first)
 * 2. Within same depth: parent modules before their children
 * 3. Alphabetically by import path
 *
 * @param a - First module
 * @param b - Second module
 * @returns Comparison result
 */
function compareModules(a: ModuleInfo, b: ModuleInfo): number {
  // First, sort by depth
  if (a.depth !== b.depth) {
    return a.depth - b.depth;
  }

  // Then alphabetically by import path for consistent ordering
  return a.importPath.localeCompare(b.importPath);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Options for scanning lib modules
 */
export interface ScanLibModulesOptions {
  /** Custom lib path (default: src/lib) */
  libPath?: string;
  /** Maximum depth to scan (default: 3) */
  maxDepth?: number;
  /** Include modules with 0 exports that have children (default: true) */
  includeWrapperModules?: boolean;
}

/**
 * Scan all lib modules in the project recursively.
 *
 * Discovers all modules (directories with index.ts) in the lib directory,
 * including nested modules like core/fs, integrations/context7, etc.
 *
 * @param projectRoot - Project root directory
 * @param optionsOrLibPath - Options object or legacy libPath string for backward compatibility
 * @returns Module scan result with all modules and their exports
 *
 * @example
 * ```ts
 * // Basic usage
 * const result = scanLibModules('/path/to/project');
 * console.log(`Found ${result.modules.length} modules with ${result.totalExports} exports`);
 *
 * // With options
 * const result = scanLibModules('/path/to/project', {
 *   maxDepth: 2,
 *   includeWrapperModules: false,
 * });
 *
 * // Iterate modules
 * for (const mod of result.modules) {
 *   console.log(`${mod.importPath} (depth: ${mod.depth})`);
 *   if (mod.hasChildren) console.log('  ^ has child modules');
 *   for (const exp of mod.exports) {
 *     console.log(`  - ${exp.name} (${exp.kind})`);
 *   }
 * }
 * ```
 */
export function scanLibModules(
  projectRoot: string,
  optionsOrLibPath?: string | ScanLibModulesOptions,
): ModuleScanResult {
  const startTime = Date.now();

  // Handle backward compatibility: accept either string (libPath) or options object
  const options: ScanLibModulesOptions =
    typeof optionsOrLibPath === 'string' ? { libPath: optionsOrLibPath } : (optionsOrLibPath ?? {});

  const libDir = options.libPath ?? path.join(projectRoot, 'src', 'lib');
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const includeWrapperModules = options.includeWrapperModules ?? true;

  // Check if lib directory exists
  if (!fs.existsSync(libDir)) {
    return { modules: [], totalExports: 0, durationMs: Date.now() - startTime };
  }

  // Scan recursively starting from lib directory
  const scanOptions: ScanOptions = {
    maxDepth,
    currentDepth: 0,
    parentSegments: [],
    libDir,
    projectRoot,
  };

  let modules = scanDirectoryRecursive(libDir, scanOptions);

  // Filter out wrapper modules if requested
  if (!includeWrapperModules) {
    modules = modules.filter((mod) => mod.exports.length > 0);
  }

  // Sort modules
  modules.sort(compareModules);

  // Calculate total exports
  const totalExports = modules.reduce((sum, mod) => sum + mod.exports.length, 0);

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
