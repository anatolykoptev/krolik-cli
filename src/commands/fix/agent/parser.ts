/**
 * @module commands/fix/agent/parser
 * @description Parser for AI-generated improvement plans
 *
 * Supports multiple formats:
 * - Markdown (IMPROVEMENT-PLAN.md)
 * - JSON (improvement-plan.json)
 * - YAML (improvement-plan.yaml)
 *
 * Markdown format example:
 * ```markdown
 * # Improvement Plan
 *
 * ## Summary
 * Fix 5 critical issues in src/api
 *
 * ## Steps
 *
 * ### 1. Fix SQL injection (critical)
 * **File:** src/api/users.ts:42
 * **Action:** replace
 * **Reason:** Prevent SQL injection vulnerability
 *
 * ```typescript
 * // Before
 * const query = `SELECT * FROM users WHERE id = ${id}`;
 *
 * // After
 * const query = 'SELECT * FROM users WHERE id = $1';
 * const result = await db.query(query, [id]);
 * ```
 * ```
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ImprovementPlan,
  ParseResult,
  PlanFormat,
  PlanStep,
  StepAction,
  StepPriority,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const PRIORITY_MAP: Record<string, StepPriority> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  important: 'high',
  trivial: 'low',
};

const ACTION_MAP: Record<string, StepAction> = {
  fix: 'fix',
  refactor: 'refactor',
  rename: 'rename',
  move: 'move',
  extract: 'extract',
  delete: 'delete',
  add: 'add',
  replace: 'replace',
  'update-import': 'update-import',
  'update-export': 'update-export',
  'update imports': 'update-import',
  'update exports': 'update-export',
};

// ============================================================================
// FORMAT DETECTION
// ============================================================================

/**
 * Detect plan format from file extension
 */
export function detectFormat(filePath: string): PlanFormat {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.json':
      return 'json';
    case '.yaml':
    case '.yml':
      return 'yaml';
    default:
      return 'markdown';
  }
}

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse an improvement plan from file
 */
export function parsePlanFile(filePath: string): ParseResult {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: `Plan file not found: ${filePath}`,
      };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const format = detectFormat(filePath);

    return parsePlan(content, format);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Parse an improvement plan from content
 */
export function parsePlan(content: string, format: PlanFormat): ParseResult {
  switch (format) {
    case 'json':
      return parseJsonPlan(content);
    case 'yaml':
      return parseYamlPlan(content);
    default:
      return parseMarkdownPlan(content);
  }
}

// ============================================================================
// MARKDOWN PARSER
// ============================================================================

/**
 * Parse markdown improvement plan
 */
function parseMarkdownPlan(content: string): ParseResult {
  const warnings: string[] = [];
  const steps: PlanStep[] = [];

  try {
    // Extract title
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1] ?? 'Improvement Plan';

    // Extract description from Summary section
    const summaryMatch = content.match(/##\s+Summary\s*\n([\s\S]*?)(?=\n##|\n###|$)/i);
    const description = summaryMatch?.[1]?.trim() ?? '';

    // Parse steps
    const stepPattern = /###\s+(\d+)\.\s+(.+?)(?:\s*\((\w+)\))?\s*\n([\s\S]*?)(?=\n###|\n##|$)/g;
    let match;

    while ((match = stepPattern.exec(content)) !== null) {
      const [, numberStr, stepTitle, priorityStr, stepBody] = match;
      const number = parseInt(numberStr ?? '0', 10);
      const priority = parsePriority(priorityStr ?? 'medium');

      const step = parseStepBody(number, stepTitle ?? '', priority, stepBody ?? '');

      if (step) {
        steps.push(step);
      } else {
        warnings.push(`Could not parse step ${number}: ${stepTitle}`);
      }
    }

    // Alternative step format: numbered list
    if (steps.length === 0) {
      const listPattern = /^\d+\.\s+\*\*(.+?)\*\*.*?(?:\((\w+)\))?.*?\n([\s\S]*?)(?=^\d+\.|$)/gm;

      while ((match = listPattern.exec(content)) !== null) {
        const [, stepTitle, priorityStr, stepBody] = match;
        const number = steps.length + 1;
        const priority = parsePriority(priorityStr ?? 'medium');

        const step = parseStepBody(number, stepTitle ?? '', priority, stepBody ?? '');

        if (step) {
          steps.push(step);
        }
      }
    }

    if (steps.length === 0) {
      return {
        success: false,
        error: 'No valid steps found in plan',
        warnings,
      };
    }

    const plan = buildPlan(title, description, steps);

    const result: ParseResult = {
      success: true,
      plan,
    };

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      warnings,
    };
  }
}

