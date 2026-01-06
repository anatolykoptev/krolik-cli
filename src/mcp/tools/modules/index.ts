/**
 * @module mcp/tools/modules
 * @description krolik_modules tool - Query internal lib modules and their exports
 *
 * Uses the @discovery module scanner to analyze lib/@* modules and provide
 * information about reusable utilities.
 */

import { escapeXml, truncate } from '@/lib/@format';
import { detectLibPaths, getModule, scanLibModules, searchExports } from '../../../lib/@discovery';
import {
  type ActionDefinition,
  formatToolError,
  type MCPToolDefinition,
  PROJECT_PROPERTY,
  registerTool,
  validateActionRequirements,
  withErrorHandler,
} from '../core';
import { resolveProjectPath } from '../core/projects';

// ============================================================================
// ACTION DEFINITIONS
// ============================================================================

const MODULES_ACTIONS: Record<string, ActionDefinition> = {
  list: {},
  search: { requires: [{ param: 'query', message: 'query is required for search action' }] },
  get: { requires: [{ param: 'module', message: 'module is required for get action' }] },
};

// ============================================================================
// ACTION HANDLERS
// ============================================================================

interface ModulesArgs {
  query?: string | undefined;
  module?: string | undefined;
  source?: string | undefined;
  category?: string | undefined;
  kind?: string | undefined;
}

/**
 * Categorize module by its import path and name
 */
function categorizeModule(
  mod: ReturnType<typeof scanLibModules>['modules'][0],
): 'formatting' | 'data' | 'ui' | 'api' | 'auth' | 'i18n' | 'utils' | 'types' | 'other' {
  const name = mod.name.toLowerCase();
  const importPath = mod.importPath.toLowerCase();

  if (name.includes('format') || name.includes('date') || name.includes('time'))
    return 'formatting';
  if (name.includes('schema') || name.includes('valid') || name.includes('zod')) return 'data';
  if (name.includes('ui') || name.includes('component') || name.includes('hook')) return 'ui';
  if (name.includes('api') || name.includes('trpc') || name.includes('fetch')) return 'api';
  if (name.includes('auth') || name.includes('session') || name.includes('permission'))
    return 'auth';
  if (name.includes('i18n') || name.includes('locale') || name.includes('translation'))
    return 'i18n';
  if (name.includes('type') || importPath.includes('/types')) return 'types';
  if (name.includes('util') || name.includes('helper') || name.includes('lib')) return 'utils';

  return 'other';
}

/**
 * Filter modules by source, category, and kind
 */
function filterModules(
  modules: ReturnType<typeof scanLibModules>['modules'],
  filters: Pick<ModulesArgs, 'source' | 'category' | 'kind'>,
): ReturnType<typeof scanLibModules>['modules'] {
  let filtered = modules;

  // Filter by source/package
  if (filters.source) {
    const sourceLower = filters.source.toLowerCase();
    filtered = filtered.filter((mod) => mod.relativePath.toLowerCase().includes(sourceLower));
  }

  // Filter by category
  if (filters.category) {
    filtered = filtered.filter((mod) => categorizeModule(mod) === filters.category);
  }

  // Filter by export kind
  if (filters.kind) {
    filtered = filtered.filter((mod) => mod.exports.some((e) => e.kind === filters.kind));
  }

  return filtered;
}

/**
 * Handle list action - list all modules with brief descriptions
 */
