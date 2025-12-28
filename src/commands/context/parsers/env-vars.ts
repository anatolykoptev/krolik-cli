/**
 * @module commands/context/parsers/env-vars
 * @description Environment variables analyzer using SWC AST
 *
 * Detects all environment variable usages in codebase:
 * - process.env.VAR_NAME
 * - env.VAR_NAME (t3-env or similar)
 * - Parses .env.example and .env.local files
 * - Detects required vs optional vars (via ?? or || operators)
 * - Groups by package/app
 * - Highlights missing vars (used but not defined)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getNodeSpan,
  type Identifier,
  type MemberExpression,
  parseFile,
  visitNodeWithCallbacks,
} from '@/lib/@swc';
import { scanDirectory as scanDir } from '@/lib/core/fs';

/**
 * Single usage of an environment variable in code
 */
export interface EnvVarUsage {
  /** Variable name (e.g., 'DATABASE_URL') */
  name: string;
  /** File path where it's used */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
  /** Whether it has a default value (via ?? or ||) */
  hasDefault: boolean;
  /** The default value if detected (literal only) */
  defaultValue?: string;
  /** Access pattern: 'process.env' or 'env' */
  pattern: 'process.env' | 'env';
}

/**
 * Environment variable definition from .env files
 */
export interface EnvVarDefinition {
  /** Variable name */
  name: string;
  /** File where it's defined (.env.example, .env.local, etc.) */
  file: string;
  /** Value (only from .example files for security) */
  value?: string;
  /** Comment above the variable */
  comment?: string;
  /** Whether value is empty string */
  isEmpty?: boolean;
}

/**
 * Complete environment variables analysis report
 */
export interface EnvVarsReport {
  /** All usages found in code */
  usages: EnvVarUsage[];
  /** Definitions from .env files */
  definitions: EnvVarDefinition[];
  /** Variables used but not defined anywhere */
  missing: string[];
  /** Variables defined but never used */
  unused: string[];
  /** Grouped by package/app */
  byPackage: Record<string, EnvVarUsage[]>;
}

/**
 * Parse environment variables from project directory
 *
 * @param projectDir - Root directory to scan
 * @param patterns - Optional glob patterns to filter files
 * @returns Complete environment variables report
 */
export function parseEnvVars(projectDir: string, patterns?: string[]): EnvVarsReport {
  const usages: EnvVarUsage[] = [];
  const definitions: EnvVarDefinition[] = [];

  // Find all .env files
  const envFiles = findEnvFiles(projectDir);
  for (const envFile of envFiles) {
    definitions.push(...parseEnvFile(envFile));
  }

  // Scan TypeScript/JavaScript files
  scanDirectory(projectDir, usages, patterns);

  // Analyze relationships
  const definedNames = new Set(definitions.map((d) => d.name));
  const usedNames = new Set(usages.map((u) => u.name));

  const missing = Array.from(usedNames).filter((name) => !definedNames.has(name));
  const unused = Array.from(definedNames).filter((name) => !usedNames.has(name));

  // Group by package
  const byPackage = groupByPackage(usages, projectDir);

  return {
    usages,
    definitions,
    missing,
    unused,
    byPackage,
  };
}

/**
 * Find all .env files in project
 */
function findEnvFiles(dir: string): string[] {
  const envFiles: string[] = [];
  const patterns = ['.env', '.env.example', '.env.local', '.env.development', '.env.production'];

  function scan(currentDir: string): void {
    if (!fs.existsSync(currentDir)) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      // Skip node_modules and hidden folders (except .env files)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        scan(fullPath);
        continue;
      }

      if (entry.isFile() && patterns.includes(entry.name)) {
        envFiles.push(fullPath);
      }
    }
  }

  scan(dir);
  return envFiles;
}

/**
 * Parse a single .env file
 */
function parseEnvFile(filePath: string): EnvVarDefinition[] {
  const definitions: EnvVarDefinition[] = [];
  const fileName = path.basename(filePath);
  const isExample = fileName.includes('example');

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return definitions;
  }

  const lines = content.split('\n');
  let currentComment = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';

    // Collect comments
    if (line.startsWith('#')) {
      const commentText = line.slice(1).trim();
      if (commentText) {
        currentComment = currentComment ? `${currentComment}\n${commentText}` : commentText;
      }
      continue;
    }

    // Skip empty lines
    if (!line) {
      currentComment = '';
      continue;
    }

    // Parse KEY=VALUE
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*?)$/);
    if (!match) {
      currentComment = '';
      continue;
    }

    const [, name, rawValue] = match;
    if (!name) {
      currentComment = '';
      continue;
    }

    // Clean value (remove quotes)
    let value = rawValue?.trim() ?? '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    definitions.push({
      name,
      file: fileName,
      // Only include value from .example files (security)
      ...(isExample && { value }),
      isEmpty: value === '',
      ...(currentComment && { comment: currentComment }),
    });

    currentComment = '';
  }

  return definitions;
}