/**
 * Parse step body content
 */
function parseStepBody(
  number: number,
  title: string,
  priority: StepPriority,
  body: string,
): PlanStep | null {
  // Extract file and line
  const fileMatch = body.match(/\*\*File:\*\*\s*([^\n:]+)(?::(\d+))?/i);
  const file = fileMatch?.[1]?.trim() ?? '';
  const line = fileMatch?.[2] ? parseInt(fileMatch[2], 10) : undefined;

  // Extract action
  const actionMatch = body.match(/\*\*Action:\*\*\s*(\w+)/i);
  const action = parseAction(actionMatch?.[1] ?? 'fix');

  // Extract reason
  const reasonMatch = body.match(/\*\*Reason:\*\*\s*([^\n]+)/i);
  const reason = reasonMatch?.[1]?.trim();

  // Extract code blocks
  const codeBlocks = extractCodeBlocks(body);

  let originalCode: string | undefined;
  let newCode: string | undefined;

  if (codeBlocks.length >= 2) {
    // Before and After blocks
    originalCode = codeBlocks[0];
    newCode = codeBlocks[1];
  } else if (codeBlocks.length === 1) {
    // Single block is the new code
    newCode = codeBlocks[0];
  }

  // Extract effort
  const effortMatch = body.match(/\*\*Effort:\*\*\s*(\w+)/i);
  const effort = parseEffort(effortMatch?.[1]);

  return {
    number,
    action,
    description: title,
    files: file ? [file] : [],
    line,
    originalCode,
    newCode,
    priority,
    effort,
    reason,
    status: 'pending',
  };
}

/**
 * Extract code blocks from markdown
 */
