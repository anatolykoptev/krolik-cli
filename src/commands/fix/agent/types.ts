import { StepPriority } from "../reporter/types";
/**
 * Step status in execution
 */
export type StepStatus =
  | 'pending'
  | 'in_progress'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'rolled_back';

/**
 * Type of action in a plan step
 */
export type StepAction =
  | 'fix'           // Fix a specific issue
  | 'refactor'      // Refactor code
  | 'rename'        // Rename identifier
  | 'move'          // Move file/function
  | 'extract'       // Extract to new file
  | 'delete'        // Delete code/file
  | 'add'           // Add new code
  | 'replace'       // Replace code
  | 'update-import' // Update import paths
  | 'update-export' // Update exports
  | 'custom';       // Custom action

/**
 * A single step in an improvement plan
 */
export interface PlanStep {
  /** Step number (1-based) */
  number: number;
  /** Action type */
  action: StepAction;
  /** Human-readable description */
  description: string;
  /** Target file(s) */
  files: string[];
  /** Target line (if applicable) */
  line?: number | undefined;
  /** End line for range operations */
  endLine?: number | undefined;
  /** Original code (for verification) */
  originalCode?: string | undefined;
  /** New code to apply */
  newCode?: string | undefined;
  /** Priority */
  priority: StepPriority;
  /** Estimated effort */
  effort?: 'trivial' | 'small' | 'medium' | 'large' | undefined;
  /** Dependencies (step numbers that must complete first) */
  dependsOn?: number[] | undefined;
  /** Current status */
  status: StepStatus;
  /** Reason for this step */
  reason?: string | undefined;
}

/**
 * An improvement plan (parsed from AI output)
 */
export interface ImprovementPlan {
  /** Plan ID */
  id: string;
  /** Plan title */
  title: string;
  /** Plan description */
  description: string;
  /** Source (e.g., "AI-generated", "krolik analyze") */
  source: string;
  /** Created timestamp */
  createdAt: Date;
  /** All steps */
  steps: PlanStep[];
  /** Summary statistics */
  summary: {
    totalSteps: number;
    byPriority: Record<StepPriority, number>;
    byAction: Record<string, number>;
    estimatedEffort: string;
  };
  /** Verification config */
  verification?: {
    typecheck: boolean;
    lint: boolean;
    tests: boolean | string;
  };
}

// ============================================================================
// EXECUTION TYPES
// ============================================================================

/**
 * Execution mode
 */
export type ExecutionMode =
  | 'interactive'  // Confirm each step
  | 'batch'        // Execute all without confirmation
  | 'dry-run';     // Don't apply, just show what would happen

/**
 * Result of executing a single step
 */
export interface StepExecutionResult {
  /** Step that was executed */
  step: PlanStep;
  /** Success */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Files modified */
  filesModified: string[];
  /** Duration in ms */
  duration: number;
  /** Verification passed */
  verified: boolean;
  /** Rolled back */
  rolledBack: boolean;
}

/**
 * Result of executing an entire plan
 */
export interface PlanExecutionResult {
  /** Plan that was executed */
  plan: ImprovementPlan;
  /** Overall success */
  success: boolean;
  /** Step results */
  steps: StepExecutionResult[];
  /** Total steps executed */
  stepsExecuted: number;
  /** Steps that succeeded */
  stepsSucceeded: number;
  /** Steps that failed */
  stepsFailed: number;
  /** Steps skipped */
  stepsSkipped: number;
  /** Total duration in ms */
  duration: number;
  /** Final verification result */
  verification?: {
    typecheck: { success: boolean; errors?: number };
    lint?: { success: boolean; errors?: number };
    tests?: { success: boolean; passed?: number; failed?: number };
  };
}

// ============================================================================
// PARSER TYPES
// ============================================================================

/**
 * Supported plan formats
 */
export type PlanFormat =
  | 'markdown'  // IMPROVEMENT-PLAN.md
  | 'json'      // improvement-plan.json
  | 'yaml';     // improvement-plan.yaml

/**
 * Parser result
 */
export interface ParseResult {
  /** Success */
  success: boolean;
  /** Parsed plan (if successful) */
  plan?: ImprovementPlan;
  /** Error message (if failed) */
  error?: string;
  /** Warnings */
  warnings?: string[];
}

// ============================================================================
// CALLBACK TYPES
// ============================================================================

/**
 * Callback for step execution progress
 */
export type StepProgressCallback = (
  step: PlanStep,
  status: StepStatus,
  message?: string,
) => void;

/**
 * Callback for confirmation prompts
 */
export type ConfirmCallback = (
  step: PlanStep,
  preview: string,
) => Promise<boolean>;

/**
 * Executor options
 */
export interface ExecutorOptions {
  /** Execution mode */
  mode: ExecutionMode;
  /** Stop on first failure */
  stopOnFailure?: boolean;
  /** Run verification after each step */
  verifyEachStep?: boolean;
  /** Run verification after all steps */
  verifyAtEnd?: boolean;
  /** Progress callback */
  onProgress?: StepProgressCallback;
  /** Confirmation callback (for interactive mode) */
  onConfirm?: ConfirmCallback;
  /** Project root */
  projectRoot: string;
}
