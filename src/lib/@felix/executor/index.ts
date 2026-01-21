/**
 * Felix Executor Module
 *
 * Exports quality gate types and functions.
 *
 * @module @felix/executor
 */

export type {
  QualityGateConfig,
  QualityGateIssue,
  QualityGateResult,
  QualityGateSummary,
} from './quality-gate';

export { runQualityGate } from './quality-gate';
