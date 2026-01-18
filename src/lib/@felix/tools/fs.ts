/**
 * @module lib/@ralph/tools/fs
 * @description File system tools for Ralph Agent
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '@/lib/@core/logger/logger';

/**
 * Validate path is within project root
 */
function validatePath(projectRoot: string, targetPath: string): string {
  const resolved = path.resolve(projectRoot, targetPath);
  if (!resolved.startsWith(projectRoot)) {
    throw new Error(`Access denied: Path ${targetPath} is outside project root`);
  }
  return resolved;
}

/**
 * Read file content
 */
export function readFile(projectRoot: string, filePath: string): string {
  const fullPath = validatePath(projectRoot, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Write file content (creates directories if needed)
 */
export function writeFile(projectRoot: string, filePath: string, content: string): void {
  const fullPath = validatePath(projectRoot, filePath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, content, 'utf-8');
  logger.info(`[ralph:fs] Wrote file: ${filePath}`);
}

/**
 * Replace string in file
 */
export function replaceInFile(
  projectRoot: string,
  filePath: string,
  search: string,
  replace: string,
): void {
  const content = readFile(projectRoot, filePath);
  if (!content.includes(search)) {
    throw new Error(`Search string not found in ${filePath}`);
  }
  const newContent = content.replace(search, replace);
  writeFile(projectRoot, filePath, newContent);
  logger.info(`[ralph:fs] Replaced content in: ${filePath}`);
}

/**
 * List directory contents
 */
export function listDir(projectRoot: string, dirPath: string, depth = 1): string[] {
  const fullPath = validatePath(projectRoot, dirPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }

  if (!fs.statSync(fullPath).isDirectory()) {
    throw new Error(`Path is not a directory: ${dirPath}`);
  }

  // Reuse discovery logic or simple recursive scan?
  // Let's implement a simple controlled scan
  const results: string[] = [];

  function scan(currentDir: string, currentDepth: number) {
    if (currentDepth > depth) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const entryPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(projectRoot, entryPath);

      if (entry.isDirectory()) {
        results.push(`${relativePath}/`);
        scan(entryPath, currentDepth + 1);
      } else {
        results.push(relativePath);
      }
    }
  }

  scan(fullPath, 1);
  return results;
}
