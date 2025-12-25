/**
 * @module commands/context/helpers/tree
 * @description Project tree generation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProjectTree } from '../types';

const MAX_DEPTH = 3;
const MAX_EXTENSIONS = 3;

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  'coverage',
  '.pnpm',
]);

const IMPORTANT_DIRS = new Set(['src', 'apps', 'packages', 'lib', 'components', 'pages', 'api']);

const KEY_FILES = new Set(['package.json', 'tsconfig.json', 'CLAUDE.md', 'README.md']);

interface TreeState {
  lines: string[];
  totalFiles: number;
  totalDirs: number;
}

/**
 * Check if directory should be included
 */
function shouldIncludeDir(name: string): boolean {
  return !EXCLUDE_DIRS.has(name) && !name.startsWith('.');
}

/**
 * Sort directories (important first, then alphabetically)
 */
function sortDirs(dirs: fs.Dirent[]): fs.Dirent[] {
  return dirs.sort((a, b) => {
    const aImportant = IMPORTANT_DIRS.has(a.name);
    const bImportant = IMPORTANT_DIRS.has(b.name);
    if (aImportant && !bImportant) return -1;
    if (!aImportant && bImportant) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get file extensions summary
 */
function getExtensionsSummary(files: fs.Dirent[]): string {
  const exts = [...new Set(files.map((f) => path.extname(f.name)).filter(Boolean))];
  return exts.slice(0, MAX_EXTENSIONS).join(', ');
}

/**
 * Format directory entry
 */
function formatDirEntry(
  prefix: string,
  name: string,
  isLast: boolean,
): { line: string; subPrefix: string } {
  const connector = isLast ? '└── ' : '├── ';
  const subPrefix = isLast ? '    ' : '│   ';
  return {
    line: `${prefix}${connector}${name}/`,
    subPrefix: prefix + subPrefix,
  };
}

/**
 * Process files at current level
 */
function processFiles(state: TreeState, files: fs.Dirent[], prefix: string, depth: number): void {
  if (files.length === 0) return;

  if (depth > 0) {
    // Show file count summary at non-root levels
    const extStr = getExtensionsSummary(files);
    state.lines.push(`${prefix}└── (${files.length} files: ${extStr})`);
    state.totalFiles += files.length;
    return;
  }

  // At root, show only key files
  const keyFiles = files.filter((f) => KEY_FILES.has(f.name));
  for (const file of keyFiles) {
    state.lines.push(`${prefix}├── ${file.name}`);
    state.totalFiles++;
  }
}

/**
 * Scan directory recursively
 */
function scanDir(state: TreeState, dir: string, prefix: string, depth: number): void {
  if (depth > MAX_DEPTH) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const dirs = sortDirs(entries.filter((e) => e.isDirectory() && shouldIncludeDir(e.name)));
  const files = entries.filter((e) => e.isFile() && !e.name.startsWith('.'));

  // Process directories
  for (let i = 0; i < dirs.length; i++) {
    const entry = dirs[i];
    if (!entry) continue;

    const isLast = i === dirs.length - 1 && files.length === 0;
    const { line, subPrefix } = formatDirEntry(prefix, entry.name, isLast);

    state.lines.push(line);
    state.totalDirs++;

    scanDir(state, path.join(dir, entry.name), subPrefix, depth + 1);
  }

  // Process files
  processFiles(state, files, prefix, depth);
}

// Note: tree.ts uses a custom scanDir with sorted output and tree formatting
// This is intentionally kept separate from the unified scanner

/**
 * Generate project tree structure
 */
export function generateProjectTree(projectRoot: string): ProjectTree {
  const state: TreeState = {
    lines: [`${path.basename(projectRoot)}/`],
    totalFiles: 0,
    totalDirs: 0,
  };

  scanDir(state, projectRoot, '', 0);

  return {
    structure: state.lines.join('\n'),
    totalFiles: state.totalFiles,
    totalDirs: state.totalDirs,
  };
}