/**
 * Scan directory for TypeScript/JavaScript files and extract env var usages
 */
function scanDirectory(dir: string, usages: EnvVarUsage[], patterns?: string[]): void {
  if (!fs.existsSync(dir)) return;

  scanDir(
    dir,
    (fullPath) => {
      const fileUsages = parseEnvVarsInFile(fullPath);
      usages.push(...fileUsages);
    },
    {
      patterns: patterns ?? [],
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      includeTests: false,
    },
  );
}

/**
 * Parse environment variable usages from a single file using SWC AST
 */
function parseEnvVarsInFile(filePath: string): EnvVarUsage[] {
  const usages: EnvVarUsage[] = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return usages;
  }

  try {
    const { ast, lineOffsets } = parseFile(filePath, content);

    visitNodeWithCallbacks(ast, {
      onMemberExpression: (node) => {
        const member = node as unknown as MemberExpression;
        const usage = extractEnvUsage(member, content, lineOffsets, filePath);
        if (usage) {
          usages.push(usage);
        }
      },
    });
  } catch {
    // If parsing fails, silently skip file
    return [];
  }

  return usages;
}

/**
 * Extract env var usage from MemberExpression node
 */
function extractEnvUsage(
  node: MemberExpression,
  content: string,
  lineOffsets: number[],
  filePath: string,
): EnvVarUsage | null {
  // Check for process.env.VAR_NAME or env.VAR_NAME
  if (node.property.type !== 'Identifier') return null;

  const propName = (node.property as Identifier).value;
  if (!propName) return null;

  // Get the object part
  let objName: string | null = null;
  let pattern: 'process.env' | 'env' | null = null;

  if (node.object.type === 'Identifier') {
    // env.VAR_NAME
    const identifier = node.object as Identifier;
    if (identifier.value === 'env') {
      objName = 'env';
      pattern = 'env';
    }
  } else if (node.object.type === 'MemberExpression') {
    // process.env.VAR_NAME
    const objMember = node.object as MemberExpression;
    if (
      objMember.object.type === 'Identifier' &&
      (objMember.object as Identifier).value === 'process' &&
      objMember.property.type === 'Identifier' &&
      (objMember.property as Identifier).value === 'env'
    ) {
      objName = 'process.env';
      pattern = 'process.env';
    }
  }

  if (!objName || !pattern) return null;

  // Get position
  const span = getNodeSpan(node);
  if (!span) return null;

  const { line, column } = offsetToPosition(span.start, lineOffsets);

  // Detect default value (look for ?? or || in parent context)
  const { hasDefault, defaultValue } = detectDefaultValue(node, content);

  return {
    name: propName,
    file: path.relative(process.cwd(), filePath),
    line,
    column,
    hasDefault,
    ...(defaultValue !== undefined && { defaultValue }),
    pattern,
  };
}

/**
 * Detect if env var has a default value via ?? or ||
 */
