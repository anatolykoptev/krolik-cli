/**
 * @module commands/context/parsers/import-graph-swc
 * @description SWC-based import graph analyzer for dependency visualization
 *
 * Uses SWC AST to parse import statements and build a dependency graph.
 * Supports relative imports (../, ./), alias imports (@/, ~/), and detects circular dependencies.
 *
 * @example
 * const graph = buildImportGraphSwc('src/features/booking', ['booking']);
 * console.log(formatImportGraphAscii(graph));
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFile, visitNodeWithCallbacks } from '@/lib/@swc';
import { scanDirectory } from '@/lib/core/fs';

/**
 * Import statement parsed from AST
 */
interface ImportStatement {
  source: string; // Raw import path (e.g., '../utils', '@/lib/db')
  names: string[]; // Imported identifiers
  isTypeOnly: boolean;
}

/**
 * Node in the import graph
 */
export interface ImportNode {
  file: string; // Relative path from root
  imports: string[]; // Files this node imports (resolved paths)
  importedBy: string[]; // Files that import this node
}

/**
 * Complete import graph with circular dependency detection
 */
export interface ImportGraph {
  nodes: ImportNode[];
  circular: string[][]; // Arrays of file paths forming circular chains
}

/**
 * Build import graph from a directory
 *
 * @param dir - Root directory to analyze
 * @param patterns - File name patterns to filter (empty = all files)
 * @returns Import graph with nodes and circular dependency chains
 *
 * @example
 * const graph = buildImportGraphSwc('src/features', ['booking', 'payment']);
 * console.log(`Found ${graph.nodes.length} files`);
 * console.log(`Circular dependencies: ${graph.circular.length}`);
 */
export function buildImportGraphSwc(dir: string, patterns: string[]): ImportGraph {
  if (!fs.existsSync(dir)) {
    return { nodes: [], circular: [] };
  }

  // Step 1: Collect all files and their import statements
  const fileImports = new Map<string, ImportStatement[]>();
  collectFileImports(dir, patterns, fileImports);

  // Step 2: Resolve import paths to actual files
  const resolvedImports = new Map<string, string[]>();
  for (const [filePath, imports] of Array.from(fileImports.entries())) {
    const resolved = imports
      .map((imp) => resolveImportPath(filePath, imp.source, dir))
      .filter((p): p is string => p !== null);
    resolvedImports.set(filePath, resolved);
  }

  // Step 3: Build nodes with importedBy relationships
  const nodes = buildGraphNodes(resolvedImports, dir);

  // Step 4: Detect circular dependencies
  const circular = detectCircularDependencies(nodes);

  return { nodes, circular };
}

/**
 * Collect import statements from all files in directory
 */
function collectFileImports(
  dir: string,
  patterns: string[],
  result: Map<string, ImportStatement[]>,
): void {
  scanDirectory(
    dir,
    (fullPath) => {
      const imports = parseImportStatements(fullPath);
      if (imports.length > 0) {
        result.set(fullPath, imports);
      }
    },
    {
      patterns,
      extensions: ['.ts', '.tsx'],
      includeTests: false,
    },
  );
}

/**
 * Parse import statements from a file using SWC
 */
function parseImportStatements(filePath: string): ImportStatement[] {
  const imports: ImportStatement[] = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return imports;
  }

  try {
    const { ast } = parseFile(filePath, content);

    visitNodeWithCallbacks(ast, {
      onImportDeclaration: (node) => {
        const importNode = node as unknown as {
          source: { value: string };
          specifiers: Array<{
            type: string;
            local: { value: string };
          }>;
          typeOnly?: boolean;
        };

        const source = importNode.source.value;

        // Only track local imports (relative and alias)
        if (!source.startsWith('.') && !source.startsWith('@/') && !source.startsWith('~/')) {
          return;
        }

        const names = importNode.specifiers
          .map((spec) => spec.local?.value)
          .filter((name): name is string => Boolean(name));

        imports.push({
          source,
          names,
          isTypeOnly: importNode.typeOnly ?? false,
        });
      },
    });
  } catch {
    // Parse error - return empty array
    return [];
  }

  return imports;
}

