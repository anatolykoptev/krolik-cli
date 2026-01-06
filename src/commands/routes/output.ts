/**
 * @module commands/routes/output
 * @description Routes output formatters
 */

import { formatJson as formatJsonBase } from '@/lib/@format';
import type { Logger } from '../../types/commands/base';
import type { TrpcRouter } from './parser';

/**
 * Routes analysis result
 */
export interface RoutesOutput {
  routers: TrpcRouter[];
  totalProcedures: number;
  queries: number;
  mutations: number;
  protectedCount: number;
}

const MAX_LENGTH = 8;

const SLICE_ARG1_VALUE = MAX_LENGTH;

/**
 * Calculate statistics from routers
 */
export function calculateStats(routers: TrpcRouter[]): RoutesOutput {
  let totalProcedures = 0;
  let queries = 0;
  let mutations = 0;
  let protectedCount = 0;

  for (const router of routers) {
    totalProcedures += router.procedures.length;
    for (const proc of router.procedures) {
      if (proc.type === 'query') queries++;
      if (proc.type === 'mutation') mutations++;
      if (proc.isProtected) protectedCount++;
    }
  }

  return { routers, totalProcedures, queries, mutations, protectedCount };
}

/**
 * Print routes to console
 */
export function printRoutes(data: RoutesOutput, logger: Logger): void {
  logger.section('tRPC Routes');
  logger.info(`Found ${data.routers.length} routers with ${data.totalProcedures} procedures\n`);
  console.log(
    `  Queries: ${data.queries} | Mutations: ${data.mutations} | Protected: ${data.protectedCount}\n`,
  );

  for (const router of data.routers) {
    const procList = router.procedures
      .slice(0, SLICE_ARG1_VALUE)
      .map((p) => {
        const icon = p.type === 'query' ? 'Q' : p.type === 'mutation' ? 'M' : 'S';
        const prot = p.isProtected ? '*' : '';
        return `${icon}:${p.name}${prot}`;
      })
      .join(', ');

    const more =
      router.procedures.length > SLICE_ARG1_VALUE
        ? ` +${router.procedures.length - MAX_LENGTH} more`
        : '';

    console.log(`\x1b[36m${router.file}\x1b[0m (${router.procedures.length})`);
    console.log(`  \x1b[2m${procList}${more}\x1b[0m`);
    console.log('');
  }

  console.log('\x1b[2mLegend: Q=query, M=mutation, S=subscription, *=protected\x1b[0m\n');
}

/**
 * Format routes as JSON
 */
export function formatJson(data: RoutesOutput): string {
  return formatJsonBase(data);
}

/**
 * Format routes as AI-friendly XML (legacy verbose format)
 */
export function formatAI(data: RoutesOutput): string {
  const lines: string[] = [];

  lines.push('<trpc-routes>');
  lines.push(
    `  <stats routers="${data.routers.length}" procedures="${data.totalProcedures}" queries="${data.queries}" mutations="${data.mutations}" protected="${data.protectedCount}" />`,
  );
  lines.push('');

  const grouped = groupByDomainDynamic(data.routers);

  for (const [domain, routers] of grouped) {
    if (routers.length === 0) continue;

    lines.push(`  <domain name="${domain}">`);
    for (const router of routers) {
      lines.push(`    <router file="${router.file}" procedures="${router.procedures.length}">`);
      for (const proc of router.procedures) {
        const protAttr = proc.isProtected ? ' protected="true"' : '';
        const inputAttr = proc.hasInput ? ' has_input="true"' : '';
        lines.push(
          `      <procedure name="${proc.name}" type="${proc.type}"${protAttr}${inputAttr} />`,
        );
      }
      lines.push('    </router>');
    }
    lines.push('  </domain>');
    lines.push('');
  }

  lines.push('</trpc-routes>');

  return lines.join('\n');
}

// ============================================================================
// SMART FORMAT (default for AI)
// ============================================================================

/**
 * Format routes as smart XML - optimized for AI consumption
 * - Groups procedures by type (queries/mutations) on single line
 * - Shows only unprotected as exceptions (most are protected)
 * - Compact router representation
 */
export function formatSmart(data: RoutesOutput): string {
  const lines: string[] = [];
  const protectedRatio = data.protectedCount / data.totalProcedures;
  const mostProtected = protectedRatio > 0.6;

  lines.push('<trpc-routes>');
  lines.push(
    `  <stats routers="${data.routers.length}" procedures="${data.totalProcedures}" queries="${data.queries}" mutations="${data.mutations}" />`,
  );

  // Show protection note
  if (mostProtected) {
    lines.push(
      `  <note>Most procedures are protected (${Math.round(protectedRatio * 100)}%). Unprotected shown explicitly.</note>`,
    );
  }

  const grouped = groupByDomainDynamic(data.routers);
  const domains = Array.from(grouped.keys());
  lines.push(`  <domains>${domains.join(', ')}</domains>`);
  lines.push('');

  for (const [domain, routers] of grouped) {
    if (routers.length === 0) continue;

    lines.push(`  <domain name="${domain}">`);

    for (const router of routers) {
      const queries = router.procedures.filter((p) => p.type === 'query').map((p) => p.name);
      const mutations = router.procedures.filter((p) => p.type === 'mutation').map((p) => p.name);
      const unprotected = router.procedures.filter((p) => !p.isProtected).map((p) => p.name);

      lines.push(`    <router file="${router.file}">`);

      if (queries.length > 0) {
        lines.push(`      <queries>${queries.join(', ')}</queries>`);
      }
      if (mutations.length > 0) {
        lines.push(`      <mutations>${mutations.join(', ')}</mutations>`);
      }
      // Only show unprotected if most are protected (exception-based)
      if (mostProtected && unprotected.length > 0) {
        lines.push(`      <public>${unprotected.join(', ')}</public>`);
      }
      // Show protected if most are unprotected
      if (!mostProtected) {
        const protectedProcs = router.procedures.filter((p) => p.isProtected).map((p) => p.name);
        if (protectedProcs.length > 0) {
          lines.push(`      <protected>${protectedProcs.join(', ')}</protected>`);
        }
      }

      lines.push('    </router>');
    }

    lines.push('  </domain>');
    lines.push('');
  }

  lines.push('</trpc-routes>');
  return lines.join('\n');
}

