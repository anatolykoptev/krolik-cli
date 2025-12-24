/**
 * @module lib/constants/hardcoded
 * @description Hardcoded Value Detection Constants
 * Single source of truth for magic number, URL, color detection
 */

// ============================================================================
// DETECTION PATTERNS
// ============================================================================

/**
 * Detection patterns for hardcoded values
 */
export const DETECTION_PATTERNS = {
  /** Magic numbers (2+ digits, not in arrays/types) */
  magicNumber: /(?<![.\w])(\d{2,}|[2-9]\d*)(?![.\w\]])/g,
  /** Hardcoded URLs in strings */
  url: /(["'`])(https?:\/\/[^"'`\s]+)\1/g,
  /** Hex colors */
  hexColor: /#([0-9A-Fa-f]{3}){1,2}\b/g,
  /** Hardcoded Russian text (i18n issues) */
  hardcodedText: /["'`][А-Яа-яЁё][А-Яа-яЁё\s]{10,}["'`]/g,
} as const;

/**
 * Fixable patterns (from issue messages)
 */
export const FIXABLE_PATTERNS = {
  NUMBER: /hardcoded\s+number:\s*(\d+)/i,
  URL: /hardcoded\s+url:\s*(https?:\/\/[^\s]+)/i,
  COLOR: /hardcoded\s+color/i,
  TEXT: /hardcoded\s+string/i,
} as const;

/**
 * Pattern for SCREAMING_SNAKE_CASE constant declarations
 */
export const CONST_DECL_PATTERN = /^\s*(?:export\s+)?const\s+[A-Z][A-Z0-9_]*\s*=/;

// ============================================================================
// ACCEPTABLE VALUES
// ============================================================================

/**
 * Numbers that are typically intentional, not magic
 */
export const ACCEPTABLE_NUMBERS = new Set([
  0,
  1,
  2,
  -1, // Common indices/increments
  10,
  100,
  1000, // Common bases
  24,
  60,
  365, // Time units
  1024,
  2048, // Binary sizes
]);

// ============================================================================
// KNOWN CONSTANTS
// ============================================================================

/** HTTP Status Codes - organized by category */
const HTTP_STATUS_CODES = {
  // 2xx Success
  200: 'HTTP_OK',
  201: 'HTTP_CREATED',
  204: 'HTTP_NO_CONTENT',
  // 3xx Redirection
  301: 'HTTP_MOVED_PERMANENTLY',
  302: 'HTTP_FOUND',
  304: 'HTTP_NOT_MODIFIED',
  // 4xx Client Errors
  400: 'HTTP_BAD_REQUEST',
  401: 'HTTP_UNAUTHORIZED',
  403: 'HTTP_FORBIDDEN',
  404: 'HTTP_NOT_FOUND',
  405: 'HTTP_METHOD_NOT_ALLOWED',
  409: 'HTTP_CONFLICT',
  422: 'HTTP_UNPROCESSABLE_ENTITY',
  429: 'HTTP_TOO_MANY_REQUESTS',
  // 5xx Server Errors
  500: 'HTTP_INTERNAL_SERVER_ERROR',
  502: 'HTTP_BAD_GATEWAY',
  503: 'HTTP_SERVICE_UNAVAILABLE',
  504: 'HTTP_GATEWAY_TIMEOUT',
} as const;

/** Common network ports */
const NETWORK_PORTS = {
  80: 'HTTP_PORT',
  443: 'HTTPS_PORT',
  3000: 'DEV_PORT',
  3001: 'DEV_PORT_ALT',
  5432: 'POSTGRES_PORT',
  6379: 'REDIS_PORT',
  8080: 'PROXY_PORT',
  8443: 'HTTPS_ALT_PORT',
  27017: 'MONGODB_PORT',
} as const;

/** Common timeout values in milliseconds */
const TIMEOUTS = {
  5000: 'TIMEOUT_5S',
  10000: 'TIMEOUT_10S',
  30000: 'TIMEOUT_30S',
  60000: 'TIMEOUT_60S',
} as const;

/** File sizes in bytes */
const FILE_SIZES = {
  1048576: 'ONE_MEGABYTE',
  5242880: 'FIVE_MEGABYTES',
  10485760: 'TEN_MEGABYTES',
} as const;

/** Pagination defaults */
const PAGINATION = {
  20: 'DEFAULT_PAGE_SIZE',
  50: 'MAX_PAGE_SIZE',
} as const;

/**
 * Well-known values that have standard names
 * Priority 0 - highest priority in constant name generation
 *
 * Note: Log levels (0-5) intentionally omitted - too ambiguous
 * (could be array indices, enum values, etc.)
 */
export const KNOWN_CONSTANTS: Record<number, string> = {
  ...HTTP_STATUS_CODES,
  ...NETWORK_PORTS,
  ...TIMEOUTS,
  ...FILE_SIZES,
  ...PAGINATION,
};

// ============================================================================
// SKIP PATTERNS
// ============================================================================

/**
 * URLs to skip (documentation, schemas)
 */
export const SKIP_URL_PATTERNS = ['schema.org', 'json-schema', 'github.com', 'docs.'] as const;

/**
 * File patterns to skip for hardcoded detection
 */
export const SKIP_FILE_PATTERNS = [
  '.config.',
  'schema',
  '.test.',
  '.spec.',
  '__tests__',
  '/constants/', // Pattern definition files
  '/@patterns/', // Pattern library
  '/@swc/', // SWC infrastructure
] as const;

// ============================================================================
// KEYWORD MAPPING
// ============================================================================

/**
 * Keywords in context that suggest specific constant names
 * Used for Priority 1 matching in generateConstName
 */
export const KEYWORD_TO_CONST_NAME: Record<string, string> = {
  // Time-related
  timeout: 'TIMEOUT_MS',
  delay: 'DELAY_MS',
  interval: 'INTERVAL_MS',
  duration: 'DURATION_MS',
  debounce: 'DEBOUNCE_MS',
  throttle: 'THROTTLE_MS',
  // Size-related
  width: 'DEFAULT_WIDTH',
  height: 'DEFAULT_HEIGHT',
  size: 'MAX_SIZE',
  length: 'MAX_LENGTH',
  limit: 'MAX_LIMIT',
  max: 'MAX_VALUE',
  min: 'MIN_VALUE',
  // Count-related
  count: 'DEFAULT_COUNT',
  total: 'TOTAL_COUNT',
  page: 'PAGE_SIZE',
  retry: 'MAX_RETRIES',
  attempt: 'MAX_ATTEMPTS',
  // Position
  index: 'DEFAULT_INDEX',
  offset: 'DEFAULT_OFFSET',
  // Network
  port: 'DEFAULT_PORT',
  threshold: 'THRESHOLD',
  // Status codes
  status: 'STATUS_CODE',
  code: 'ERROR_CODE',
};
