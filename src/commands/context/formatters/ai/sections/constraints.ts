/**
 * @module commands/context/formatters/ai/sections/constraints
 * @description Format critical constraints section for AI context
 *
 * Priority: P0 (right after summary)
 * Token budget: ~100 tokens
 *
 * Shows hard requirements the agent MUST follow:
 * - Concurrency rules (transaction requirements)
 * - Cascade delete risks
 * - Validation constraints
 * - Security patterns
 */

import { abbreviateSeverity } from '@/lib/@format';
import { type Constraint, collectConstraints } from '../../../collectors/constraints';
import type { AiContextData } from '../../../types';

/** Max constraints to show (keep token budget low) */
const MAX_CONSTRAINTS = 6;

/**
 * Format constraints section at P0 priority
 *
 * Attribute abbreviations:
 * - `d` = domain
 * - `p` = priority
 * - `t` = type
 * - `s` = severity (abbreviated: CRIT, HIGH, MED)
 *
 * @example Output:
 * ```xml
 * <constraints d="booking" p="P0">
 *   <c t="concurrency" s="CRIT">Booking creation REQUIRES Prisma $transaction</c>
 *   <c t="cascade" s="CRIT">Booking.place -> Place: cascade delete (data loss)</c>
 *   <c t="validation" s="HIGH">Booking.userId is required (FK constraint)</c>
 * </constraints>
 * ```
 */
export function formatConstraintsSection(lines: string[], data: AiContextData): void {
  // Collect constraints from all sources
  const constraints = collectConstraints(
    data.schema,
    data.dbRelations,
    data.hints || {},
    data.context.domains,
  );

  // Skip if no constraints found
  if (constraints.length === 0) {
    return;
  }

  // Limit to top constraints by severity
  const topConstraints = constraints.slice(0, MAX_CONSTRAINTS);

  // Domain for context
  const domain = data.context.domains[0] || 'general';

  lines.push(`  <constraints d="${domain}" p="P0">`);

  for (const constraint of topConstraints) {
    const abbrevSeverity = abbreviateSeverity(constraint.severity);
    // Truncate long messages
    const message = truncateMessage(constraint.message, 80);
    lines.push(`    <c t="${constraint.type}" s="${abbrevSeverity}">${message}</c>`);
  }

  // Add count if more constraints exist
  if (constraints.length > MAX_CONSTRAINTS) {
    const remaining = constraints.length - MAX_CONSTRAINTS;
    lines.push(`    <more n="${remaining}"/>`);
  }

  lines.push('  </constraints>');
}

/**
 * Truncate message to max length, adding ellipsis if needed
 */
function truncateMessage(message: string, maxLength: number): string {
  if (message.length <= maxLength) {
    return message;
  }
  return `${message.slice(0, maxLength - 3)}...`;
}

/**
 * Filter constraints by type
 */
export function filterConstraintsByType(
  constraints: Constraint[],
  types: Constraint['type'][],
): Constraint[] {
  const typeSet = new Set(types);
  return constraints.filter((c) => typeSet.has(c.type));
}

/**
 * Get only critical constraints (for minimal mode)
 */
export function getCriticalConstraints(constraints: Constraint[]): Constraint[] {
  return constraints.filter((c) => c.severity === 'critical');
}
