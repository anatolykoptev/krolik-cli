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
  const {
    exclude = ['node_modules', 'dist', '.next', '.git'],
    extensions = ['ts', 'tsx'],
    limit = 100,
  } = options ?? {};

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

/**
 * Detailed TODO item
 */
export interface TodoItem {
  file: string;
  line: number;
  type: 'TODO' | 'FIXME' | 'HACK' | 'XXX';
  text: string;
}

/**
 * Extract detailed TODO comments from codebase
 */
export function extractTodos(
  cwd: string,
  options?: {
    exclude?: string[];
    extensions?: string[];
    limit?: number;
  },
): TodoItem[] {
  const {
    exclude = ['node_modules', 'dist', '.next', '.git'],
    extensions = ['ts', 'tsx', 'js', 'jsx'],
    limit = 50,
  } = options ?? {};

  const excludeArgs = exclude.map((e) => `--exclude-dir="${e}"`).join(' ');
  const includeArgs = extensions.map((e) => `--include="*.${e}"`).join(' ');

  const todos: TodoItem[] = [];

  // Extract TODO comments
  const todoResult = tryExec(
    `grep -rn "TODO" ${excludeArgs} ${includeArgs} 2>/dev/null | head -${limit}`,
    { cwd },
  );
  if (todoResult.success) {
    todos.push(...parseTodoLines(todoResult.output, 'TODO'));
  }

  // Extract FIXME comments
  const fixmeResult = tryExec(
    `grep -rn "FIXME" ${excludeArgs} ${includeArgs} 2>/dev/null | head -${limit}`,
    { cwd },
  );
  if (fixmeResult.success) {
    todos.push(...parseTodoLines(fixmeResult.output, 'FIXME'));
  }

  // Extract HACK/XXX comments
  const hackResult = tryExec(
    `grep -rn "HACK\\|XXX" ${excludeArgs} ${includeArgs} 2>/dev/null | head -${limit}`,
    { cwd },
  );
  if (hackResult.success) {
    const hackLines = hackResult.output.split('\n').filter(Boolean);
    for (const line of hackLines) {
      const match = line.match(/^([^:]+):(\d+):(.*)/);
      if (!match || !match[1] || !match[2] || !match[3]) continue;

      const file = match[1];
      const lineNum = match[2];
      const content = match[3];
      const type = content.includes('HACK') ? 'HACK' : 'XXX';
      const text = extractCommentText(content, type);

      if (text) {
        todos.push({
          file: file.trim(),
          line: Number.parseInt(lineNum, 10),
          type,
          text,
        });
      }
    }
  }

  return todos.slice(0, limit);
}

/**
 * Parse grep output lines into TodoItem array
 */
function parseTodoLines(output: string, type: 'TODO' | 'FIXME'): TodoItem[] {
  const lines = output.split('\n').filter(Boolean);
  const todos: TodoItem[] = [];

  for (const line of lines) {
    // Format: file:line:content
    const match = line.match(/^([^:]+):(\d+):(.*)/);
    if (!match || !match[1] || !match[2] || !match[3]) continue;

    const file = match[1];
    const lineNum = match[2];
    const content = match[3];
    const text = extractCommentText(content, type);

    if (text) {
      todos.push({
        file: file.trim(),
        line: Number.parseInt(lineNum, 10),
        type,
        text,
      });
    }
  }

  return todos;
}

/**
 * Extract comment text after TODO/FIXME/HACK/XXX marker
 */
function extractCommentText(line: string, marker: string): string {
  // Remove leading whitespace
  const trimmed = line.trim();

  // Find the marker
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex === -1) return '';

  // Extract text after marker
  let text = trimmed.slice(markerIndex + marker.length);

  // Remove common prefixes
  text = text.replace(/^[:\s-]+/, '').trim();

  // Remove comment markers
  text = text.replace(/^\/\/\s*/, '');
  text = text.replace(/^\/\*\s*/, '');
  text = text.replace(/\s*\*\/\s*$/, '');

  return text;
}
