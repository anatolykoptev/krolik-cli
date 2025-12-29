/**
 * @module lib/@detectors/hardcoded/urls
 * @description URL detection and filtering
 */

/**
 * URLs to skip (documentation, schemas)
 */
export const SKIP_URL_PATTERNS = ['schema.org', 'json-schema', 'github.com', 'docs.'] as const;

/**
 * Check if URL should be skipped
 */
export function shouldSkipUrl(url: string): boolean {
  return SKIP_URL_PATTERNS.some((pattern) => url.includes(pattern));
}
