/**
 * @module commands/fix/strategies/hardcoded/constants
 * @description Constants and patterns for hardcoded value detection
 */

// ============================================================================
// PATTERNS
// ============================================================================

export const FIXABLE_PATTERNS = {
  NUMBER: /hardcoded\s+number:\s*(\d+)/i,
  URL: /hardcoded\s+url:\s*(https?:\/\/[^\s]+)/i,
  COLOR: /hardcoded\s+color/i,
  TEXT: /hardcoded\s+string/i,
};

// Numbers that are typically intentional, not magic
export const ALLOWED_NUMBERS = new Set([
  0, 1, 2, -1, // Common indices/increments
  10, 100, 1000, // Common bases
  24, 60, 365, // Time units
  1024, 2048, // Binary sizes
]);

// ============================================================================
// KNOWN CONSTANTS MAPPING
// ============================================================================

/**
 * Well-known values that have standard names
 * Priority 0 - highest priority in generateConstName
 */
export const KNOWN_CONSTANTS: Record<number, string> = {
  // HTTP Status Codes - 2xx Success
  200: 'HTTP_OK',
  201: 'HTTP_CREATED',
  204: 'HTTP_NO_CONTENT',

  // HTTP Status Codes - 3xx Redirection
  301: 'HTTP_MOVED_PERMANENTLY',
  302: 'HTTP_FOUND',
  304: 'HTTP_NOT_MODIFIED',

  // HTTP Status Codes - 4xx Client Errors
  400: 'HTTP_BAD_REQUEST',
  401: 'HTTP_UNAUTHORIZED',
  403: 'HTTP_FORBIDDEN',
  404: 'HTTP_NOT_FOUND',
  405: 'HTTP_METHOD_NOT_ALLOWED',
  409: 'HTTP_CONFLICT',
  422: 'HTTP_UNPROCESSABLE_ENTITY',
  429: 'HTTP_TOO_MANY_REQUESTS',

  // HTTP Status Codes - 5xx Server Errors
  500: 'HTTP_INTERNAL_SERVER_ERROR',
  502: 'HTTP_BAD_GATEWAY',
  503: 'HTTP_SERVICE_UNAVAILABLE',
  504: 'HTTP_GATEWAY_TIMEOUT',

  // Note: Log levels (0-5) intentionally omitted - too ambiguous
  // (could be array indices, enum values, etc.)

  // Common Ports
  80: 'HTTP_PORT',
  443: 'HTTPS_PORT',
  3000: 'DEV_PORT',
  3001: 'DEV_PORT_ALT',
  5432: 'POSTGRES_PORT',
  6379: 'REDIS_PORT',
  8080: 'PROXY_PORT',
  8443: 'HTTPS_ALT_PORT',
  27017: 'MONGODB_PORT',

  // Common Timeouts (ms)
  5000: 'TIMEOUT_5S',
  10000: 'TIMEOUT_10S',
  30000: 'TIMEOUT_30S',
  60000: 'TIMEOUT_60S',

  // File sizes (bytes)
  1048576: 'ONE_MEGABYTE',
  5242880: 'FIVE_MEGABYTES',
  10485760: 'TEN_MEGABYTES',

  // Pagination
  20: 'DEFAULT_PAGE_SIZE',
  50: 'MAX_PAGE_SIZE',
};

// ============================================================================
// KEYWORD MAPPING
// ============================================================================

/**
 * Keywords that suggest specific constant names
 */
export const KEYWORD_TO_NAME: Record<string, string> = {
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
