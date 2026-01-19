/**
 * @module lib/@storage/felix
 * @description Krolik Felix storage operations
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
  FelixSession,
  FelixSessionCreate,
  FelixSessionRow,
  FelixSessionStatus,
  GuardrailCategory,
  GuardrailSeverity,
} from './types';
