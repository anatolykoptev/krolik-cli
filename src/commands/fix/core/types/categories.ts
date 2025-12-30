/**
 * @module commands/fix/core/types/categories
 * @description Category and severity type definitions
 *
 * NOTE: QualityCategory is canonically defined in @/lib/@detectors/issue-factory/types.ts
 * and re-exported here for local imports within the fix command.
 */

import type { Severity } from '../../../../types/severity';

/**
 * Severity levels for quality issues
 * Re-exported from shared severity type
 */
export type QualitySeverity = Severity;

/**
 * Categories of quality issues
 * Re-exported from @detectors for use in fix command
 */
export type { QualityCategory } from '@/lib/@detectors/patterns/issue-factory/types';