function handleList(
  projectPath: string,
  filters: Pick<ModulesArgs, 'source' | 'category' | 'kind'> = {},
): string {
  const detected = detectLibPaths(projectPath);
  const result = scanLibModules(projectPath);

  // Apply filters
  const filteredModules = filterModules(result.modules, filters);
  const hasFilters = filters.source || filters.category || filters.kind;

  if (filteredModules.length === 0) {
    if (hasFilters && result.modules.length > 0) {
      // Modules exist but filtered out
      const lines = ['<modules count="0" filtered="true">'];
      lines.push('  <status>No modules match the specified filters</status>');
      lines.push(`  <total-available>${result.modules.length}</total-available>`);
      if (filters.source)
        lines.push(`  <filter-source>${escapeXml(filters.source)}</filter-source>`);
      if (filters.category)
        lines.push(`  <filter-category>${escapeXml(filters.category)}</filter-category>`);
      if (filters.kind) lines.push(`  <filter-kind>${escapeXml(filters.kind)}</filter-kind>`);
      lines.push('  <hint>Try removing filters or use different values</hint>');
      lines.push('</modules>');
      return lines.join('\n');
    }
  }

  if (result.modules.length === 0) {
    const lines = ['<modules count="0">'];
    if (detected.paths.length === 0) {
      lines.push('  <status>No lib directories found</status>');
      lines.push('  <checked>src/lib, lib, apps/*/lib, packages/*/src</checked>');
    } else {
      lines.push('  <status>Found directories but no modules with index.ts</status>');
      lines.push(`  <searched>${detected.detected.map((d) => d.path).join(', ')}</searched>`);
    }
    lines.push('</modules>');
    return lines.join('\n');
  }

  // Group modules by source package
  const bySource = new Map<string, typeof filteredModules>();
  for (const mod of filteredModules) {
    const source = mod.relativePath.split('/')[0] || 'root';
    if (!bySource.has(source)) bySource.set(source, []);
    bySource.get(source)!.push(mod);
  }

  // Count by category
  const categories = new Map<string, number>();
  for (const mod of filteredModules) {
    const cat = categorizeModule(mod);
    categories.set(cat, (categories.get(cat) || 0) + 1);
  }

  // Find most useful exports (functions with common utility names)
  const quickRef: Array<{ name: string; module: string; signature?: string }> = [];
  const usefulPatterns = /^(format|parse|validate|create|get|is|has|to|from|use)/i;
  for (const mod of filteredModules) {
    for (const exp of mod.exports) {
      if (exp.kind === 'function' && usefulPatterns.test(exp.name) && quickRef.length < 15) {
        quickRef.push({
          name: exp.name,
          module: mod.importPath,
          ...(exp.signature && { signature: exp.signature }),
        });
      }
    }
  }

  // Calculate filtered exports count
  const filteredExports = filteredModules.reduce((sum, m) => sum + m.exports.length, 0);

  const lines: string[] = [];
  const filterAttrs = hasFilters ? ` filtered="true"` : '';
  lines.push(
    `<modules count="${filteredModules.length}" exports="${filteredExports}"${filterAttrs}>`,
  );

  // Show active filters
  if (hasFilters) {
    lines.push('  <active-filters>');
    if (filters.source) lines.push(`    <source>${escapeXml(filters.source)}</source>`);
    if (filters.category) lines.push(`    <category>${escapeXml(filters.category)}</category>`);
    if (filters.kind) lines.push(`    <kind>${escapeXml(filters.kind)}</kind>`);
    lines.push(`    <total-unfiltered>${result.modules.length}</total-unfiltered>`);
    lines.push('  </active-filters>');
  }

  // Summary section
  lines.push('  <summary>');
  lines.push(`    <total-modules>${filteredModules.length}</total-modules>`);
  lines.push(`    <total-exports>${filteredExports}</total-exports>`);
  lines.push('    <categories>');
  for (const [cat, count] of categories) {
    if (count > 0) lines.push(`      <${cat}>${count}</${cat}>`);
  }
  lines.push('    </categories>');
  // Show available sources for filtering hints
  const availableSources = [
    ...new Set(result.modules.map((m) => m.relativePath.split('/')[0] || 'root')),
  ];
  if (!hasFilters && availableSources.length > 1) {
    lines.push(`    <available-sources>${availableSources.join(', ')}</available-sources>`);
  }
  lines.push('  </summary>');

  // Quick reference - most useful functions
  if (quickRef.length > 0) {
    lines.push('  <quick-reference hint="Common utility functions you can use">');
    for (const fn of quickRef) {
      const sig = fn.signature ? escapeXml(fn.signature) : '()';
      lines.push(
        `    <fn name="${escapeXml(fn.name)}" sig="${sig}" from="${escapeXml(fn.module)}"/>`,
      );
    }
    lines.push('  </quick-reference>');
  }

  // Modules grouped by source
  for (const [source, mods] of bySource) {
    const sourceExports = mods.reduce((sum, m) => sum + m.exports.length, 0);
    lines.push(
      `  <source name="${escapeXml(source)}" modules="${mods.length}" exports="${sourceExports}">`,
    );

    for (const mod of mods.slice(0, 20)) {
      // Limit to 20 per source
      const funcCount = mod.exports.filter((e) => e.kind === 'function').length;
      const typeCount = mod.exports.filter((e) => ['type', 'interface'].includes(e.kind)).length;

      lines.push(
        `    <module name="${escapeXml(mod.name)}" import="${escapeXml(mod.importPath)}">`,
      );

      if (funcCount > 0 || typeCount > 0) {
        lines.push(`      <stats fn="${funcCount}" types="${typeCount}"/>`);
      }

      // Show top 3 exports only for brevity
      const topExports = mod.exports.slice(0, 3).map((e) => e.name);
      if (topExports.length > 0) {
        const more = mod.exports.length > 3 ? ` +${mod.exports.length - 3}` : '';
        lines.push(`      <exports>${escapeXml(topExports.join(', '))}${more}</exports>`);
      }

      lines.push('    </module>');
    }

    if (mods.length > 20) {
      lines.push(`    <truncated>+${mods.length - 20} more modules</truncated>`);
    }

    lines.push('  </source>');
  }

  // Usage hints
  lines.push('  <hints>');
  lines.push('    <hint>Use action="search" query="formatDate" to find specific functions</hint>');
  lines.push('    <hint>Use action="get" module="format" for detailed module info</hint>');
  lines.push('  </hints>');

  lines.push('</modules>');
  return lines.join('\n');
}

