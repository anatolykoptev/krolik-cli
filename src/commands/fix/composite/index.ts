/**
 * @module commands/fix/composite
 * @description Composite (atomic) multi-operation transforms
 *
 * Provides transaction-based execution of multiple AST operations
 * as a single atomic unit - all succeed or all rollback.
 *
 * @example
 * ```typescript
 * import {
 *   createRenameTransform,
 *   executeCompositeTransform,
 * } from './composite';
 *
 * // Create a rename transform
 * const transform = createRenameTransform(projectRoot, {
 *   from: 'oldName',
 *   to: 'newName',
 *   sourceFile: 'src/utils.ts',
 *   scope: 'project',
 * }, {
 *   typecheck: true,
 * });
 *
 * // Execute atomically
 * const result = executeCompositeTransform(transform, projectRoot);
 *
 * if (result.success) {
 *   console.log('Transform applied successfully');
 * } else {
 *   console.log('Transform rolled back:', result.transaction.error);
 * }
 * ```
 */

// Types
export type {
  CompositeOperationType,
  CompositeStep,
  CompositeTransform,
  RenameConfig,
  MoveConfig,
  ExtractConfig,
  CustomConfig,
  VerificationConfig,
  Transaction,
  TransactionState,
  FileBackup,
  StepResult,
  CompositeResult,
  VerificationResult,
} from './types';

// Transaction management
export {
  beginTransaction,
  rollbackTransaction,
  commitTransaction,
  executeCompositeTransform,
  dryRunCompositeTransform,
} from './transaction';

// High-level operations
export {
  createRenameTransform,
  createMoveTransform,
  createExtractTransform,
} from './operations';
