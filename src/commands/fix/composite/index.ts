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

// High-level operations
export {
  createExtractTransform,
  createMoveTransform,
  createRenameTransform,
} from './operations';

// Transaction management
export {
  beginTransaction,
  commitTransaction,
  dryRunCompositeTransform,
  executeCompositeTransform,
  rollbackTransaction,
} from './transaction';
// Types
export type {
  CompositeOperationType,
  CompositeResult,
  CompositeStep,
  CompositeTransform,
  CustomConfig,
  ExtractConfig,
  FileBackup,
  MoveConfig,
  RenameConfig,
  StepResult,
  Transaction,
  TransactionState,
  VerificationConfig,
  VerificationResult,
} from './types';