/**
 * Handle search action - search exports by name
 */
function handleSearch(
  projectPath: string,
  query: string,
  filters: Pick<ModulesArgs, 'source' | 'category' | 'kind'> = {},
): string {
  const result = scanLibModules(projectPath);

  // Apply module filters first
  const filteredResult = {
    ...result,
    modules: filterModules(result.modules, filters),
    totalExports: filterModules(result.modules, filters).reduce(
      (sum, m) => sum + m.exports.length,
      0,
    ),
  };

  let matches = searchExports(filteredResult, query);

  // Additional filter by kind if specified
  if (filters.kind) {
    matches = matches.filter((m) => m.export.kind === filters.kind);
  }

  const hasFilters = filters.source || filters.category || filters.kind;

  if (matches.length === 0) {
    // Check if matches exist without filters
    const unfilteredMatches = searchExports(result, query);

    const lines = [`<search query="${escapeXml(query)}" count="0">`];
    lines.push('  <status>No matches found</status>');

    if (hasFilters && unfilteredMatches.length > 0) {
      lines.push(`  <unfiltered-matches>${unfilteredMatches.length}</unfiltered-matches>`);
      lines.push('  <hint>Try removing filters to see all matches</hint>');
    } else {
      // Suggest similar terms from all modules
      const allNames = result.modules.flatMap((m) => m.exports.map((e) => e.name));
      const suggestions = allNames
        .filter((n) => n.toLowerCase().includes(query.slice(0, 3).toLowerCase()))
        .slice(0, 5);

      if (suggestions.length > 0) {
        lines.push(`  <suggestions>${suggestions.join(', ')}</suggestions>`);
      }
      lines.push('  <hint>Try broader terms like "format", "parse", "validate"</hint>');
    }
    lines.push('</search>');
    return lines.join('\n');
  }

  const filterAttrs = hasFilters ? ` filtered="true"` : '';
  const lines = [`<search query="${escapeXml(query)}" count="${matches.length}"${filterAttrs}>`];

  // Show active filters
  if (hasFilters) {
    lines.push('  <active-filters>');
    if (filters.source) lines.push(`    <source>${escapeXml(filters.source)}</source>`);
    if (filters.category) lines.push(`    <category>${escapeXml(filters.category)}</category>`);
    if (filters.kind) lines.push(`    <kind>${escapeXml(filters.kind)}</kind>`);
    lines.push('  </active-filters>');
  }

  // Group by module for cleaner output
  const byModule = new Map<string, typeof matches>();
  for (const m of matches) {
    const key = m.module.importPath;
    if (!byModule.has(key)) byModule.set(key, []);
    byModule.get(key)!.push(m);
  }

  for (const [importPath, moduleMatches] of byModule) {
    lines.push(`  <module import="${escapeXml(importPath)}">`);

    for (const match of moduleMatches) {
      const exp = match.export;
      const asyncAttr = exp.isAsync ? ' async="true"' : '';
      const sig = exp.signature ? ` sig="${escapeXml(exp.signature)}"` : '';

      lines.push(`    <${exp.kind} name="${escapeXml(exp.name)}"${sig}${asyncAttr}/>`);
    }

    lines.push('  </module>');
  }

  // Usage example
  if (matches.length > 0 && matches[0]) {
    const first = matches[0];
    lines.push('  <usage-example>');
    lines.push(`    import { ${first.export.name} } from '${first.module.importPath}';`);
    lines.push('  </usage-example>');
  }

  lines.push('</search>');
  return lines.join('\n');
}

