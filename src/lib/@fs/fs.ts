/**
 * @module lib/fs
 * @description File system utilities
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Default directories to skip when walking
 */
const DEFAULT_SKIP_DIRS = ['node_modules', '.next', 'dist', '.git', '.turbo', 'coverage', '.cache'];

/**
 * Options for file finding
 */
export interface FindFilesOptions {
  /** File extensions to include (e.g., ['.ts', '.tsx']) */
  extensions?: string[];
  /** Directories to skip */
  skipDirs?: string[];
  /** Maximum depth to traverse */
  maxDepth?: number;
}

/**
 * Check if a path exists
 */
export function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Check if path is a directory
 */
export function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if path is a file
 */
export function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Read file contents as string
 */
export function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Write content to file
 */
export function writeFile(filePath: string, content: string): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!exists(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse JSON file
 */
export function readJson<T = unknown>(filePath: string): T | null {
  const content = readFile(filePath);
  if (!content) return null;

  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Write JSON to file
 */
export function writeJson(filePath: string, data: unknown, indent = 2): boolean {
  try {
    return writeFile(filePath, JSON.stringify(data, null, indent));
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists
 */
export function ensureDir(dirPath: string): boolean {
  try {
    if (!exists(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get relative path from base
 */
export function relativePath(filePath: string, basePath: string): string {
  return path.relative(basePath, filePath);
}

/**
 * Find files recursively matching criteria
 */
export function findFiles(dir: string, options: FindFilesOptions = {}): string[] {
  const { extensions = [], skipDirs = DEFAULT_SKIP_DIRS, maxDepth = Infinity } = options;

  const files: string[] = [];

  function walk(currentDir: string, depth: number): void {
    if (depth > maxDepth || !exists(currentDir)) {
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!skipDirs.includes(entry.name)) {
          walk(fullPath, depth + 1);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.length === 0 || extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir, 0);
  return files;
}

/**
 * Get all subdirectories in a directory
 */
export function getSubdirectories(dir: string): string[] {
  if (!exists(dir) || !isDirectory(dir)) {
    return [];
  }

  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * Save file to .krolik directory
 * Creates .krolik directory if it doesn't exist
 *
 * @param projectRoot - Project root directory
 * @param filename - Filename to save (e.g., 'CONTEXT.xml', 'REFACTOR.xml')
 * @param content - File content to save
 * @returns true if saved successfully, false otherwise
 */
export function saveKrolikFile(projectRoot: string, filename: string, content: string): boolean {
  const krolikDir = path.join(projectRoot, '.krolik');
  const filePath = path.join(krolikDir, filename);
  return writeFile(filePath, content);
}

/**
 * List files in a directory (non-recursive)
 */
export function listFiles(dir: string, extensions?: string[]): string[] {
  if (!exists(dir) || !isDirectory(dir)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries
      .filter((entry) => {
        if (!entry.isFile()) return false;
        if (!extensions) return true;
        const ext = path.extname(entry.name);
        return extensions.includes(ext);
      })
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}
