/**
 * @module mcp/tools/modules
 * @description krolik_modules tool - Query internal lib modules and their exports
 *
 * Uses the @discovery module scanner to analyze lib/@* modules and provide
 * information about reusable utilities.
 */

import { escapeXml, truncate } from '@/lib/@format';
import {
  getModule,
  type ModuleExport,
  scanLibModules,
  searchExports,
} from '../../../lib/@discovery';
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
}

/**
 * Format a single export as XML
 */
function formatExport(exp: ModuleExport): string[] {
  const lines: string[] = [];
  const asyncAttr = exp.isAsync ? ' async="true"' : '';

  lines.push(`      <export name="${escapeXml(exp.name)}" kind="${exp.kind}"${asyncAttr}>`);

  if (exp.signature) {
    lines.push(`        <signature>${escapeXml(exp.signature)}</signature>`);
  }

  if (exp.params && exp.params.length > 0) {
    lines.push('        <params>');
    for (const param of exp.params) {
      const typeAttr = param.type ? ` type="${escapeXml(param.type)}"` : '';
      lines.push(`          <param name="${escapeXml(param.name)}"${typeAttr}/>`);
    }
    lines.push('        </params>');
  }

  if (exp.returnType) {
    lines.push(`        <returns>${escapeXml(exp.returnType)}</returns>`);
  }

  if (exp.description) {
    lines.push(`        <description>${escapeXml(truncate(exp.description, 200))}</description>`);
  }

  lines.push('      </export>');
  return lines;
}

/**
 * Handle list action - list all modules with brief descriptions
 */
function handleList(projectPath: string): string {
  const result = scanLibModules(projectPath);

  if (result.modules.length === 0) {
    return '<modules-list count="0"><message>No lib modules found. Make sure the project has a src/lib directory with @-prefixed modules.</message></modules-list>';
  }

  const lines = [
    `<modules-list count="${result.modules.length}" exports="${result.totalExports}" duration="${result.durationMs}ms">`,
  ];

  for (const mod of result.modules) {
    const funcCount = mod.exports.filter((e) => e.kind === 'function').length;
    const typeCount = mod.exports.filter((e) =>
      ['type', 'interface', 'enum'].includes(e.kind),
    ).length;

    lines.push(`  <module name="${escapeXml(mod.name)}" import="${escapeXml(mod.importPath)}">`);
    lines.push(`    <stats functions="${funcCount}" types="${typeCount}"/>`);

    if (mod.description) {
      lines.push(`    <description>${escapeXml(truncate(mod.description, 150))}</description>`);
    }

    // List top exports (first 5)
    const topExports = mod.exports.slice(0, 5);
    if (topExports.length > 0) {
      const exportNames = topExports.map((e) => e.name).join(', ');
      const moreCount = mod.exports.length - topExports.length;
      const moreText = moreCount > 0 ? ` (+${moreCount} more)` : '';
      lines.push(`    <exports>${escapeXml(exportNames)}${moreText}</exports>`);
    }

    lines.push('  </module>');
  }

  lines.push('</modules-list>');
  return lines.join('\n');
}

/**
 * Handle search action - search exports by name
 */
function handleSearch(projectPath: string, query: string): string {
  const result = scanLibModules(projectPath);
  const matches = searchExports(result, query);

  if (matches.length === 0) {
    return `<modules-search query="${escapeXml(query)}" count="0"><message>No exports found matching "${query}". Try a different search term or use action: "list" to see all modules.</message></modules-search>`;
  }

  const lines = [`<modules-search query="${escapeXml(query)}" count="${matches.length}">`];

  for (const match of matches) {
    lines.push(
      `  <result module="${escapeXml(match.module.name)}" import="${escapeXml(match.module.importPath)}">`,
    );
    lines.push(...formatExport(match.export).map((l) => `  ${l}`));
    lines.push('  </result>');
  }

  lines.push('</modules-search>');
  return lines.join('\n');
}

/**
 * Handle get action - get detailed info about a specific module
 */
function handleGet(projectPath: string, moduleName: string): string {
  const result = scanLibModules(projectPath);
  const mod = getModule(result, moduleName);

  if (!mod) {
    const available = result.modules.map((m) => m.name).join(', ');
    return `<modules-get module="${escapeXml(moduleName)}" status="not-found"><message>Module "${moduleName}" not found. Available modules: ${available}</message></modules-get>`;
  }

  const lines = [`<modules-get module="${escapeXml(mod.name)}" status="found">`];
  lines.push(`  <import>${escapeXml(mod.importPath)}</import>`);
  lines.push(`  <path>${escapeXml(mod.relativePath)}</path>`);

  if (mod.description) {
    lines.push(`  <description>${escapeXml(mod.description)}</description>`);
  }

  if (mod.example) {
    lines.push(`  <example><![CDATA[${mod.example}]]></example>`);
  }

  // Group exports by kind
  const functions = mod.exports.filter((e) => e.kind === 'function');
  const types = mod.exports.filter((e) => ['type', 'interface'].includes(e.kind));
  const enums = mod.exports.filter((e) => e.kind === 'enum');
  const classes = mod.exports.filter((e) => e.kind === 'class');
  const consts = mod.exports.filter((e) => e.kind === 'const');

  if (functions.length > 0) {
    lines.push(`  <functions count="${functions.length}">`);
    for (const fn of functions) {
      lines.push(...formatExport(fn).map((l) => `  ${l}`));
    }
    lines.push('  </functions>');
  }

  if (types.length > 0) {
    lines.push(`  <types count="${types.length}">`);
    for (const t of types) {
      lines.push(`    <type name="${escapeXml(t.name)}" kind="${t.kind}"/>`);
    }
    lines.push('  </types>');
  }

  if (enums.length > 0) {
    lines.push(`  <enums count="${enums.length}">`);
    for (const e of enums) {
      lines.push(`    <enum name="${escapeXml(e.name)}"/>`);
    }
    lines.push('  </enums>');
  }

  if (classes.length > 0) {
    lines.push(`  <classes count="${classes.length}">`);
    for (const c of classes) {
      lines.push(`    <class name="${escapeXml(c.name)}"/>`);
    }
    lines.push('  </classes>');
  }

  if (consts.length > 0) {
    lines.push(`  <consts count="${consts.length}">`);
    for (const c of consts) {
      lines.push(`    <const name="${escapeXml(c.name)}"/>`);
    }
    lines.push('  </consts>');
  }

  lines.push('</modules-get>');
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

Examples:
- List all: { action: "list" }
- Search: { action: "search", query: "parse" }
- Get module: { action: "get", module: "fs" }`,

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
    };

    // Use consistent error handling wrapper
    return withErrorHandler('modules', action, () => {
      switch (action) {
        case 'list':
          return handleList(projectPath);
        case 'search':
          return handleSearch(projectPath, modulesArgs.query as string);
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
