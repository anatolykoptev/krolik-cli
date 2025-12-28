/**
 * @module commands/context/helpers/architecture
 * @description Re-exports architecture detection from lib/discovery/architecture
 *
 * This file exists for backwards compatibility.
 * New code should import directly from 'lib/discovery/architecture'.
 */

export {
  type ArchitecturePatterns,
  collectArchitecturePatterns,
  type DetectedPattern,
} from '../../../lib/discovery/architecture';
