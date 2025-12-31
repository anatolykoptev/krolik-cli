/**
 * @module commands/context/formatters/ai/sections/entrypoints
 * @description Format entry points and data flow sections
 *
 * Entry points (~150 tokens): Shows WHERE to start reading code for a domain
 * Data flow (~100 tokens): Shows HOW data moves through the system
 *
 * These sections help AI understand the codebase structure quickly.
 */

import type { AiContextData, DataFlow, EntryPoint } from '../../../types';

/**
 * Group entry points by layer for compact display
 */
function groupByLayer(entryPoints: EntryPoint[]): Map<string, EntryPoint[]> {
  const grouped = new Map<string, EntryPoint[]>();

  for (const ep of entryPoints) {
    const existing = grouped.get(ep.layer) || [];
    existing.push(ep);
    grouped.set(ep.layer, existing);
  }

  return grouped;
}

/**
 * Format entry points section (~150 tokens)
 *
 * Groups entry points by layer (backend/frontend/database) and shows
 * the key files for each role.
 *
 * @example
 * <entrypoints domain="booking">
 *   <backend>
 *     <file role="router">packages/api/src/routers/bookings.ts</file>
 *     <file role="service">packages/api/src/services/booking.ts</file>
 *   </backend>
 *   <frontend>
 *     <file role="hooks">apps/web/features/booking/hooks/useBookings.ts</file>
 *     <file role="components">apps/web/features/booking/components/BookingForm.tsx</file>
 *   </frontend>
 *   <database>
 *     <file role="schema">packages/db/prisma/models/bookings.prisma</file>
 *   </database>
 * </entrypoints>
 */
export function formatEntryPointsSection(lines: string[], data: AiContextData): void {
  const { entryPoints, context } = data;
  if (!entryPoints || entryPoints.length === 0) return;

  // Get primary domain for the attribute
  const domain = context.domains[0] || 'unknown';

  lines.push(`  <entrypoints domain="${domain}" count="${entryPoints.length}">`);

  const grouped = groupByLayer(entryPoints);

  // Order: backend -> frontend -> database (typical read order)
  const layerOrder: Array<'backend' | 'frontend' | 'database'> = [
    'backend',
    'frontend',
    'database',
  ];

  for (const layer of layerOrder) {
    const layerPoints = grouped.get(layer);
    if (!layerPoints || layerPoints.length === 0) continue;

    lines.push(`    <${layer}>`);

    // Limit to 3 files per layer to keep token count low
    for (const ep of layerPoints.slice(0, 3)) {
      lines.push(`      <file role="${ep.role}">${ep.file}</file>`);
    }

    if (layerPoints.length > 3) {
      lines.push(`      <!-- +${layerPoints.length - 3} more files -->`);
    }

    lines.push(`    </${layer}>`);
  }

  lines.push('  </entrypoints>');
}

/**
 * Format data flow section (~100 tokens)
 *
 * Shows simplified data flow for common operations, helping AI
 * understand how data moves through the application.
 *
 * @example
 * <data-flow domain="booking">
 *   <flow name="Create Booking">
 *     <step n="1">BookingForm component</step>
 *     <step n="2">useBookings hook -> tRPC mutation</step>
 *     <step n="3">bookingsRouter.create -> Prisma</step>
 *   </flow>
 *   <flow name="List Bookings">
 *     <step n="1">BookingList component</step>
 *     <step n="2">useBookings hook -> tRPC query</step>
 *     <step n="3">bookingsRouter.list -> Prisma</step>
 *   </flow>
 * </data-flow>
 */
export function formatDataFlowSection(lines: string[], data: AiContextData): void {
  const { dataFlows, context } = data;
  if (!dataFlows || dataFlows.length === 0) return;

  // Get primary domain for the attribute
  const domain = context.domains[0] || 'unknown';

  lines.push(`  <data-flow domain="${domain}">`);

  // Limit to 2 flows to keep token count low
  for (const flow of dataFlows.slice(0, 2)) {
    formatFlow(lines, flow);
  }

  if (dataFlows.length > 2) {
    lines.push(`    <!-- +${dataFlows.length - 2} more flows -->`);
  }

  lines.push('  </data-flow>');
}

/**
 * Format a single data flow
 */
function formatFlow(lines: string[], flow: DataFlow): void {
  lines.push(`    <flow name="${flow.name}">`);

  // Limit steps to keep compact
  for (const step of flow.steps.slice(0, 4)) {
    // Include file path hint if available
    const fileHint = step.file ? ` f="${abbreviatePath(step.file)}"` : '';
    lines.push(`      <step n="${step.step}"${fileHint}>${step.description}</step>`);
  }

  if (flow.steps.length > 4) {
    lines.push(`      <!-- +${flow.steps.length - 4} more steps -->`);
  }

  lines.push('    </flow>');
}

/**
 * Abbreviate path for compact display
 * "packages/api/src/routers/bookings.ts" -> "api/routers/bookings.ts"
 */
function abbreviatePath(filePath: string): string {
  // Remove common prefixes
  let abbreviated = filePath
    .replace(/^packages\//, '')
    .replace(/^apps\//, '')
    .replace(/\/src\//, '/');

  // Keep reasonable length
  if (abbreviated.length > 40) {
    const parts = abbreviated.split('/');
    if (parts.length > 3) {
      abbreviated = `${parts[0]}/.../${parts[parts.length - 1]}`;
    }
  }

  return abbreviated;
}
