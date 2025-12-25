/**
 * @module commands/context/helpers/architecture
 * @description Re-exports architecture detection from lib/@architecture
 *
 * This file exists for backwards compatibility.
 * New code should import directly from 'lib/@architecture'.
 */

export {
  type ArchitecturePatterns,
  collectArchitecturePatterns,
  type DetectedPattern,
} from '../../../lib/@architecture';
