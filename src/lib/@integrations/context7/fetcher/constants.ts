/**
 * @module lib/@integrations/context7/fetcher/constants
 * @description Fetcher configuration constants
 */

/** Default TTL: 7 days in milliseconds */
export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Maximum pages to fetch in general mode */
export const DEFAULT_MAX_PAGES = 10;

/** Snippets per page (Context7 API limit) */
export const DEFAULT_SNIPPETS_PER_PAGE = 10;

/** Pages to fetch per topic in multi-topic mode */
export const DEFAULT_PAGES_PER_TOPIC = 3;
