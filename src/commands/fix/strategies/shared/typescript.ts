/**
 * @module commands/fix/strategies/shared/typescript
 * @description TypeScript compiler integration for type checking
 *
 * Provides:
 * - Run `tsc --noEmit` for type checking
 * - Parse diagnostics into structured format
 * - Output as JSON/XML for AI consumption
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { escapeXml } from '@/lib';

// ============================================================================
// TYPES
// ============================================================================

export interface TsDiagnostic {
  file: string;
  line: number;
  column: number;
  code: string;
  severity: 'error' | 'warning' | 'suggestion';
  message: string;
  /** Related information (e.g., "Did you mean X?") */
  relatedInfo?: string;
}

export interface TsCheckResult {
  success: boolean;
  errorCount: number;
  warningCount: number;
  diagnostics: TsDiagnostic[];
  duration: number;
  tscVersion?: string;
  error?: string;
}

// ============================================================================
// TYPESCRIPT DETECTION
// ============================================================================

/**
 * Check if TypeScript is available in the project
 */
export function isTscAvailable(projectRoot: string): boolean {
  try {
    const tscPath = path.join(projectRoot, 'node_modules', '.bin', 'tsc');
    if (fs.existsSync(tscPath)) {
      return true;
    }

    // Check global tsc
    const result = spawnSync('tsc', ['--version'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Get tsc executable path
 */
function getTscPath(projectRoot: string): string {
  const localTsc = path.join(projectRoot, 'node_modules', '.bin', 'tsc');
  if (fs.existsSync(localTsc)) {
    return localTsc;
  }
  return 'tsc';
}

/**
 * Check if tsconfig.json exists
 */
export function hasTsConfig(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, 'tsconfig.json'));
}

/**
 * Get TypeScript version
 */
export function getTscVersion(projectRoot: string): string | null {
  try {
    const tsc = getTscPath(projectRoot);
    const result = spawnSync(tsc, ['--version'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    // Output: "Version X.Y.Z"
    const match = result.stdout?.match(/Version\s+(\S+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

// ============================================================================
// TYPE CHECKING
// ============================================================================

/**
 * Run TypeScript type check
 *
 * @param projectRoot - Root directory of the project
 * @param targetPath - Specific path to check (optional)
 * @returns Check result with diagnostics
 */
export function runTypeCheck(
  projectRoot: string,
  targetPath?: string,
): TsCheckResult {
  const startTime = Date.now();
  const tsc = getTscPath(projectRoot);

  try {
    // Build arguments
    const args = ['--noEmit', '--pretty', 'false'];

    // If specific path provided, we need to handle it differently
    // tsc doesn't support path arguments directly with --noEmit
    // We'll run on the whole project and filter results
    if (targetPath) {
      // Add project flag if tsconfig exists
      if (hasTsConfig(projectRoot)) {
        args.push('--project', path.join(projectRoot, 'tsconfig.json'));
      }
    }

    const spawnResult = spawnSync(tsc, args, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 50 * 1024 * 1024, // 50MB for large projects
    });

    const output = spawnResult.stdout + spawnResult.stderr;
    const diagnostics = parseTscOutput(output, projectRoot);

    // Filter by target path if specified
    const filteredDiagnostics = targetPath
      ? diagnostics.filter((d) => d.file.includes(targetPath))
      : diagnostics;

    const errorCount = filteredDiagnostics.filter((d) => d.severity === 'error').length;
    const warningCount = filteredDiagnostics.filter((d) => d.severity === 'warning').length;
    const tscVersion = getTscVersion(projectRoot);

    const result: TsCheckResult = {
      success: errorCount === 0,
      errorCount,
      warningCount,
      diagnostics: filteredDiagnostics,
      duration: Date.now() - startTime,
    };

    if (tscVersion) {
      result.tscVersion = tscVersion;
    }

    return result;
  } catch (error) {
    return {
      success: false,
      errorCount: 0,
      warningCount: 0,
      diagnostics: [],
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// OUTPUT PARSING
// ============================================================================

/**
 * Parse tsc output into structured diagnostics
 *
 * tsc output format:
 * path/file.ts(line,col): error TS1234: Message
 * path/file.ts:line:col - error TS1234: Message
 */
function parseTscOutput(output: string, projectRoot: string): TsDiagnostic[] {
  const diagnostics: TsDiagnostic[] = [];

  // Pattern 1: file(line,col): severity TScode: message
  const pattern1 = /^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$/gm;

  // Pattern 2: file:line:col - severity TScode: message
  const pattern2 = /^(.+?):(\d+):(\d+)\s*-\s*(error|warning)\s+(TS\d+):\s*(.+)$/gm;

  let match;

  // Try pattern 1
  while ((match = pattern1.exec(output)) !== null) {
    const [, filePath, line, column, severity, code, message] = match;
    if (!filePath || !line || !column || !code || !message) continue;

    diagnostics.push({
      file: normalizeFilePath(filePath, projectRoot),
      line: parseInt(line, 10),
      column: parseInt(column, 10),
      code,
      severity: severity === 'error' ? 'error' : 'warning',
      message: message.trim(),
    });
  }

  // Try pattern 2
  while ((match = pattern2.exec(output)) !== null) {
    const [, filePath, line, column, severity, code, message] = match;
    if (!filePath || !line || !column || !code || !message) continue;

    diagnostics.push({
      file: normalizeFilePath(filePath, projectRoot),
      line: parseInt(line, 10),
      column: parseInt(column, 10),
      code,
      severity: severity === 'error' ? 'error' : 'warning',
      message: message.trim(),
    });
  }

  return diagnostics;
}

/**
 * Normalize file path to be relative to project root
 */
function normalizeFilePath(filePath: string, projectRoot: string): string {
  if (path.isAbsolute(filePath)) {
    return path.relative(projectRoot, filePath);
  }
  return filePath;
}

// ============================================================================
// AI-FRIENDLY OUTPUT FORMATS
// ============================================================================

/**
 * Format diagnostics as JSON for AI consumption
 */
export function formatAsJson(result: TsCheckResult): string {
  return JSON.stringify(
    {
      success: result.success,
      summary: {
        errors: result.errorCount,
        warnings: result.warningCount,
        total: result.diagnostics.length,
        duration_ms: result.duration,
        tsc_version: result.tscVersion,
      },
      diagnostics: result.diagnostics.map((d) => ({
        file: d.file,
        location: `${d.line}:${d.column}`,
        code: d.code,
        severity: d.severity,
        message: d.message,
      })),
    },
    null,
    2,
  );
}

/**
 * Format diagnostics as XML for AI consumption
 */
export function formatAsXml(result: TsCheckResult): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<typescript-check>');
  lines.push(`  <summary success="${result.success}">`);
  lines.push(`    <errors>${result.errorCount}</errors>`);
  lines.push(`    <warnings>${result.warningCount}</warnings>`);
  lines.push(`    <total>${result.diagnostics.length}</total>`);
  lines.push(`    <duration_ms>${result.duration}</duration_ms>`);
  if (result.tscVersion) {
    lines.push(`    <tsc_version>${result.tscVersion}</tsc_version>`);
  }
  lines.push('  </summary>');
  lines.push('  <diagnostics>');

  for (const d of result.diagnostics) {
    lines.push(`    <diagnostic severity="${d.severity}">`);
    lines.push(`      <file>${escapeXml(d.file)}</file>`);
    lines.push(`      <line>${d.line}</line>`);
    lines.push(`      <column>${d.column}</column>`);
    lines.push(`      <code>${d.code}</code>`);
    lines.push(`      <message>${escapeXml(d.message)}</message>`);
    lines.push('    </diagnostic>');
  }

  lines.push('  </diagnostics>');
  lines.push('</typescript-check>');

  return lines.join('\n');
}

/**
 * Format as compact text for console output
 */
export function formatAsText(result: TsCheckResult): string {
  const lines: string[] = [];

  if (result.diagnostics.length === 0) {
    lines.push('✅ No TypeScript errors');
    return lines.join('\n');
  }

  // Group by file
  const byFile = new Map<string, TsDiagnostic[]>();
  for (const d of result.diagnostics) {
    const existing = byFile.get(d.file) || [];
    existing.push(d);
    byFile.set(d.file, existing);
  }

  for (const [file, diags] of byFile) {
    lines.push(`\n📁 ${file}`);
    for (const d of diags) {
      const icon = d.severity === 'error' ? '❌' : '⚠️';
      lines.push(`  ${icon} ${d.line}:${d.column} ${d.code}: ${d.message}`);
    }
  }

  lines.push('');
  lines.push(`Total: ${result.errorCount} errors, ${result.warningCount} warnings`);

  return lines.join('\n');
}

// escapeXml imported from lib/formatters

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if file should be processed by TypeScript
 */
export function shouldTsProcess(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.ts', '.tsx', '.mts', '.cts'].includes(ext);
}

/**
 * Get summary line for quick display
 */
export function getSummaryLine(result: TsCheckResult): string {
  if (result.success) {
    return `✅ TypeScript: No errors (${result.duration}ms)`;
  }
  return `❌ TypeScript: ${result.errorCount} errors, ${result.warningCount} warnings (${result.duration}ms)`;
}
