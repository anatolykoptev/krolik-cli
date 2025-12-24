/**
 * @module commands/fix/context
 * @description Smart context detection for safer fixes
 *
 * Understands project type and file purpose to avoid wrong fixes:
 * - Don't remove console.log in CLI tools (it's output!)
 * - Don't remove console in test files (for debugging)
 * - Don't touch config files
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Project type detection
 */
export type ProjectType = 'cli' | 'web' | 'api' | 'library' | 'unknown';

/**
 * File purpose classification
 */
export type FilePurpose =
  | 'output'      // Outputs to console (CLI formatters)
  | 'test'        // Test file
  | 'config'      // Configuration
  | 'types'       // Type definitions
  | 'util'        // Utility functions
  | 'component'   // React component
  | 'router'      // API router
  | 'command'     // CLI command entry
  | 'unknown';

/**
 * Context for smart fix decisions
 */
export interface FixContext {
  projectType: ProjectType;
  filePurpose: FilePurpose;
  isCliOutput: boolean;
  isTestFile: boolean;
  isConfigFile: boolean;
}

/**
 * Detect project type from package.json or structure
 */
export function detectProjectType(projectRoot: string): ProjectType {
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) return 'unknown';

    const pkgContent = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    // CLI detection
    if (pkg.bin || pkg.name?.includes('cli')) {
      return 'cli';
    }

    // Web detection
    if (pkg.dependencies?.react || pkg.dependencies?.next || pkg.dependencies?.vue) {
      return 'web';
    }

    // API detection
    if (pkg.dependencies?.express || pkg.dependencies?.fastify || pkg.dependencies?.hono) {
      return 'api';
    }

    // Library detection
    if (pkg.main || pkg.module || pkg.exports) {
      return 'library';
    }
  } catch {
    // Ignore
  }

  return 'unknown';
}

// ============================================================================
// FILE PURPOSE DETECTION
// ============================================================================

interface PurposeMatcher {
  purpose: FilePurpose;
  matchBasename?: (name: string) => boolean;
  matchDirname?: (dir: string) => boolean;
  matchContent?: (content: string) => boolean;
  matchPath?: (filePath: string) => boolean;
}

/**
 * Purpose matchers in priority order
 */
const PURPOSE_MATCHERS: PurposeMatcher[] = [
  // Test files
  {
    purpose: 'test',
    matchBasename: (name) => name.includes('.test.') || name.includes('.spec.'),
    matchDirname: (dir) => dir.includes('__tests__') || dir.includes('/test/'),
  },
  // Config files
  {
    purpose: 'config',
    matchBasename: (name) =>
      name.includes('config') ||
      name.includes('.config.') ||
      name === 'tsconfig.json' ||
      name === 'package.json',
  },
  // Type definition files
  {
    purpose: 'types',
    matchBasename: (name) => name.endsWith('.d.ts') || name === 'types.ts',
  },
  // Output/formatter files (CLI)
  {
    purpose: 'output',
    matchBasename: (name) =>
      name === 'output.ts' || name === 'formatter.ts' || name.includes('format'),
    matchDirname: (dir) => dir.includes('/formatters'),
  },
  // CLI entry files (bin folder)
  {
    purpose: 'command',
    matchBasename: (name) => name === 'cli.ts',
    matchDirname: (dir) => dir.includes('/bin'),
  },
  // Command entry files
  {
    purpose: 'command',
    matchBasename: (name) => name === 'index.ts',
    matchDirname: (dir) => dir.includes('/commands/'),
  },
  // Router files
  {
    purpose: 'router',
    matchBasename: (name) => name.includes('router'),
    matchDirname: (dir) => dir.includes('/routers'),
    matchContent: (content) =>
      content.includes('createTRPCRouter') || content.includes('Router()'),
  },
  // React components
  {
    purpose: 'component',
    matchContent: (content) =>
      content.includes('React') ||
      content.includes('jsx') ||
      content.includes('useState'),
    matchPath: (filePath) => filePath.endsWith('.tsx'),
  },
  // Utility files
  {
    purpose: 'util',
    matchBasename: (name) => name.includes('util') || name.includes('helper'),
    matchDirname: (dir) => dir.includes('/lib/') || dir.includes('/utils/'),
  },
];

/**
 * Check if a matcher matches the file
 */
