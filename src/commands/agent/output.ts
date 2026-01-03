/**
 * @module commands/agent/output
 * @description Output formatters for agent command
 *
 * @deprecated Use imports from './output/index' directly
 * This file re-exports from output/ folder for backward compatibility
 */

export {
  formatAgentListAI,
  formatAgentListText,
  formatResultAI,
  formatResultText,
  groupAgentsByCategory,
} from './output/index';
