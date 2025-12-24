/**
 * @module lib/@patterns/hardcoded/numbers
 * @description Magic number detection and known constants
 */

/**
 * Numbers that are typically intentional, not magic
 */
export const ACCEPTABLE_NUMBERS = new Set([
  0, 1, 2, -1, // Common indices/increments
  10, 100, 1000, // Common bases
  24, 60, 365, // Time units
  1024, 2048, // Binary sizes
]);

/** HTTP Status Codes */
const HTTP_STATUS_CODES: Record<number, string> = {
  200: 'HTTP_OK',
  201: 'HTTP_CREATED',
  204: 'HTTP_NO_CONTENT',
  301: 'HTTP_MOVED_PERMANENTLY',
  302: 'HTTP_FOUND',
  304: 'HTTP_NOT_MODIFIED',
  400: 'HTTP_BAD_REQUEST',
  401: 'HTTP_UNAUTHORIZED',
  403: 'HTTP_FORBIDDEN',
  404: 'HTTP_NOT_FOUND',
  405: 'HTTP_METHOD_NOT_ALLOWED',
  409: 'HTTP_CONFLICT',
  422: 'HTTP_UNPROCESSABLE_ENTITY',
  429: 'HTTP_TOO_MANY_REQUESTS',
  500: 'HTTP_INTERNAL_SERVER_ERROR',
  502: 'HTTP_BAD_GATEWAY',
  503: 'HTTP_SERVICE_UNAVAILABLE',
  504: 'HTTP_GATEWAY_TIMEOUT',
};

/** Common network ports */
const NETWORK_PORTS: Record<number, string> = {
  80: 'HTTP_PORT',
  443: 'HTTPS_PORT',
  3000: 'DEV_PORT',
  3001: 'DEV_PORT_ALT',
  5432: 'POSTGRES_PORT',
  6379: 'REDIS_PORT',
  8080: 'PROXY_PORT',
  8443: 'HTTPS_ALT_PORT',
  27017: 'MONGODB_PORT',
};

/** Common timeout values in milliseconds */
const TIMEOUTS: Record<number, string> = {
  5000: 'TIMEOUT_5S',
  10000: 'TIMEOUT_10S',
  30000: 'TIMEOUT_30S',
  60000: 'TIMEOUT_60S',
};

/** File sizes in bytes */
const FILE_SIZES: Record<number, string> = {
  1048576: 'ONE_MEGABYTE',
  5242880: 'FIVE_MEGABYTES',
  10485760: 'TEN_MEGABYTES',
};

/** Pagination defaults */
const PAGINATION: Record<number, string> = {
  20: 'DEFAULT_PAGE_SIZE',
  50: 'MAX_PAGE_SIZE',
};

/**
 * Well-known values that have standard names
 */
export const KNOWN_CONSTANTS: Record<number, string> = {
  ...HTTP_STATUS_CODES,
  ...NETWORK_PORTS,
  ...TIMEOUTS,
  ...FILE_SIZES,
  ...PAGINATION,
};

/**
 * Keywords in context that suggest specific constant names
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

/**
 * Check if number is acceptable (not magic)
 */
export function isAcceptableNumber(num: number): boolean {
  return ACCEPTABLE_NUMBERS.has(num);
}

/**
 * Get known constant name for a number, if exists
 */
export function getKnownConstantName(num: number): string | undefined {
  return KNOWN_CONSTANTS[num];
}

/**
 * Generate constant name from context keyword
 */
export function getConstNameFromKeyword(line: string): string | undefined {
  const lowerLine = line.toLowerCase();
  for (const [keyword, name] of Object.entries(KEYWORD_TO_CONST_NAME)) {
    if (lowerLine.includes(keyword)) {
      return name;
    }
  }
  return undefined;
}
