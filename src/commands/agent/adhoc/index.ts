/**
 * @module commands/agent/adhoc
 * @description Ad-hoc (dynamic) agent generation and execution
 *
 * This module enables dynamic creation of specialized agents at runtime
 * using the Agent Architect meta-agent. Ad-hoc agents are generated when:
 * - No suitable existing agents match the task
 * - Task requires specialized expertise not covered by plugins
 * - User requests a "consilium" (multi-agent analysis)
 *
 * High-performing ad-hoc agents can be saved as permanent plugins.
 */

// Executor
export {
  type AdHocExecutionOptions,
  createDryRunResult,
  formatConsiliumExecution,
  formatConsiliumJSON,
  formatConsiliumText,
  formatSingleAdHocExecution,
} from './executor';

// Generator
export {
  buildGenerationPrompt,
  formatAdHocAgentXML,
  formatConsiliumPlanXML,
  prepareAdHocGeneration,
} from './generator';
// Saver
export {
  formatSaveRecommendationText,
  formatSaveRecommendationXML,
  SAVE_QUALITY_THRESHOLD,
  saveAdHocAgent,
  shouldRecommendSave,
  suggestCategory,
  suggestPluginName,
} from './saver';
// Types
export type {
  AdHocAgent,
  AdHocAgentArchetype,
  AdHocAgentResult,
  AdHocConsiliumResult,
  AdHocGenerationRequest,
  AdHocGenerationResponse,
  SaveAdHocAgentOptions,
  SaveAdHocAgentResult,
} from './types';
