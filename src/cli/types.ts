/**
 * @module cli/types
 * @description Shared CLI types
 */

/** Command options type - flexible key-value map for CLI options */
export interface CommandOptions {
  [key: string]: unknown;
}
