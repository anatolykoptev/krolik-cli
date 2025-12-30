/**
 * @module commands/refactor/output/sections/ai-config.section
 * @description AI Configuration section for registry-based architecture
 *
 * Shows namespace configuration and patterns for AI assistants.
 */

import { escapeXml } from '../../../../lib/@format';
import { NAMESPACE_INFO } from '../../core/constants';
import type { NamespaceCategory } from '../../core/types';
import type { ArchHealth, DomainInfo } from '../../core/types-ai';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// TYPES
// ============================================================================

interface NamespaceEntry {
  name: NamespaceCategory;
  path: string;
  description: string;
  layer: number;
  dependsOn: NamespaceCategory[];
  usedBy: NamespaceCategory[];
  modules: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract namespace entries from domains and architecture data
 */
function extractNamespaces(domains: DomainInfo[], archHealth: ArchHealth): NamespaceEntry[] {
  const entries: NamespaceEntry[] = [];
  const seenCategories = new Set<NamespaceCategory>();

  // Group domains by category
  const categoryModules = new Map<NamespaceCategory, string[]>();

  for (const domain of domains) {
    if (domain.category === 'unknown') continue;

    if (!categoryModules.has(domain.category)) {
      categoryModules.set(domain.category, []);
    }
    categoryModules.get(domain.category)?.push(domain.name);
    seenCategories.add(domain.category);
  }

  // Check architecture layer compliance for additional namespaces
  for (const [name] of Object.entries(archHealth.layerCompliance)) {
    const cleanName = name.replace(/^@/, '');
    for (const category of Object.keys(NAMESPACE_INFO)) {
      if (category === 'unknown') continue;
      if (cleanName.toLowerCase().includes(category)) {
        seenCategories.add(category as NamespaceCategory);
      }
    }
  }

  // Create entries for each seen category
  for (const category of seenCategories) {
    const info = NAMESPACE_INFO[category];
    const modules = categoryModules.get(category) ?? [];

    entries.push({
      name: category,
      path: `lib/@${category}`,
      description: info.description,
      layer: info.layer,
      dependsOn: info.dependsOn,
      usedBy: info.usedBy,
      modules,
    });
  }

  // Sort by layer (lower = more foundational)
  return entries.sort((a, b) => a.layer - b.layer);
}

/**
 * Format a namespace entry as XML
 */
function formatNamespace(lines: string[], ns: NamespaceEntry): void {
  lines.push(`      <namespace name="@${ns.name}" path="${ns.path}" layer="${ns.layer}">`);
  lines.push(`        <description>${escapeXml(ns.description)}</description>`);

  if (ns.modules.length > 0) {
    lines.push(`        <modules>${ns.modules.join(', ')}</modules>`);
  }

  if (ns.dependsOn.length > 0) {
    lines.push(`        <depends-on>${ns.dependsOn.map((d) => `@${d}`).join(', ')}</depends-on>`);
  }

  if (ns.usedBy.length > 0) {
    lines.push(`        <used-by>${ns.usedBy.map((u) => `@${u}`).join(', ')}</used-by>`);
  }

  lines.push('      </namespace>');
}

/**
 * Format file patterns
 */
function formatPatterns(lines: string[]): void {
  lines.push('    <patterns>');
  lines.push('      <pattern name="new-module" template="lib/@{category}/{name}.ts">');
  lines.push('        <description>Create a new module in the appropriate namespace</description>');
  lines.push('        <example>lib/@core/auth.ts</example>');
  lines.push('      </pattern>');
  lines.push('      <pattern name="new-hook" template="lib/@ui/hooks/use{Name}.ts">');
  lines.push('        <description>Create a new React hook</description>');
  lines.push('        <example>lib/@ui/hooks/useFavorites.ts</example>');
  lines.push('      </pattern>');
  lines.push('      <pattern name="new-utility" template="lib/@utils/{name}.ts">');
  lines.push('        <description>Create a new utility function</description>');
  lines.push('        <example>lib/@utils/formatDate.ts</example>');
  lines.push('      </pattern>');
  lines.push(
    '      <pattern name="new-integration" template="lib/@integrations/{service}/index.ts">',
  );
  lines.push('        <description>Create a new external service integration</description>');
  lines.push('        <example>lib/@integrations/stripe/index.ts</example>');
  lines.push('      </pattern>');
  lines.push('    </patterns>');
}

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * AI Config section
 *
 * Renders namespace configuration and patterns for AI assistants.
 * Order: 55 (after domains, before recommendations)
 */
export const aiConfigSection: Section = {
  metadata: {
    id: 'ai-config',
    name: 'AI Configuration',
    description: 'Shows namespace configuration and patterns for AI',
    order: 55, // After domains
    requires: ['domains', 'architecture'],
    showWhen: 'has-data',
  },

  shouldRender(ctx: SectionContext): boolean {
    const domainsResult = ctx.results.get('domains');
    const archResult = ctx.results.get('architecture');
    return domainsResult?.status === 'success' && archResult?.status === 'success';
  },

  render(lines: string[], ctx: SectionContext): void {
    const domainsResult = ctx.results.get('domains');
    const archResult = ctx.results.get('architecture');

    const domains = domainsResult?.data as DomainInfo[] | undefined;
    const archHealth = archResult?.data as ArchHealth | undefined;

    if (!domains || !archHealth) {
      lines.push('  <ai-config status="no-data" />');
      lines.push('');
      return;
    }

    const namespaces = extractNamespaces(domains, archHealth);

    if (namespaces.length === 0) {
      lines.push('  <ai-config />');
      lines.push('');
      return;
    }

    lines.push('  <!-- AI-CONFIG - Namespace configuration for AI assistants -->');
    lines.push('  <ai-config>');

    // Namespaces
    lines.push(`    <namespaces count="${namespaces.length}">`);
    for (const ns of namespaces) {
      formatNamespace(lines, ns);
    }
    lines.push('    </namespaces>');

    // Patterns
    formatPatterns(lines);

    // Quick reference
    lines.push('    <quick-reference>');
    lines.push('      <add-server-logic>@domain or packages/api/routers</add-server-logic>');
    lines.push('      <add-client-hook>@ui/hooks</add-client-hook>');
    lines.push('      <add-utility>@utils</add-utility>');
    lines.push('      <add-constant>@domain/data</add-constant>');
    lines.push('      <add-integration>@integrations</add-integration>');
    lines.push('    </quick-reference>');

    lines.push('  </ai-config>');
    lines.push('');
  },
};