function matchesPurpose(
  matcher: PurposeMatcher,
  basename: string,
  dirname: string,
  content: string,
  filePath: string,
): boolean {
  // For matchers with multiple conditions, check if ANY matches
  const checks = [
    matcher.matchBasename?.(basename),
    matcher.matchDirname?.(dirname),
    matcher.matchContent?.(content),
    matcher.matchPath?.(filePath),
  ].filter((check) => check !== undefined);

  // At least one defined check must be true
  return checks.length > 0 && checks.some(Boolean);
}

/**
 * Detect file purpose from path and content
 */
export function detectFilePurpose(filePath: string, content: string): FilePurpose {
  const basename = path.basename(filePath);
  const dirname = path.dirname(filePath);

  for (const matcher of PURPOSE_MATCHERS) {
    if (matchesPurpose(matcher, basename, dirname, content, filePath)) {
      return matcher.purpose;
    }
  }

  return 'unknown';
}

/**
 * Check if console.log is used for CLI output (not debugging)
 */
export function isCliOutput(content: string, line: number): boolean {
  const lines = content.split('\n');
  const targetLine = lines[line - 1] || '';

  // Check the console statement
  const consoleLine = targetLine.trim();

  // Formatting output patterns
  const outputPatterns = [
    /console\.log\(['"`]═/,           // Box drawing
    /console\.log\(['"`]─/,           // Lines
    /console\.log\(['"`]│/,           // Vertical lines
    /console\.log\(['"`]\s*$/,        // Empty line for spacing
    /console\.log\(['"`]✓/,           // Check marks
    /console\.log\(['"`]✗/,           // X marks
    /console\.log\(['"`]⚠/,           // Warning symbols
    /console\.log\(['"`]❌/,          // Error symbols
    /console\.log\(['"`]✅/,          // Success symbols
    /console\.log\(format/,           // Using formatters
    /console\.log\(chalk/,            // Using chalk
    /console\.log\(.*\.join/,         // Joining arrays for output
  ];

  // Check if matches output patterns
  for (const pattern of outputPatterns) {
    if (pattern.test(consoleLine)) {
      return true;
    }
  }

  // Check if in a format* function
  const functionContext = findFunctionContext(lines, line);
  if (functionContext?.includes('format') || functionContext?.includes('output')) {
    return true;
  }

  // Check if variable is being formatted
  if (consoleLine.includes('JSON.stringify') || consoleLine.includes('format')) {
    return true;
  }

  return false;
}

/**
 * Find the containing function name
 */
function findFunctionContext(lines: string[], lineNum: number): string | null {
  // Search backwards for function declaration
  for (let i = lineNum - 1; i >= 0; i--) {
    const line = lines[i] || '';

    // Function patterns
    const funcMatch = line.match(/(?:function|const|let|var)\s+(\w+)/);
    if (funcMatch) {
      return funcMatch[1] ?? null;
    }

    // Method patterns
    const methodMatch = line.match(/(\w+)\s*\(/);
    if (methodMatch && !line.includes('console')) {
      return methodMatch[1] ?? null;
    }

    // Stop at class/module boundary
    if (line.includes('class ') || line.includes('export default')) {
      break;
    }
  }

  return null;
}

/**
 * Build full context for a file
 */
export function buildFixContext(
  projectRoot: string,
  filePath: string,
  content: string,
): FixContext {
  const projectType = detectProjectType(projectRoot);
  const filePurpose = detectFilePurpose(filePath, content);

  return {
    projectType,
    filePurpose,
    isCliOutput: projectType === 'cli' && (filePurpose === 'output' || filePurpose === 'command'),
    isTestFile: filePurpose === 'test',
    isConfigFile: filePurpose === 'config',
  };
}

/**
 * Should we skip fixing console.log in this context?
 */
export function shouldSkipConsoleFix(
  context: FixContext,
  content: string,
  line: number,
): boolean {
  // Never remove console in test files
  if (context.isTestFile) {
    return true;
  }

  // Never remove console in config files
  if (context.isConfigFile) {
    return true;
  }

  // For CLI tools, check if it's actual output
  if (context.projectType === 'cli') {
    // Skip all console in output files
    if (context.isCliOutput) {
      return true;
    }

    // Check if this specific console is for output
    if (isCliOutput(content, line)) {
      return true;
    }
  }

  return false;
}
