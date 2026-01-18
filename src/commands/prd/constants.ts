/**
 * PRD Generation Constants
 *
 * @module commands/prd/constants
 */

/**
 * Default values for PRD generation
 */
export const PRD_DEFAULTS = {
  model: 'sonnet' as const,
  maxTasks: 10,
  complexity: 'auto' as const,
  format: 'xml' as const,
} as const;

/**
 * Limits for PRD generation
 */
export const PRD_LIMITS = {
  maxTasks: 20,
  maxAcceptanceCriteria: 10,
  maxFilesAffected: 20,
  maxDependencies: 5,
  maxTags: 10,
  /** Max files per task before splitting */
  maxFilesPerTask: 2,
} as const;

/**
 * Priority inference from GitHub labels
 */
export const PRIORITY_LABELS: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  critical: 'critical',
  urgent: 'critical',
  P0: 'critical',
  high: 'high',
  important: 'high',
  P1: 'high',
  medium: 'medium',
  normal: 'medium',
  P2: 'medium',
  low: 'low',
  minor: 'low',
  P3: 'low',
} as const;

/**
 * Tag extraction from GitHub labels
 */
export const TAG_LABELS: Record<string, string> = {
  bug: 'bugfix',
  fix: 'bugfix',
  feature: 'feature',
  enhancement: 'feature',
  refactor: 'refactor',
  test: 'test',
  docs: 'docs',
  documentation: 'docs',
  security: 'security',
  performance: 'performance',
  chore: 'chore',
  ci: 'ci',
} as const;

/**
 * Complexity keywords for auto-detection
 */
export const COMPLEXITY_KEYWORDS: Record<
  string,
  'trivial' | 'simple' | 'moderate' | 'complex' | 'epic'
> = {
  trivial: 'trivial',
  tiny: 'trivial',
  quick: 'trivial',
  small: 'simple',
  simple: 'simple',
  minor: 'simple',
  moderate: 'moderate',
  medium: 'moderate',
  complex: 'complex',
  large: 'complex',
  major: 'complex',
  epic: 'epic',
  huge: 'epic',
} as const;

/**
 * System prompt for task decomposition
 */
export const DECOMPOSITION_SYSTEM_PROMPT = `You are a senior software architect decomposing a GitHub issue into actionable development tasks.

Your task is to analyze the issue and project context, then output a JSON array of tasks.

Rules:
1. Each task should be atomic and completable in a single session
2. Use kebab-case for task IDs (e.g., "add-login-form")
3. Dependencies must reference other task IDs
4. Acceptance criteria should be verifiable (preferably testable)
5. Files affected should be real paths based on project context
6. Complexity: trivial (<30min), simple (<1h), moderate (<3h), complex (<8h), epic (>8h)
7. Tasks should follow dependency order (no circular deps)

Output format (JSON array):
[
  {
    "id": "task-id",
    "title": "Human-readable title",
    "description": "Detailed description of what to do",
    "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
    "filesAffected": ["src/path/to/file.ts"],
    "complexity": "moderate",
    "priority": "high",
    "dependencies": ["other-task-id"],
    "tags": ["feature", "api"]
  }
]

IMPORTANT: Output ONLY valid JSON array, no markdown, no explanations.`;
