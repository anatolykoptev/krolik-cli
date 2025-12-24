/**
 * Centralized error messages for Krolik CLI.
 *
 * This file consolidates duplicate error messages across the codebase
 * to ensure consistency and maintainability.
 */

export const ERROR_MESSAGES = {
  /**
   * Message shown when agents are not installed.
   * Used in: review, setup, agent commands.
   */
  AGENTS_NOT_INSTALLED: 'Agents not installed. Run: krolik setup --agents',

  /**
   * Message shown when audit data is not found.
   * Used in: fix command and audit reader.
   */
  AUDIT_DATA_NOT_FOUND: "No audit data found. Run 'krolik audit' first.",
} as const;
