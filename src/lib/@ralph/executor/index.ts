/**
 * Ralph Executor Module
 *
 * Exports quality gate types and functions.
 *
 * @module @ralph/executor
 */

export type {
  QualityGateConfig,
  QualityGateIssue,
  QualityGateResult,
  QualityGateSummary,
} from './quality-gate';

export { runQualityGate } from './quality-gate';