// ============================================================================
// COMPACT FORMAT
// ============================================================================

/**
 * Format routes as compact XML - minimal overview
 */
export function formatCompact(data: RoutesOutput): string {
  const lines: string[] = [];

  lines.push('<trpc-routes mode="compact">');
  lines.push(
    `  <stats routers="${data.routers.length}" procedures="${data.totalProcedures}" queries="${data.queries}" mutations="${data.mutations}" />`,
  );

  const grouped = groupByDomainDynamic(data.routers);
  const domains = Array.from(grouped.keys());
  lines.push(`  <domains>${domains.join(', ')}</domains>`);
  lines.push('');

  for (const [domain, routers] of grouped) {
    if (routers.length === 0) continue;

    const routerSummaries = routers.map((r) => {
      const q = r.procedures.filter((p) => p.type === 'query').length;
      const m = r.procedures.filter((p) => p.type === 'mutation').length;
      return `${r.file}(${q}Q/${m}M)`;
    });

    lines.push(`  <domain name="${domain}">`);
    lines.push(`    ${routerSummaries.join(', ')}`);
    lines.push('  </domain>');
  }

  lines.push('');
  lines.push('  <hint>Use --full for procedure details</hint>');
  lines.push('</trpc-routes>');
  return lines.join('\n');
}

/**
 * Format routes as markdown
 */
export function formatMarkdown(data: RoutesOutput): string {
  const lines: string[] = [
    '# API Routes (tRPC)',
    '',
    `> Auto-generated: ${new Date().toISOString().split('T')[0]}`,
    '',
    `**Routers:** ${data.routers.length} | **Procedures:** ${data.totalProcedures}`,
    `**Queries:** ${data.queries} | **Mutations:** ${data.mutations} | **Protected:** ${data.protectedCount}`,
    '',
    '---',
    '',
  ];

  // Group by domain
  const grouped = groupByDomain(data.routers);

  for (const [domain, routers] of Object.entries(grouped)) {
    if (routers.length === 0) continue;

    lines.push(`## ${domain}`);
    lines.push('');

    for (const router of routers) {
      lines.push(`### ${router.file}`);
      if (router.description) {
        lines.push(`> ${router.description}`);
      }
      lines.push('');

      lines.push('| Procedure | Type | Protected | Input |');
      lines.push('|-----------|------|-----------|-------|');

      for (const proc of router.procedures) {
        lines.push(
          `| ${proc.name} | ${proc.type} | ${proc.isProtected ? 'Yes' : 'No'} | ${proc.hasInput ? 'Yes' : 'No'} |`,
        );
      }

      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('*Generated by krolik-cli*');

  return lines.join('\n');
}

// ============================================================================
// DOMAIN GROUPING
// ============================================================================

/**
 * Group routers by domain - dynamic detection from file paths
 * Extracts domain from router file path:
 * - "businessBookings/crud" → "Business"
 * - "places/search" → "Places"
 * - "user/profile" → "User"
 */
function groupByDomainDynamic(routers: TrpcRouter[]): Map<string, TrpcRouter[]> {
  const result = new Map<string, TrpcRouter[]>();

  for (const router of routers) {
    const domain = inferDomainFromPath(router.file);
    if (!result.has(domain)) {
      result.set(domain, []);
    }
    result.get(domain)!.push(router);
  }

  // Sort by domain name
  return new Map([...result.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

/**
 * Infer domain from router file path
 * "businessBookings/crud" → "Business"
 * "places/search" → "Places"
 * "admin/users" → "Admin"
 */
function inferDomainFromPath(filePath: string): string {
  // Get first path segment
  const firstSegment = filePath.split('/')[0] ?? filePath;

  // Handle "businessXxx" pattern → "Business"
  if (firstSegment.startsWith('business')) {
    return 'Business';
  }

  // Handle "adminXxx" pattern → "Admin"
  if (firstSegment.startsWith('admin')) {
    return 'Admin';
  }

  // Capitalize first letter
  return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
}

/**
 * Group routers by domain (legacy - for backward compatibility)
 */
function groupByDomain(routers: TrpcRouter[]): Record<string, TrpcRouter[]> {
  const grouped = groupByDomainDynamic(routers);
  const result: Record<string, TrpcRouter[]> = {};
  for (const [domain, routerList] of grouped) {
    result[domain] = routerList;
  }
  return result;
}