function detectDefaultValue(
  node: MemberExpression,
  content: string,
): { hasDefault: boolean; defaultValue?: string } {
  // Simple heuristic: look for ?? or || after the node in source
  const span = getNodeSpan(node);
  if (!span) return { hasDefault: false };

  // Extract ~100 chars after the node
  const afterNode = content.slice(span.end, span.end + 100);

  // Check for ?? or ||
  const coalescingMatch = afterNode.match(/^\s*\?\?\s*(['"`])(.*?)\1/);
  const orMatch = afterNode.match(/^\s*\|\|\s*(['"`])(.*?)\1/);

  if (coalescingMatch?.[2]) {
    return { hasDefault: true, defaultValue: coalescingMatch[2] };
  }

  if (orMatch?.[2]) {
    return { hasDefault: true, defaultValue: orMatch[2] };
  }

  // Check for simple ?? or || without extracting value
  if (afterNode.match(/^\s*(\?\?|\|\|)/)) {
    return { hasDefault: true };
  }

  return { hasDefault: false };
}

/**
 * Convert byte offset to line/column position
 */
function offsetToPosition(offset: number, lineOffsets: number[]): { line: number; column: number } {
  let line = 1;
  for (let i = 0; i < lineOffsets.length; i++) {
    const lineOffset = lineOffsets[i];
    if (lineOffset === undefined) break;
    if (offset < lineOffset) break;
    line = i + 1;
  }

  const lineStart = lineOffsets[line - 1] ?? 0;
  const column = offset - lineStart + 1;

  return { line, column };
}

/**
 * Group usages by package/app
 */
function groupByPackage(usages: EnvVarUsage[], projectDir: string): Record<string, EnvVarUsage[]> {
  const groups: Record<string, EnvVarUsage[]> = {};

  for (const usage of usages) {
    const fullPath = path.join(projectDir, usage.file);
    const packageName = detectPackageName(fullPath, projectDir);

    if (!groups[packageName]) {
      groups[packageName] = [];
    }
    groups[packageName]?.push(usage);
  }

  return groups;
}

/**
 * Detect package/app name from file path
 */
function detectPackageName(filePath: string, projectDir: string): string {
  const relative = path.relative(projectDir, filePath);
  const parts = relative.split(path.sep);

  // apps/web/... → web
  // packages/api/... → api
  if (parts[0] === 'apps' || parts[0] === 'packages') {
    return parts[1] || 'root';
  }

  return 'root';
}

/**
 * Format environment variables report as AI-friendly XML
 */
export function formatEnvVarsXml(report: EnvVarsReport): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<env-vars-report>');

  // Summary
  lines.push('  <summary>');
  lines.push(`    <total-usages>${report.usages.length}</total-usages>`);
  lines.push(`    <total-definitions>${report.definitions.length}</total-definitions>`);
  lines.push(`    <missing-count>${report.missing.length}</missing-count>`);
  lines.push(`    <unused-count>${report.unused.length}</unused-count>`);
  lines.push('  </summary>');

  // Missing variables (CRITICAL)
  if (report.missing.length > 0) {
    lines.push('');
    lines.push('  <missing-variables>');
    for (const name of report.missing.sort()) {
      const usageCount = report.usages.filter((u) => u.name === name).length;
      lines.push(`    <variable name="${escapeXml(name)}" usage-count="${usageCount}" />`);
    }
    lines.push('  </missing-variables>');
  }

  // Unused variables
  if (report.unused.length > 0) {
    lines.push('');
    lines.push('  <unused-variables>');
    for (const name of report.unused.sort()) {
      const def = report.definitions.find((d) => d.name === name);
      lines.push(`    <variable name="${escapeXml(name)}" file="${escapeXml(def?.file ?? '')}" />`);
    }
    lines.push('  </unused-variables>');
  }

  // Usages by package
  lines.push('');
  lines.push('  <usages-by-package>');
  const sortedPackages = Object.keys(report.byPackage).sort();
  for (const pkg of sortedPackages) {
    const pkgUsages = report.byPackage[pkg] ?? [];
    lines.push(`    <package name="${escapeXml(pkg)}" count="${pkgUsages.length}">`);

    // Group by variable name
    const byName: Record<string, EnvVarUsage[]> = {};
    for (const usage of pkgUsages) {
      if (!byName[usage.name]) byName[usage.name] = [];
      byName[usage.name]?.push(usage);
    }

    const sortedNames = Object.keys(byName).sort();
    for (const name of sortedNames) {
      const varUsages = byName[name] ?? [];
      const isDefined = !report.missing.includes(name);
      const hasDefaults = varUsages.some((u) => u.hasDefault);

      lines.push(
        `      <variable name="${escapeXml(name)}" count="${varUsages.length}" defined="${isDefined}" has-defaults="${hasDefaults}">`,
      );

      for (const usage of varUsages.slice(0, 5)) {
        // Limit to 5 per var
        lines.push(
          `        <usage file="${escapeXml(usage.file)}" line="${usage.line}" pattern="${usage.pattern}"${usage.hasDefault ? ` default="${escapeXml(usage.defaultValue ?? 'true')}"` : ''} />`,
        );
      }

      if (varUsages.length > 5) {
        lines.push(`        <more count="${varUsages.length - 5}" />`);
      }

      lines.push('      </variable>');
    }

    lines.push('    </package>');
  }
  lines.push('  </usages-by-package>');

  // Definitions
  lines.push('');
  lines.push('  <definitions>');
  const defsByName: Record<string, EnvVarDefinition[]> = {};
  for (const def of report.definitions) {
    if (!defsByName[def.name]) defsByName[def.name] = [];
    defsByName[def.name]?.push(def);
  }

  const sortedDefNames = Object.keys(defsByName).sort();
  for (const name of sortedDefNames) {
    const defs = defsByName[name] ?? [];
    const isUsed = !report.unused.includes(name);

    lines.push(`    <variable name="${escapeXml(name)}" used="${isUsed}">`);

    for (const def of defs) {
      const attrs = [`file="${escapeXml(def.file)}"`];
      if (def.value !== undefined) attrs.push(`value="${escapeXml(def.value)}"`);
      if (def.isEmpty) attrs.push('empty="true"');

      lines.push(`      <definition ${attrs.join(' ')}>`);
      if (def.comment) {
        lines.push(`        <comment>${escapeXml(def.comment)}</comment>`);
      }
      lines.push('      </definition>');
    }

    lines.push('    </variable>');
  }
  lines.push('  </definitions>');

  lines.push('</env-vars-report>');

  return lines.join('\n');
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
