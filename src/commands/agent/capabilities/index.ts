/**
 * @module commands/agent/capabilities
 * @description Agent capabilities parsing and indexing for smart selection
 */

export {
  generateCapabilitiesIndex,
  getAgentCapabilities,
  getIndexPath,
  loadCapabilitiesIndex,
  needsRegeneration,
  searchCapabilities,
} from './generate';
export { parseAgentCapabilities, parseAllAgentCapabilities } from './parser';
export type { AgentCapabilities, CapabilitiesIndex } from './types';
