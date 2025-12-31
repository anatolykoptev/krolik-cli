/**
 * @module commands/status/todos
 * @description TODO/FIXME counter utilities
 */

import { tryExec } from '../../lib/@core/shell';

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
    exclude = ['node_modules', 'dist', '.next', '.git', 'generated', '__generated__'],
    extensions = ['ts', 'tsx'],
    limit = 100,
  } = options ?? {};

  const excludeArgs = exclude.map((e) => `--exclude-dir="${e}"`).join(' ');
  const includeArgs = extensions.map((e) => `--include="*.${e}"`).join(' ');

  // Get TODO lines (only actual comments, not strings containing "TODO")
  const todoResult = tryExec(
    `grep -r "// TODO\\|/\\* TODO\\|\\* TODO" ${excludeArgs} ${includeArgs} 2>/dev/null | head -${limit}`,
    { cwd },
  );
  const todoLines = todoResult.success ? todoResult.output.split('\n').filter(Boolean) : [];

  // Get FIXME lines
  const fixmeResult = tryExec(
    `grep -r "// FIXME\\|/\\* FIXME\\|\\* FIXME" ${excludeArgs} ${includeArgs} 2>/dev/null | head -${limit}`,
    { cwd },
  );
  const fixmeLines = fixmeResult.success ? fixmeResult.output.split('\n').filter(Boolean) : [];

  // Get HACK/XXX lines
  const hackResult = tryExec(
    `grep -r "// HACK\\|/\\* HACK\\|// XXX\\|/\\* XXX" ${excludeArgs} ${includeArgs} 2>/dev/null | head -${limit}`,
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
  /** Surrounding context (function/test name) */
  context?: string;
  /** Is this a generic/uninformative TODO? */
  isGeneric?: boolean;
}

/**
 * Generic TODO texts that provide little useful information
 */
const GENERIC_PATTERNS = [
  /^implement$/i,
  /^implement\s+test$/i,
  /^implement\s+later$/i,
  /^implement\s+this$/i,
  /^fix$/i,
  /^fix\s+later$/i,
  /^fix\s+this$/i,
  /^todo$/i,
  /^fixme$/i,
  /^later$/i,
  /^wip$/i,
  /^tbd$/i,
  /^coming\s+soon$/i,
  /^add\s+tests?$/i,
  /^needs?\s+implementation$/i,
];

/**
 * Check if TODO text is generic/uninformative
 */
function isGenericTodo(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return GENERIC_PATTERNS.some((pattern) => pattern.test(normalized));
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
    /** Include context from surrounding lines */
    withContext?: boolean;
    /** Filter out generic TODOs */
    filterGeneric?: boolean;
  },
): TodoItem[] {
  const {
    exclude = ['node_modules', 'dist', '.next', '.git', 'generated', '__generated__'],
    extensions = ['ts', 'tsx', 'js', 'jsx'],
    limit = 50,
    withContext = true,
    filterGeneric = false,
  } = options ?? {};

  // Filter out scanner files that contain grep patterns with TODO/FIXME/etc
  // BSD grep on macOS doesn't support --exclude well, so we use grep -v
  const filterScannerFiles = '| grep -v "todos\\.ts" | grep -v "lint\\.ts"';

  const excludeArgs = exclude.map((e) => `--exclude-dir="${e}"`).join(' ');
  const includeArgs = extensions.map((e) => `--include="*.${e}"`).join(' ');
  // Use -B3 to get 3 lines of context before the TODO
  const contextFlag = withContext ? '-B3' : '';

  const todos: TodoItem[] = [];

  // Extract TODO comments with context
  // Use stricter pattern: TODO followed by : or space (not inside words like "AUTODO")
  const todoResult = tryExec(
    `grep -rn ${contextFlag} "// TODO\\|/\\* TODO\\|\\* TODO" ${excludeArgs} ${includeArgs} 2>/dev/null ${filterScannerFiles} | head -${limit * 4}`,
    { cwd },
  );
  if (todoResult.success) {
    todos.push(...parseTodoLinesWithContext(todoResult.output, 'TODO', withContext));
  }

  // Extract FIXME comments with context
  const fixmeResult = tryExec(
    `grep -rn ${contextFlag} "// FIXME\\|/\\* FIXME\\|\\* FIXME" ${excludeArgs} ${includeArgs} 2>/dev/null ${filterScannerFiles} | head -${limit * 4}`,
    { cwd },
  );
  if (fixmeResult.success) {
    todos.push(...parseTodoLinesWithContext(fixmeResult.output, 'FIXME', withContext));
  }

  // Extract HACK/XXX comments with context
  const hackResult = tryExec(
    `grep -rn ${contextFlag} "// HACK\\|/\\* HACK\\|\\* HACK\\|// XXX\\|/\\* XXX\\|\\* XXX" ${excludeArgs} ${includeArgs} 2>/dev/null ${filterScannerFiles} | head -${limit * 4}`,
    { cwd },
  );
  if (hackResult.success) {
    todos.push(...parseTodoLinesWithContext(hackResult.output, 'HACK', withContext));
  }

  // Mark generic TODOs and optionally filter them
  const processed = todos.map((todo) => ({
    ...todo,
    isGeneric: isGenericTodo(todo.text),
  }));

  const result = filterGeneric ? processed.filter((t) => !t.isGeneric) : processed;

  return result.slice(0, limit);
}

