/**
 * Ralph Module Constants
 *
 * Centralized configuration values to prevent magic numbers
 * and enable easy tuning of timeouts/limits.
 *
 * @module @felix/constants
 */

// =============================================================================
// TIMEOUTS (milliseconds)
// =============================================================================

/** Default CLI execution timeout (10 minutes) */
export const CLI_TIMEOUT_MS = 10 * 60 * 1000;

/** Quality gate execution timeout (5 minutes) */
export const QUALITY_GATE_TIMEOUT_MS = 5 * 60 * 1000;

/** Validation step timeout (2 minutes) */
export const VALIDATION_TIMEOUT_MS = 2 * 60 * 1000;

/** Git operation timeout (30 seconds) */
export const GIT_TIMEOUT_MS = 30 * 1000;

/** Circuit breaker reset timeout (1 minute) */
export const CIRCUIT_BREAKER_RESET_MS = 60 * 1000;

/** Rate limit delay after 429 (30 seconds) */
export const RATE_LIMIT_DELAY_MS = 30 * 1000;

/** Base retry delay (1 second) */
export const RETRY_BASE_DELAY_MS = 1000;

/** Maximum retry delay (30 seconds) */
export const RETRY_MAX_DELAY_MS = 30 * 1000;

/** Minimum delay between requests (1 second) */
export const MIN_REQUEST_DELAY_MS = 1000;

/** One minute in milliseconds */
export const ONE_MINUTE_MS = 60 * 1000;

/** One hour in milliseconds */
export const ONE_HOUR_MS = 60 * 60 * 1000;

// =============================================================================
// BUFFER & HISTORY LIMITS
// =============================================================================

/** Shell command max buffer (10MB) */
export const SHELL_MAX_BUFFER = 10 * 1024 * 1024;

/** CLI output max size (500KB) */
export const CLI_MAX_OUTPUT_SIZE = 500 * 1000;

/** Maximum request history entries for rate limiting */
export const MAX_REQUEST_HISTORY = 1000;

/** Maximum retry attempt entries in memory */
export const MAX_ATTEMPT_ENTRIES = 1000;

/** Maximum stale entry age before cleanup (1 hour) */
export const MAX_ENTRY_AGE_MS = ONE_HOUR_MS;

// =============================================================================
// CONTEXT & TOKEN LIMITS
// =============================================================================

/** Maximum tokens for injected context */
export const MAX_CONTEXT_TOKENS = 4000;

/** Schema truncation limit (characters) */
export const SCHEMA_TRUNCATE_LIMIT = 1500;

/** Routes truncation limit (characters) */
export const ROUTES_TRUNCATE_LIMIT = 1500;

/** Output truncation limit (characters) */
export const OUTPUT_TRUNCATE_LIMIT = 2000;

// =============================================================================
// VALIDATION & CLEANUP
// =============================================================================

/** Maximum age for session cleanup (10 years in days) */
export const MAX_AGE_DAYS_LIMIT = 365 * 10;

/** Default session TTL (30 days) */
export const DEFAULT_SESSION_TTL_DAYS = 30;

/** Circuit breaker failure threshold */
export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

/** Default max attempts for retries */
export const DEFAULT_MAX_ATTEMPTS = 3;

/** Default max parallel tasks */
export const DEFAULT_MAX_PARALLEL_TASKS = 3;

/** Default max cost in USD */
export const DEFAULT_MAX_COST_USD = 1.0;

// =============================================================================
// TYPES
// =============================================================================

export type ModelId = string;