/**
 * Resolve import path to actual file path
 *
 * @param fromFile - File doing the importing
 * @param importPath - Import path (e.g., '../utils', '@/lib/db')
 * @param rootDir - Root directory for alias resolution
 * @returns Resolved absolute path or null if not found
 */
function resolveImportPath(fromFile: string, importPath: string, rootDir: string): string | null {
  let resolved: string;

  if (importPath.startsWith('@/')) {
    // Alias import: @/lib/utils -> rootDir/lib/utils
    const relativePath = importPath.slice(2); // Remove '@/'
    resolved = path.join(rootDir, relativePath);
  } else if (importPath.startsWith('~/')) {
    // Alias import: ~/lib/utils -> rootDir/lib/utils
    const relativePath = importPath.slice(2); // Remove '~/'
    resolved = path.join(rootDir, relativePath);
  } else if (importPath.startsWith('.')) {
    // Relative import: ../utils -> resolve relative to fromFile
    const fromDir = path.dirname(fromFile);
    resolved = path.resolve(fromDir, importPath);
  } else {
    // Not a local import
    return null;
  }

  // Try to resolve to actual file
  return resolveToFile(resolved);
}

/**
 * Resolve path to actual file, trying common extensions
 */
function resolveToFile(basePath: string): string | null {
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];

  for (const ext of extensions) {
    const fullPath = basePath + ext;
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Build graph nodes with import/importedBy relationships
 */
function buildGraphNodes(resolvedImports: Map<string, string[]>, rootDir: string): ImportNode[] {
  const nodes = new Map<string, ImportNode>();

  // Initialize nodes
  for (const [filePath, imports] of Array.from(resolvedImports.entries())) {
    const relativePath = path.relative(rootDir, filePath);
    if (!nodes.has(filePath)) {
      nodes.set(filePath, {
        file: relativePath,
        imports: [],
        importedBy: [],
      });
    }

    const node = nodes.get(filePath)!;
    node.imports = imports.map((imp) => path.relative(rootDir, imp));

    // Ensure imported files have nodes
    for (const importedFile of imports) {
      if (!nodes.has(importedFile)) {
        nodes.set(importedFile, {
          file: path.relative(rootDir, importedFile),
          imports: [],
          importedBy: [],
        });
      }
    }
  }

  // Build importedBy relationships
  for (const [filePath, imports] of Array.from(resolvedImports.entries())) {
    for (const importedFile of imports) {
      const importedNode = nodes.get(importedFile);
      if (importedNode) {
        const relativePath = path.relative(rootDir, filePath);
        if (!importedNode.importedBy.includes(relativePath)) {
          importedNode.importedBy.push(relativePath);
        }
      }
    }
  }

  return Array.from(nodes.values());
}

/**
 * Detect circular dependencies using depth-first search
 */
function detectCircularDependencies(nodes: ImportNode[]): string[][] {
  const circular: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const nodeMap = new Map(nodes.map((n) => [n.file, n]));

  function dfs(file: string, path: string[]): void {
    visited.add(file);
    recursionStack.add(file);

    const node = nodeMap.get(file);
    if (!node) {
      recursionStack.delete(file);
      return;
    }

    for (const importFile of node.imports) {
      if (!recursionStack.has(importFile)) {
        if (!visited.has(importFile)) {
          dfs(importFile, [...path, file]);
        }
      } else {
        // Found a cycle
        const cycleStart = path.indexOf(importFile);
        if (cycleStart !== -1) {
          const cycle = [...path.slice(cycleStart), file, importFile];
          // Only add if not already found
          if (!circular.some((c) => arraysEqual(c, cycle))) {
            circular.push(cycle);
          }
        }
      }
    }

    recursionStack.delete(file);
  }

  // Run DFS from each node
  for (const node of nodes) {
    if (!visited.has(node.file)) {
      dfs(node.file, []);
    }
  }

  return circular;
}

/**
 * Check if two arrays are equal
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Format import graph as ASCII tree
 *
 * @param graph - Import graph to format
 * @param options - Formatting options
 * @returns ASCII representation of the graph
 *
 * @example
 * const output = formatImportGraphAscii(graph);
 * console.log(output);
 */
export function formatImportGraphAscii(
  graph: ImportGraph,
  options: {
    maxDepth?: number;
    showImportedBy?: boolean;
    mermaid?: boolean;
  } = {},
): string {
  const { maxDepth = 3, showImportedBy = false, mermaid = false } = options;

  if (mermaid) {
    return formatMermaid(graph);
  }

  const lines: string[] = [];

  // Header
  lines.push('Import Graph');
  lines.push('='.repeat(60));
  lines.push(`Total files: ${graph.nodes.length}`);
  lines.push(`Circular dependencies: ${graph.circular.length}`);
  lines.push('');

  // Circular dependencies first
  if (graph.circular.length > 0) {
    lines.push('Circular Dependencies:');
    for (const cycle of graph.circular) {
      lines.push(`  ${cycle.join(' → ')}`);
    }
    lines.push('');
  }

  // Find root nodes (not imported by anyone or imported the least)
  const roots = graph.nodes
    .filter((n) => n.importedBy.length === 0)
    .sort((a, b) => b.imports.length - a.imports.length);

  if (roots.length === 0) {
    // All files are imported - pick nodes with fewest importers
    const sortedByImporters = [...graph.nodes].sort(
      (a, b) => a.importedBy.length - b.importedBy.length,
    );
    roots.push(...sortedByImporters.slice(0, 5));
  }

  // Build tree from roots
  lines.push('Dependency Tree:');
  const nodeMap = new Map(graph.nodes.map((n) => [n.file, n]));
  const visited = new Set<string>();

  for (const root of roots.slice(0, 10)) {
    // Limit to 10 roots
    buildTree(root.file, nodeMap, visited, lines, 0, maxDepth, '', showImportedBy);
  }

  return lines.join('\n');
}

/**
 * Build ASCII tree recursively
 */
function buildTree(
  file: string,
  nodeMap: Map<string, ImportNode>,
  visited: Set<string>,
  lines: string[],
  depth: number,
  maxDepth: number,
  prefix: string,
  showImportedBy: boolean,
): void {
  const node = nodeMap.get(file);
  if (!node) return;

  const isVisited = visited.has(file);
  visited.add(file);

  // Format line
  const marker = isVisited ? '↻ ' : '• ';
  const fileName = path.basename(file);
  const importCount = node.imports.length;
  const importedByCount = node.importedBy.length;

  let line = `${prefix}${marker}${fileName}`;
  if (importCount > 0) {
    line += ` (imports: ${importCount})`;
  }
  if (showImportedBy && importedByCount > 0) {
    line += ` (imported by: ${importedByCount})`;
  }

  lines.push(line);

  // Don't recurse if already visited or max depth reached
  if (isVisited || depth >= maxDepth) {
    return;
  }

  // Recurse into imports
  const imports = node.imports.slice(0, 10); // Limit to 10 imports
  for (let i = 0; i < imports.length; i++) {
    const isLast = i === imports.length - 1;
    const childPrefix = prefix + (isLast ? '  └─ ' : '  ├─ ');
    const nextPrefix = prefix + (isLast ? '     ' : '  │  ');

    buildTree(
      imports[i]!,
      nodeMap,
      visited,
      lines,
      depth + 1,
      maxDepth,
      childPrefix.slice(0, -4) + nextPrefix.slice(-4),
      showImportedBy,
    );
  }
}

/**
 * Format import graph as Mermaid diagram
 */
function formatMermaid(graph: ImportGraph): string {
  const lines: string[] = [];

  lines.push('```mermaid');
  lines.push('graph TD');

  // Create nodes
  const nodeIds = new Map<string, string>();
  for (let i = 0; i < graph.nodes.length; i++) {
    const node = graph.nodes[i]!;
    const id = `N${i}`;
    nodeIds.set(node.file, id);

    const fileName = path.basename(node.file);
    lines.push(`  ${id}["${fileName}"]`);
  }

  // Create edges
  for (const node of graph.nodes) {
    const fromId = nodeIds.get(node.file);
    if (!fromId) continue;

    for (const importFile of node.imports) {
      const toId = nodeIds.get(importFile);
      if (toId) {
        lines.push(`  ${fromId} --> ${toId}`);
      }
    }
  }

  // Highlight circular dependencies
  if (graph.circular.length > 0) {
    lines.push('');
    lines.push('  %% Circular dependencies');
    for (const cycle of graph.circular) {
      for (let i = 0; i < cycle.length - 1; i++) {
        const fromId = nodeIds.get(cycle[i]!);
        const toId = nodeIds.get(cycle[i + 1]!);
        if (fromId && toId) {
          lines.push(`  ${fromId} -.->|circular| ${toId}`);
        }
      }
    }
  }

  lines.push('```');

  return lines.join('\n');
}

/**
 * Filter graph by domain/feature patterns
 *
 * @param graph - Import graph to filter
 * @param patterns - Patterns to match (e.g., ['booking', 'payment'])
 * @returns Filtered graph containing only matching nodes
 *
 * @example
 * const filtered = filterGraphByPatterns(graph, ['booking']);
 */
export function filterGraphByPatterns(graph: ImportGraph, patterns: string[]): ImportGraph {
  if (patterns.length === 0) {
    return graph;
  }

  const matchingFiles = new Set<string>();

  // Find files matching patterns
  for (const node of graph.nodes) {
    const fileLower = node.file.toLowerCase();
    if (patterns.some((p) => fileLower.includes(p.toLowerCase()))) {
      matchingFiles.add(node.file);
    }
  }

  // Include files that import or are imported by matching files
  for (const node of graph.nodes) {
    if (matchingFiles.has(node.file)) {
      // Add all imports
      for (const imp of node.imports) {
        matchingFiles.add(imp);
      }
      // Add all importers
      for (const imp of node.importedBy) {
        matchingFiles.add(imp);
      }
    }
  }

  // Filter nodes
  const filteredNodes = graph.nodes.filter((n) => matchingFiles.has(n.file));

  // Filter circular dependencies
  const filteredCircular = graph.circular.filter((cycle) =>
    cycle.every((file) => matchingFiles.has(file)),
  );

  return {
    nodes: filteredNodes,
    circular: filteredCircular,
  };
}

/**
 * Get statistics about the import graph
 */
export function getGraphStats(graph: ImportGraph): {
  totalFiles: number;
  totalImports: number;
  circularDependencies: number;
  avgImportsPerFile: number;
  maxImports: { file: string; count: number };
  mostImported: { file: string; count: number };
} {
  const totalFiles = graph.nodes.length;
  const totalImports = graph.nodes.reduce((sum, n) => sum + n.imports.length, 0);
  const circularDependencies = graph.circular.length;
  const avgImportsPerFile = totalFiles > 0 ? totalImports / totalFiles : 0;

  const maxImports = graph.nodes.reduce(
    (max, n) => (n.imports.length > max.count ? { file: n.file, count: n.imports.length } : max),
    { file: '', count: 0 },
  );

  const mostImported = graph.nodes.reduce(
    (max, n) =>
      n.importedBy.length > max.count ? { file: n.file, count: n.importedBy.length } : max,
    { file: '', count: 0 },
  );

  return {
    totalFiles,
    totalImports,
    circularDependencies,
    avgImportsPerFile,
    maxImports,
    mostImported,
  };
}
