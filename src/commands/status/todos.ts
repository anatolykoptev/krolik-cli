/**
 * @module commands/status/todos
 * @description TODO/FIXME counter utilities
 */

import { tryExec } from '../../lib';

/**
 * TODO count result
 */
export interface TodoCount {
  todo: number;
  fixme: number;
  hack: number;
  total: number;
  files: string[];
}

/**
 * Count TODOs in codebase
 */
export function countTodos(
  cwd: string,
  options?: {
    exclude?: string[];
    extensions?: string[];
    limit?: number;
  },
): TodoCount {
  const { exclude = ['node_modules', 'dist', '.next', '.git'], extensions = ['ts', 'tsx'], limit = 100 } = options ?? {};

  const excludeArgs = exclude.map((e) => `--exclude-dir="${e}"`).join(' ');
  const includeArgs = extensions.map((e) => `--include="*.${e}"`).join(' ');

  // Get TODO lines
  const todoResult = tryExec(
    `grep -r "TODO" ${excludeArgs} ${includeArgs} 2>/dev/null | head -${limit}`,
    { cwd },
  );
  const todoLines = todoResult.success ? todoResult.output.split('\n').filter(Boolean) : [];

  // Get FIXME lines
  const fixmeResult = tryExec(
    `grep -r "FIXME" ${excludeArgs} ${includeArgs} 2>/dev/null | head -${limit}`,
    { cwd },
  );
  const fixmeLines = fixmeResult.success ? fixmeResult.output.split('\n').filter(Boolean) : [];

  // Get HACK lines
  const hackResult = tryExec(
    `grep -r "HACK\\|XXX" ${excludeArgs} ${includeArgs} 2>/dev/null | head -${limit}`,
    { cwd },
  );
  const hackLines = hackResult.success ? hackResult.output.split('\n').filter(Boolean) : [];

  // Extract unique files
  const allLines = [...todoLines, ...fixmeLines, ...hackLines];
  const files = [...new Set(allLines.map((l) => l.split(':')[0]).filter((f): f is string => !!f))];

  return {
    todo: todoLines.length,
    fixme: fixmeLines.length,
    hack: hackLines.length,
    total: allLines.length,
    files: files.slice(0, 10),
  };
}

/**
 * Simple count (just total)
 */
export function countTodosSimple(cwd: string, exclude?: string[]): number {
  const result = countTodos(cwd, { ...(exclude ? { exclude } : {}) });
  return result.total;
}
