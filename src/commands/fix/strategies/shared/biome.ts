/**
 * @module commands/fix/strategies/shared/biome
 * @description Biome linter/formatter integration
 *
 * Provides:
 * - Auto-fix via `biome check --apply`
 * - Lint diagnostics via `biome lint --reporter=json`
 * - Format via `biome format --write`
 */

import { execSync, spawnSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

// ============================================================================
// TYPES
// ============================================================================

export interface BiomeDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  fixable: boolean;
}

export interface BiomeResult {
  success: boolean;
  diagnostics: BiomeDiagnostic[];
  filesFixed: number;
  error?: string;
}

export interface BiomeCheckResult {
  success: boolean;
  hasIssues: boolean;
  diagnostics: BiomeDiagnostic[];
  error?: string;
}

// ============================================================================
// BIOME DETECTION
// ============================================================================

/**
 * Check if Biome is available in the project
 */
export function isBiomeAvailable(projectRoot: string): boolean {
  try {
    // Check for biome in node_modules
    const biomePath = path.join(projectRoot, 'node_modules', '.bin', 'biome');
    if (fs.existsSync(biomePath)) {
      return true;
    }

    // Check for global biome
    const result = spawnSync('biome', ['--version'], {
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
 * Get Biome executable path
 */
function getBiomePath(projectRoot: string): string {
  const localBiome = path.join(projectRoot, 'node_modules', '.bin', 'biome');
  if (fs.existsSync(localBiome)) {
    return localBiome;
  }
  return 'biome';
}

/**
 * Check if biome.json exists
 */
export function hasBiomeConfig(projectRoot: string): boolean {
  return (
    fs.existsSync(path.join(projectRoot, 'biome.json')) ||
    fs.existsSync(path.join(projectRoot, 'biome.jsonc'))
  );
}

// ============================================================================
// BIOME COMMANDS
// ============================================================================

/**
 * Run Biome check with auto-fix
 *
 * Applies all safe fixes (lint + format + organize imports)
 *
 * @param projectRoot - Root directory of the project
 * @param targetPath - Specific path to check (optional, defaults to ".")
 * @returns Result with number of files fixed
 */
export function biomeAutoFix(
  projectRoot: string,
  targetPath?: string,
): BiomeResult {
  const biome = getBiomePath(projectRoot);
  const target = targetPath || '.';

  try {
    // Run biome check --apply (fixes lint + format + imports)
    const result = spawnSync(
      biome,
      ['check', '--apply', '--no-errors-on-unmatched', target],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024, // 10MB
      },
    );

    // Parse output for fixed files count
    const output = result.stdout + result.stderr;
    const fixedMatch = output.match(/Fixed (\d+) file/);
    const filesFixed = fixedMatch?.[1] ? parseInt(fixedMatch[1], 10) : 0;

    // Get remaining diagnostics
    const diagnostics = parseBiomeOutput(output);

    return {
      success: result.status === 0,
      diagnostics,
      filesFixed,
    };
  } catch (error) {
    return {
      success: false,
      diagnostics: [],
      filesFixed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run Biome lint only (no format)
 *
 * @param projectRoot - Root directory of the project
 * @param targetPath - Specific path to check
 */
export function biomeLint(
  projectRoot: string,
  targetPath?: string,
): BiomeCheckResult {
  const biome = getBiomePath(projectRoot);
  const target = targetPath || '.';

  try {
    const result = spawnSync(
      biome,
      ['lint', '--reporter=json', '--no-errors-on-unmatched', target],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const diagnostics = parseBiomeJsonOutput(result.stdout);

    return {
      success: result.status === 0,
      hasIssues: diagnostics.length > 0,
      diagnostics,
    };
  } catch (error) {
    return {
      success: false,
      hasIssues: false,
      diagnostics: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run Biome lint with auto-fix
 */
export function biomeLintFix(
  projectRoot: string,
  targetPath?: string,
): BiomeResult {
  const biome = getBiomePath(projectRoot);
  const target = targetPath || '.';

  try {
    const result = spawnSync(
      biome,
      ['lint', '--apply', '--no-errors-on-unmatched', target],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const output = result.stdout + result.stderr;
    const fixedMatch = output.match(/Fixed (\d+) file/);
    const filesFixed = fixedMatch?.[1] ? parseInt(fixedMatch[1], 10) : 0;
    const diagnostics = parseBiomeOutput(output);

    return {
      success: result.status === 0,
      diagnostics,
      filesFixed,
    };
  } catch (error) {
    return {
      success: false,
      diagnostics: [],
      filesFixed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run Biome format with auto-fix
 */
export function biomeFormat(
  projectRoot: string,
  targetPath?: string,
): BiomeResult {
  const biome = getBiomePath(projectRoot);
  const target = targetPath || '.';

  try {
    const result = spawnSync(
      biome,
      ['format', '--write', '--no-errors-on-unmatched', target],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const output = result.stdout + result.stderr;
    const formattedMatch = output.match(/Formatted (\d+) file/);
    const filesFixed = formattedMatch?.[1] ? parseInt(formattedMatch[1], 10) : 0;

    return {
      success: result.status === 0,
      diagnostics: [],
      filesFixed,
    };
  } catch (error) {
    return {
      success: false,
      diagnostics: [],
      filesFixed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run Biome organize imports
 */
export function biomeOrganizeImports(
  projectRoot: string,
  targetPath?: string,
): BiomeResult {
  const biome = getBiomePath(projectRoot);
  const target = targetPath || '.';

  try {
    const result = spawnSync(
      biome,
      ['check', '--apply', '--formatter-enabled=false', '--linter-enabled=false', target],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const output = result.stdout + result.stderr;
    const fixedMatch = output.match(/Fixed (\d+) file/);
    const filesFixed = fixedMatch?.[1] ? parseInt(fixedMatch[1], 10) : 0;

    return {
      success: result.status === 0,
      diagnostics: [],
      filesFixed,
    };
  } catch (error) {
    return {
      success: false,
      diagnostics: [],
      filesFixed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// SINGLE FILE OPERATIONS
// ============================================================================

/**
 * Fix a single file with Biome
 */
export function biomeFixFile(
  projectRoot: string,
  filePath: string,
): BiomeResult {
  // Resolve to absolute path if relative
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(projectRoot, filePath);

  if (!fs.existsSync(absolutePath)) {
    return {
      success: false,
      diagnostics: [],
      filesFixed: 0,
      error: `File not found: ${filePath}`,
    };
  }

  return biomeAutoFix(projectRoot, absolutePath);
}

/**
 * Check a single file with Biome
 */
export function biomeCheckFile(
  projectRoot: string,
  filePath: string,
): BiomeCheckResult {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(projectRoot, filePath);

  if (!fs.existsSync(absolutePath)) {
    return {
      success: false,
      hasIssues: false,
      diagnostics: [],
      error: `File not found: ${filePath}`,
    };
  }

  return biomeLint(projectRoot, absolutePath);
}

// ============================================================================
// OUTPUT PARSING
// ============================================================================

/**
 * Parse Biome text output for diagnostics
 */
function parseBiomeOutput(output: string): BiomeDiagnostic[] {
  const diagnostics: BiomeDiagnostic[] = [];

  // Pattern: path:line:col message
  // Example: src/file.ts:10:5 lint/suspicious/noExplicitAny
  const linePattern = /^(.+):(\d+):(\d+)\s+(.+)$/gm;

  let match;
  while ((match = linePattern.exec(output)) !== null) {
    const [, file, line, column, rest] = match;
    if (!file || !rest) continue;

    // Parse severity and code from rest
    const parts = rest.split(/\s+/);
    const code = parts[0] || 'unknown';
    const message = parts.slice(1).join(' ') || code;

    const severity = code.includes('error')
      ? 'error'
      : code.includes('warn')
        ? 'warning'
        : 'info';

    diagnostics.push({
      file,
      line: parseInt(line || '0', 10),
      column: parseInt(column || '0', 10),
      severity: severity as 'error' | 'warning' | 'info',
      code,
      message,
      fixable: false,
    });
  }

  return diagnostics;
}

/**
 * Parse Biome JSON reporter output
 */
function parseBiomeJsonOutput(output: string): BiomeDiagnostic[] {
  const diagnostics: BiomeDiagnostic[] = [];

  try {
    // Biome JSON output is newline-delimited JSON
    const lines = output.split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const data = JSON.parse(line);

        if (data.diagnostics) {
          for (const diag of data.diagnostics) {
            diagnostics.push({
              file: data.file || 'unknown',
              line: diag.location?.line || 0,
              column: diag.location?.column || 0,
              severity: diag.severity || 'warning',
              code: diag.code || 'unknown',
              message: diag.message || '',
              fixable: diag.fixable || false,
            });
          }
        }
      } catch {
        // Skip non-JSON lines
      }
    }
  } catch {
    // Fallback to text parsing
    return parseBiomeOutput(output);
  }

  return diagnostics;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get Biome version
 */
export function getBiomeVersion(projectRoot: string): string | null {
  try {
    const biome = getBiomePath(projectRoot);
    const result = execSync(`${biome} --version`, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Check if file should be processed by Biome
 */
export function shouldBiomeProcess(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const biomeExtensions = [
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.mjs',
    '.cjs',
    '.mts',
    '.cts',
    '.json',
    '.jsonc',
  ];
  return biomeExtensions.includes(ext);
}