function extractCodeBlocks(content: string): string[] {
  const blocks: string[] = [];
  const pattern = /```(?:\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const code = match[1]?.trim();
    if (code) {
      // Remove "// Before" and "// After" comments
      const cleanCode = code.replace(/^\/\/\s*(Before|After)\s*\n/gm, '').trim();
      blocks.push(cleanCode);
    }
  }

  return blocks;
}

/**
 * Parse priority string
 */
function parsePriority(str: string): StepPriority {
  const lower = str.toLowerCase();
  return PRIORITY_MAP[lower] ?? 'medium';
}

/**
 * Parse action string
 */
function parseAction(str: string): StepAction {
  const lower = str.toLowerCase();
  return ACTION_MAP[lower] ?? 'fix';
}

/**
 * Parse effort string
 */
function parseEffort(str?: string): PlanStep['effort'] | undefined {
  if (!str) return undefined;

  const lower = str.toLowerCase();
  if (lower.includes('trivial')) return 'trivial';
  if (lower.includes('small')) return 'small';
  if (lower.includes('medium')) return 'medium';
  if (lower.includes('large')) return 'large';

  return undefined;
}

// ============================================================================
// JSON PARSER
// ============================================================================

/**
 * Parse JSON improvement plan
 */
function parseJsonPlan(content: string): ParseResult {
  try {
    const data = JSON.parse(content) as Record<string, unknown>;

    const steps: PlanStep[] = [];

    if (Array.isArray(data.steps)) {
      for (const [index, step] of data.steps.entries()) {
        steps.push({
          number: step.number ?? index + 1,
          action: parseAction(step.action ?? 'fix'),
          description: step.description ?? '',
          files: Array.isArray(step.files) ? step.files : step.file ? [step.file] : [],
          line: step.line,
          endLine: step.endLine,
          originalCode: step.originalCode,
          newCode: step.newCode,
          priority: parsePriority(step.priority ?? 'medium'),
          effort: parseEffort(step.effort),
          dependsOn: step.dependsOn,
          reason: step.reason,
          status: 'pending',
        });
      }
    }

    if (steps.length === 0) {
      return {
        success: false,
        error: 'No steps found in JSON plan',
      };
    }

    const plan = buildPlan(
      (data.title as string) ?? 'Improvement Plan',
      (data.description as string) ?? '',
      steps,
    );

    return { success: true, plan };
  } catch (error) {
    return {
      success: false,
      error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ============================================================================
// YAML PARSER
// ============================================================================

/**
 * Parse YAML improvement plan (simple implementation)
 */
function parseYamlPlan(content: string): ParseResult {
  // For now, convert to JSON-like structure manually
  // A full YAML parser would be overkill for this use case
  try {
    const lines = content.split('\n');
    const steps: PlanStep[] = [];
    let currentStep: Partial<PlanStep> | null = null;
    let inCodeBlock = false;
    let codeContent = '';

    for (const line of lines) {
      if (line.startsWith('- number:') || line.match(/^-\s+\d+:/)) {
        if (currentStep) {
          steps.push(currentStep as PlanStep);
        }
        currentStep = {
          number: steps.length + 1,
          status: 'pending',
          priority: 'medium',
          action: 'fix',
          description: '',
          files: [],
        };
      }

      if (currentStep) {
        if (line.includes('description:')) {
          currentStep.description = line
            .split(':')
            .slice(1)
            .join(':')
            .trim()
            .replace(/^["']|["']$/g, '');
        }
        if (line.includes('file:')) {
          const file = line
            .split(':')
            .slice(1)
            .join(':')
            .trim()
            .replace(/^["']|["']$/g, '');
          currentStep.files = [file];
        }
        if (line.includes('action:')) {
          currentStep.action = parseAction(line.split(':')[1]?.trim() ?? 'fix');
        }
        if (line.includes('priority:')) {
          currentStep.priority = parsePriority(line.split(':')[1]?.trim() ?? 'medium');
        }
        if (line.includes('line:')) {
          currentStep.line = parseInt(line.split(':')[1]?.trim() ?? '0', 10);
        }
      }

      // Handle code blocks
      if (line.includes('|') && (line.includes('newCode') || line.includes('originalCode'))) {
        inCodeBlock = true;
        codeContent = '';
      } else if (inCodeBlock) {
        if (line.startsWith('  ') || line.startsWith('\t')) {
          codeContent += `${line.trimStart()}\n`;
        } else {
          inCodeBlock = false;
          if (currentStep) {
            currentStep.newCode = codeContent.trim();
          }
        }
      }
    }

    if (currentStep) {
      steps.push(currentStep as PlanStep);
    }

    if (steps.length === 0) {
      return {
        success: false,
        error: 'No steps found in YAML plan',
      };
    }

    const titleMatch = content.match(/title:\s*(.+)/);
    const descMatch = content.match(/description:\s*(.+)/);

    const plan = buildPlan(
      titleMatch?.[1]?.replace(/^["']|["']$/g, '') ?? 'Improvement Plan',
      descMatch?.[1]?.replace(/^["']|["']$/g, '') ?? '',
      steps,
    );

    return { success: true, plan };
  } catch (error) {
    return {
      success: false,
      error: `YAML parse error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build plan with calculated summary
 */
function buildPlan(title: string, description: string, steps: PlanStep[]): ImprovementPlan {
  // Calculate summary
  const byPriority: Record<StepPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const byAction: Record<string, number> = {};

  for (const step of steps) {
    byPriority[step.priority]++;
    byAction[step.action] = (byAction[step.action] ?? 0) + 1;
  }

  // Estimate effort
  let effortMinutes = 0;
  for (const step of steps) {
    switch (step.effort) {
      case 'trivial':
        effortMinutes += 5;
        break;
      case 'small':
        effortMinutes += 15;
        break;
      case 'medium':
        effortMinutes += 30;
        break;
      case 'large':
        effortMinutes += 60;
        break;
      default:
        effortMinutes += 15; // Default assumption
    }
  }

  const estimatedEffort =
    effortMinutes < 60
      ? `${effortMinutes} min`
      : `${Math.round((effortMinutes / 60) * 10) / 10} hours`;

  return {
    id: `plan-${Date.now().toString(36)}`,
    title,
    description,
    source: 'parsed',
    createdAt: new Date(),
    steps,
    summary: {
      totalSteps: steps.length,
      byPriority,
      byAction,
      estimatedEffort,
    },
  };
}
