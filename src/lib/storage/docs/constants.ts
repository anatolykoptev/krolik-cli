/**
 * @module lib/storage/docs/constants
 * @description Storage constants and configuration
 */

/** Cache TTL in days */
export const TTL_DAYS = 7;

/** Calculate expiration epoch (TTL_DAYS from now) */
export function getExpirationEpoch(): number {
  return Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000;
}
