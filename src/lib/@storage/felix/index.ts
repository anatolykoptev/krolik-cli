/**
 * @module lib/@storage/ralph
 * @description Ralph Loop storage operations
 */

// Attempts
export {
  completeAttempt,
  createAttempt,
  getAttemptById,
  getAttemptCount,
  getAttemptStats,
  getAttemptsByPrdTaskId,
  getAttemptsByTaskId,
  getLatestAttempt,
} from './attempts';
// Guardrails
export {
  addRelatedTask,
  createGuardrail,
  deleteGuardrail,
  getGuardrailById,
  getGuardrailStats,
  getGuardrailsByProject,
  getRelevantGuardrails,
  recordGuardrailUsage,
  searchGuardrails,
  supersedeGuardrail,
} from './guardrails';
// Sessions
export {
  addTokensAndCost,
  cancelSession,
  completeSession,
  createSession,
  deleteSession,
  failSession,
  getActiveSession,
  getLatestSession,
  getSessionById,
  getSessionStats,
  getSessionsByProject,
  incrementCompletedTasks,
  incrementFailedTasks,
  incrementSkippedTasks,
  pauseSession,
  resumeSession,
  updateCurrentTask,
  updateSessionStatus,
} from './sessions';
// Types
export type {
  FelixAttempt,
  FelixAttemptComplete,
  FelixAttemptCreate,
  FelixAttemptRow,
  FelixGuardrail,
  FelixGuardrailCreate,
  FelixGuardrailRow,
  GuardrailCategory,
  GuardrailSeverity,
  RalphSession,
  RalphSessionCreate,
  RalphSessionRow,
  RalphSessionStatus,
} from './types';
