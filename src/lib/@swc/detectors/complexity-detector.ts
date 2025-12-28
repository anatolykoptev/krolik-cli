/**
 * @module lib/@swc/detectors/complexity-detector
 * @deprecated Use '@/lib/@patterns/complexity/detector' instead.
 * This module re-exports from the canonical location for backward compatibility.
 *
 * Migration:
 * ```ts
 * // Before
 * import { ComplexityTracker, isComplexityNode } from '@/lib/@swc/detectors/complexity-detector';
 *
 * // After
 * import { ComplexityTracker, isComplexityNode } from '@/lib/@patterns/complexity/detector';
 * ```
 */

// Re-export types
export type {
  ComplexityDetection,
  FunctionTrackingInfo,
} from '@/lib/@patterns/complexity/detector';
// Re-export everything from canonical location
export {
  ComplexityTracker,
  getComplexityWeight,
  isComplexityNode,
} from '@/lib/@patterns/complexity/detector';