/**
 * Detect the first marker (TODO, FIXME, HACK, XXX) in a line
 * Returns the first marker found, or the fallback type
 */
function detectFirstMarker(
  content: string,
  fallback: 'TODO' | 'FIXME' | 'HACK',
): 'TODO' | 'FIXME' | 'HACK' | 'XXX' {
  const markers: Array<{ type: 'TODO' | 'FIXME' | 'HACK' | 'XXX'; index: number }> = [];

  // Find positions of all markers
  const todoIdx = content.indexOf('TODO');
  if (todoIdx !== -1) markers.push({ type: 'TODO', index: todoIdx });

  const fixmeIdx = content.indexOf('FIXME');
  if (fixmeIdx !== -1) markers.push({ type: 'FIXME', index: fixmeIdx });

  const hackIdx = content.indexOf('HACK');
  if (hackIdx !== -1) markers.push({ type: 'HACK', index: hackIdx });

  const xxxIdx = content.indexOf('XXX');
  if (xxxIdx !== -1) markers.push({ type: 'XXX', index: xxxIdx });

  // Return the first marker found (by position)
  if (markers.length === 0) return fallback;
  markers.sort((a, b) => a.index - b.index);
  return markers[0]?.type ?? fallback;
}

/**
 * Parse grep output with context into TodoItem array
 */
function parseTodoLinesWithContext(
  output: string,
  type: 'TODO' | 'FIXME' | 'HACK',
  withContext: boolean,
): TodoItem[] {
  const lines = output.split('\n');
  const todos: TodoItem[] = [];
  const contextBuffer: string[] = [];

  for (const line of lines) {
    // Check for separator (grep uses -- between matches with context)
    if (line === '--') {
      contextBuffer.length = 0;
      continue;
    }

    // Format with context: file-line-content (- for context lines)
    // Format for match: file:line:content (: for match lines)
    const matchLine = line.match(/^([^:]+):(\d+):(.*)/);
    const contextLine = line.match(/^([^-]+)-(\d+)-(.*)/);

    if (contextLine && withContext) {
      // This is a context line, add to buffer
      contextBuffer.push(contextLine[3] || '');
    } else if (matchLine?.[1] && matchLine[2] && matchLine[3]) {
      // This is the actual TODO line
      const file = matchLine[1];
      const lineNum = matchLine[2];
      const content = matchLine[3];
      // Find the first marker in the line (TODO, FIXME, HACK, XXX)
      const actualType = detectFirstMarker(content, type);
      const text = extractCommentText(content, actualType);

      if (text) {
        // Extract context (function/test name) from context buffer
        const context = withContext ? extractFunctionContext(contextBuffer) : undefined;

        const todoItem: TodoItem = {
          file: file.trim(),
          line: Number.parseInt(lineNum, 10),
          type: actualType,
          text,
        };
        if (context) {
          todoItem.context = context;
        }
        todos.push(todoItem);
      }

      contextBuffer.length = 0;
    }
  }

  return todos;
}

/**
 * Extract function/test name from context lines
 */
function extractFunctionContext(contextLines: string[]): string | undefined {
  // Look for function/test/it/describe declarations in reverse order
  for (let i = contextLines.length - 1; i >= 0; i--) {
    const line = contextLines[i] ?? '';

    // Match: it('test name', ...)
    const itMatch = line.match(/it\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (itMatch?.[1]) return `test: ${itMatch[1]}`;

    // Match: test('test name', ...)
    const testMatch = line.match(/test\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (testMatch?.[1]) return `test: ${testMatch[1]}`;

    // Match: describe('suite name', ...)
    const describeMatch = line.match(/describe\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (describeMatch?.[1]) return `suite: ${describeMatch[1]}`;

    // Match: function name(...) or async function name(...)
    const funcMatch = line.match(/(?:async\s+)?function\s+(\w+)\s*\(/);
    if (funcMatch?.[1]) return `fn: ${funcMatch[1]}`;

    // Match: const name = (...) => or const name = async (...) =>
    const arrowMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
    if (arrowMatch?.[1]) return `fn: ${arrowMatch[1]}`;

    // Match: name(...) { (method definition)
    const methodMatch = line.match(/^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/);
    if (methodMatch?.[1] && !['if', 'for', 'while', 'switch', 'catch'].includes(methodMatch[1])) {
      return `method: ${methodMatch[1]}`;
    }
  }

  return undefined;
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