/**
 * Handle get action - get detailed info about a specific module
 */
function handleGet(projectPath: string, moduleName: string): string {
  const result = scanLibModules(projectPath);
  const mod = getModule(result, moduleName);

  if (!mod) {
    // Find similar module names
    const similar = result.modules
      .filter((m) => m.name.toLowerCase().includes(moduleName.toLowerCase().slice(0, 3)))
      .map((m) => m.name)
      .slice(0, 5);

    const lines = [`<module name="${escapeXml(moduleName)}" status="not-found">`];
    lines.push('  <error>Module not found</error>');
    if (similar.length > 0) {
      lines.push(`  <similar>${similar.join(', ')}</similar>`);
    }
    lines.push(
      `  <available>${result.modules
        .slice(0, 10)
        .map((m) => m.name)
        .join(', ')}...</available>`,
    );
    lines.push('</module>');
    return lines.join('\n');
  }

  const functions = mod.exports.filter((e) => e.kind === 'function');
  const types = mod.exports.filter((e) => ['type', 'interface'].includes(e.kind));
  const enums = mod.exports.filter((e) => e.kind === 'enum');
  const classes = mod.exports.filter((e) => e.kind === 'class');
  const consts = mod.exports.filter((e) => e.kind === 'const');

  const lines = [`<module name="${escapeXml(mod.name)}">`];

  // Import info at top for easy copy-paste
  lines.push(`  <import-path>${escapeXml(mod.importPath)}</import-path>`);

  if (mod.description) {
    lines.push(`  <description>${escapeXml(truncate(mod.description, 300))}</description>`);
  }

  // Quick stats
  lines.push('  <stats>');
  lines.push(`    <functions>${functions.length}</functions>`);
  lines.push(`    <types>${types.length}</types>`);
  lines.push(`    <enums>${enums.length}</enums>`);
  lines.push(`    <classes>${classes.length}</classes>`);
  lines.push(`    <constants>${consts.length}</constants>`);
  lines.push('  </stats>');

  // Functions with signatures
  if (functions.length > 0) {
    lines.push('  <functions>');
    for (const fn of functions) {
      const asyncAttr = fn.isAsync ? ' async="true"' : '';
      const sig = fn.signature ? escapeXml(fn.signature) : '()';
      lines.push(`    <fn name="${escapeXml(fn.name)}" sig="${sig}"${asyncAttr}/>`);
    }
    lines.push('  </functions>');
  }

  // Types list (compact)
  if (types.length > 0) {
    lines.push(`  <types>${types.map((t) => escapeXml(t.name)).join(', ')}</types>`);
  }

  if (enums.length > 0) {
    lines.push(`  <enums>${enums.map((e) => escapeXml(e.name)).join(', ')}</enums>`);
  }

  if (classes.length > 0) {
    lines.push(`  <classes>${classes.map((c) => escapeXml(c.name)).join(', ')}</classes>`);
  }

  if (consts.length > 0) {
    lines.push(`  <constants>${consts.map((c) => escapeXml(c.name)).join(', ')}</constants>`);
  }

  // Usage example
  lines.push('  <usage>');
  const exports = mod.exports.slice(0, 3).map((e) => e.name);
  lines.push(`    import { ${exports.join(', ')} } from '${mod.importPath}';`);
  lines.push('  </usage>');

  if (mod.example) {
    lines.push(`  <example><![CDATA[${mod.example}]]></example>`);
  }

  lines.push('</module>');
  return lines.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const modulesTool: MCPToolDefinition = {
  name: 'krolik_modules',
  description: `Query reusable lib modules and their exports. Use before writing utilities to check if something already exists.

Actions:
- list: List all modules with brief descriptions
- search: Search exports by name
- get: Get detailed info about a specific module

Use this tool to:
- Discover available utilities before writing new code
- Find existing functions, types, and classes
- Understand module structure and exports
- Avoid code duplication

Filters (for list and search actions):
- source: Filter by package/source (e.g., "apps/web", "packages/shared")
- category: Filter by module category (formatting, data, ui, api, auth, i18n, utils, types, other)
- kind: Filter by export type (function, type, interface, enum, class, const)

Examples:
- List all: { action: "list" }
- Search: { action: "search", query: "parse" }
- Get module: { action: "get", module: "fs" }
- List UI modules: { action: "list", category: "ui" }
- Search functions in shared: { action: "search", query: "format", source: "packages/shared", kind: "function" }`,

  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      action: {
        type: 'string',
        enum: ['list', 'search', 'get'],
        description: 'Action to perform',
      },
      query: {
        type: 'string',
        description: 'Search query for export names (for action: search)',
      },
      module: {
        type: 'string',
        description: 'Module name without @ prefix (for action: get)',
      },
      source: {
        type: 'string',
        description: 'Filter by source/package (e.g., "apps/web", "packages/shared")',
      },
      category: {
        type: 'string',
        enum: ['formatting', 'data', 'ui', 'api', 'auth', 'i18n', 'utils', 'types', 'other'],
        description: 'Filter by module category',
      },
      kind: {
        type: 'string',
        enum: ['function', 'type', 'interface', 'enum', 'class', 'const'],
        description: 'Filter by export kind',
      },
    },
    required: ['action'],
  },

  template: {
    when: 'Before writing utilities',
    params: '`action: "search", query: "..."`',
  },
  category: 'context',

  handler: (args, workspaceRoot) => {
    const action = args.action as string;

    // Validate action requirements using shared utility
    const validationError = validateActionRequirements(action, args, MODULES_ACTIONS);
    if (validationError) return validationError;

    // Resolve project path
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);
    if ('error' in resolved) {
      return resolved.error;
    }
    const projectPath = resolved.path;

    // Type-safe args for action handlers
    const modulesArgs: ModulesArgs = {
      query: args.query as string | undefined,
      module: args.module as string | undefined,
      source: args.source as string | undefined,
      category: args.category as string | undefined,
      kind: args.kind as string | undefined,
    };

    // Extract filters from args
    const filters = {
      source: modulesArgs.source,
      category: modulesArgs.category,
      kind: modulesArgs.kind,
    };

    // Use consistent error handling wrapper
    return withErrorHandler('modules', action, () => {
      switch (action) {
        case 'list':
          return handleList(projectPath, filters);
        case 'search':
          return handleSearch(projectPath, modulesArgs.query as string, filters);
        case 'get':
          return handleGet(projectPath, modulesArgs.module as string);
        default:
          // This should never happen due to validateActionRequirements
          return formatToolError('modules', action, `Unknown action: ${action}`);
      }
    });
  },
};

registerTool(modulesTool);
