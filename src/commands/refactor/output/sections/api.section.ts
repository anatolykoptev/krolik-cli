/**
 * @module commands/refactor/output/sections/api.section
 * @description API routes section for refactor output
 *
 * Shows tRPC API routes summary with protection status and coverage.
 */

import { escapeXml } from '../../../../lib/@format';
import type { RoutesOutput } from '../../../routes/output';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * API section
 *
 * Renders tRPC routes analysis - shows unprotected routes,
 * coverage stats, and suggestions for API security.
 */
export const apiSection: Section = {
  metadata: {
    id: 'api',
    name: 'API Routes',
    description: 'Shows tRPC routes and protection status',
    order: 68, // After i18n, before migration
    requires: ['api'],
    showWhen: 'has-issues',
  },

  shouldRender(ctx: SectionContext): boolean {
    const result = ctx.results.get('api');
    if (result?.status === 'skipped') return false;
    if (result?.status === 'error') return true;

    const data = result?.data as RoutesOutput | undefined;
    return !!data && data.totalProcedures > 0;
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('api');

    // Handle error case
    if (result?.status === 'error') {
      lines.push('  <api status="error">');
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push('  </api>');
      lines.push('');
      return;
    }

    const data = result?.data as RoutesOutput | undefined;

    // Handle no data or no routers
    if (!data || data.routers.length === 0) {
      lines.push('  <!-- API: no tRPC routers found -->');
      lines.push('  <api status="not-found" />');
      lines.push('');
      return;
    }

    // Calculate unprotected routes
    const unprotectedRoutes: Array<{ router: string; procedure: string; type: string }> = [];
    for (const router of data.routers) {
      for (const proc of router.procedures) {
        if (!proc.isProtected && proc.type === 'mutation') {
          unprotectedRoutes.push({
            router: router.file,
            procedure: proc.name,
            type: proc.type,
          });
        }
      }
    }

    const protectionRate =
      data.totalProcedures > 0
        ? Math.round((data.protectedCount / data.totalProcedures) * 100)
        : 100;

    // Render API section
    lines.push('  <!-- API - tRPC routes analysis -->');
    lines.push(
      `  <api routers="${data.routers.length}" procedures="${data.totalProcedures}" protection-rate="${protectionRate}%">`,
    );

    // Summary stats
    lines.push('    <summary>');
    lines.push(`      <queries count="${data.queries}" />`);
    lines.push(`      <mutations count="${data.mutations}" />`);
    lines.push(`      <protected count="${data.protectedCount}" />`);
    lines.push(`      <unprotected count="${data.totalProcedures - data.protectedCount}" />`);
    lines.push('    </summary>');

    // Unprotected mutations (security issue)
    if (unprotectedRoutes.length > 0) {
      lines.push('    <!-- SECURITY: Unprotected mutations should require auth -->');
      lines.push(`    <unprotected-mutations count="${unprotectedRoutes.length}">`);
      for (const route of unprotectedRoutes.slice(0, 10)) {
        lines.push(
          `      <mutation router="${escapeXml(route.router)}" name="${escapeXml(route.procedure)}" />`,
        );
      }
      if (unprotectedRoutes.length > 10) {
        lines.push(`      <!-- +${unprotectedRoutes.length - 10} more unprotected mutations -->`);
      }
      lines.push('    </unprotected-mutations>');
    }

    // Router summary
    lines.push('    <routers>');
    for (const router of data.routers.slice(0, 8)) {
      const routerProtected = router.procedures.filter((p) => p.isProtected).length;
      const routerRate =
        router.procedures.length > 0
          ? Math.round((routerProtected / router.procedures.length) * 100)
          : 100;
      lines.push(
        `      <router file="${escapeXml(router.file)}" procedures="${router.procedures.length}" protected="${routerRate}%" />`,
      );
    }
    if (data.routers.length > 8) {
      lines.push(`      <!-- +${data.routers.length - 8} more routers -->`);
    }
    lines.push('    </routers>');

    // Action items
    if (unprotectedRoutes.length > 0 || protectionRate < 80) {
      lines.push('    <action-items>');
      if (unprotectedRoutes.length > 0) {
        lines.push(
          `      <action priority="high">Add auth protection to ${unprotectedRoutes.length} unprotected mutations</action>`,
        );
      }
      if (protectionRate < 80) {
        lines.push(
          `      <action priority="medium">Increase route protection rate from ${protectionRate}% to 80%+</action>`,
        );
      }
      lines.push('    </action-items>');
    }

    lines.push('  </api>');
    lines.push('');
  },
};
