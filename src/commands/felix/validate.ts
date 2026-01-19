/**
 * @module commands/felix/validate
 * @description Lightweight PRD validation module (no heavy dependencies)
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { escapeXml } from '../../lib/@core/xml';
import { getTaskExecutionOrder, type PRD, validatePRD } from '../../lib/@felix/schemas/prd.schema';

/**
 * Find PRD file path
 */
function findPrdPath(projectRoot: string, customPath?: string): string | undefined {
  if (customPath) {
    const fullPath = customPath.startsWith('/') ? customPath : join(projectRoot, customPath);
    return existsSync(fullPath) ? fullPath : undefined;
  }

  // Search for PRD.json in common locations
  const candidates = [
    'PRD.json',
    'prd.json',
    '.krolik/felix/prd/PRD.json',
    '.krolik/prd/PRD.json',
    'docs/PRD.json',
  ];

  for (const candidate of candidates) {
    const fullPath = join(projectRoot, candidate);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return undefined;
}

/**
 * Load and validate PRD file
 */
function loadAndValidatePRD(
  prdPath: string,
): { prd: PRD; errors: string[] } | { prd: null; errors: string[] } {
  try {
    const content = readFileSync(prdPath, 'utf-8');
    const data = JSON.parse(content) as unknown;
    const result = validatePRD(data);

    if (result.success) {
      return { prd: result.data, errors: [] };
    }

    return {
      prd: null,
      errors: result.errors,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { prd: null, errors: [`Failed to load PRD: ${message}`] };
  }
}

/**
 * Validate PRD file
 */
export function validatePrdFile(
  projectRoot: string,
  prdPath?: string,
): {
  valid: boolean;
  path?: string;
  taskCount?: number;
  executionOrder?: string[];
  errors: string[];
} {
  const foundPath = findPrdPath(projectRoot, prdPath);

  if (!foundPath) {
    return {
      valid: false,
      errors: ['PRD file not found. Create PRD.json in project root or specify --prd path.'],
    };
  }

  const { prd, errors } = loadAndValidatePRD(foundPath);

  if (!prd) {
    return { valid: false, path: foundPath, errors };
  }

  const orderedTasks = getTaskExecutionOrder(prd.tasks);
  const executionOrder = orderedTasks.map((t) => t.id);

  return {
    valid: true,
    path: foundPath,
    taskCount: prd.tasks.length,
    executionOrder,
    errors: [],
  };
}

/**
 * Format validation result as XML
 */
export function formatValidationXML(result: ReturnType<typeof validatePrdFile>): string {
  const lines: string[] = ['<prd-validation>'];

  lines.push(`  <valid>${result.valid}</valid>`);

  if (result.path) {
    lines.push(`  <path>${result.path}</path>`);
  }

  if (result.taskCount !== undefined) {
    lines.push(`  <task-count>${result.taskCount}</task-count>`);
  }

  if (result.executionOrder && result.executionOrder.length > 0) {
    lines.push('  <execution-order>');
    for (const taskId of result.executionOrder) {
      lines.push(`    <task>${taskId}</task>`);
    }
    lines.push('  </execution-order>');
  }

  if (result.errors.length > 0) {
    lines.push('  <errors>');
    for (const err of result.errors) {
      lines.push(`    <error>${escapeXml(err)}</error>`);
    }
    lines.push('  </errors>');
  }

  lines.push('</prd-validation>');
  return lines.join('\n');
}
