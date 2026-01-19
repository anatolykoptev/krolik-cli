/**
 * @module lib/@felix/context/injector
 * @description Context injector for Krolik Felix
 *
 * Pre-runs krolik tools and collects context BEFORE sending to AI.
 * This is the "Context-First" approach - don't wait for AI to request context.
 */

import { analyzeRoutes } from '@/commands/routes';
import { analyzeSchema } from '@/commands/schema';
import { loadContextMemories } from '@/lib/@context/memory';
import type { PRDTask } from '../schemas';
import { detectTaskType } from './task-analyzer';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Injected context for a task
 */
export interface InjectedContext {
  /** Project schema (Prisma models) */
  schema?: string;

  /** API routes (tRPC procedures) */
  routes?: string;

  /** Relevant memories from previous sessions */
  memories?: string;

  /** Task-specific hints */
  hints?: string[];

  /** Discovered relevant files */
  files?: Array<{ path: string; description?: string }>;

  /** Generation metadata */
  meta: {
    generatedAt: string;
    sections: string[];
    durationMs: number;
  };
}

/**
 * Options for context injection
 */
export interface InjectContextOptions {
  /** Include schema analysis */
  includeSchema?: boolean;

  /** Include routes analysis */
  includeRoutes?: boolean;

  /** Include memory search */
  includeMemories?: boolean;

  /** Maximum memories to include */
  memoryLimit?: number;

  /** Path to schema directory (auto-detected if not provided) */
  schemaDir?: string;

  /** Path to routes directory (auto-detected if not provided) */
  routesDir?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Common schema directory locations */
const SCHEMA_DIR_CANDIDATES = ['packages/db/prisma', 'prisma', 'src/prisma', 'db/prisma'];

/** Common routes directory locations */
const ROUTES_DIR_CANDIDATES = [
  'packages/api/src/routers',
  'src/server/routers',
  'src/routers',
  'server/routers',
  'src/trpc/routers',
];

// ============================================================================
// HELPERS
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Find directory from candidates
 */
function findDirectory(
  projectRoot: string,
  candidates: string[],
  configPath?: string,
): string | null {
  // Check config path first
  if (configPath) {
    const fullPath = path.isAbsolute(configPath) ? configPath : path.join(projectRoot, configPath);
    if (fs.existsSync(fullPath)) return fullPath;
  }

  // Try candidates
  for (const candidate of candidates) {
    const fullPath = path.join(projectRoot, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }

  return null;
}

/**
 * Format schema output for AI consumption
 */
function formatSchemaForAI(schema: ReturnType<typeof analyzeSchema>): string {
  const lines: string[] = ['## Database Schema (Prisma)'];
  lines.push(`Models: ${schema.modelCount}, Enums: ${schema.enumCount}\n`);

  for (const model of schema.models) {
    lines.push(`### ${model.name}`);
    const fields = model.fields
      .filter((f) => !['id', 'createdAt', 'updatedAt'].includes(f.name))
      .map((f) => `  - ${f.name}: ${f.type}${f.isRequired ? '' : '?'}`)
      .join('\n');
    if (fields) lines.push(fields);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format routes output for AI consumption
 */
function formatRoutesForAI(routes: ReturnType<typeof analyzeRoutes>): string {
  const lines: string[] = ['## API Routes (tRPC)'];
  lines.push(`Routers: ${routes.routers.length}, Total: ${routes.queries}Q/${routes.mutations}M\n`);

  for (const router of routes.routers) {
    lines.push(`### ${router.name}`);
    const procs = router.procedures
      .map((p) => `  - ${p.name} (${p.type})${p.isProtected ? ' [protected]' : ''}`)
      .join('\n');
    if (procs) lines.push(procs);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format memories for AI consumption
 */
function formatMemoriesForAI(
  memories: Array<{
    memory: { title: string; description: string; type: string };
    relevance: number;
  }>,
): string {
  if (memories.length === 0) return '';

  const lines: string[] = ['## Relevant Memories'];

  for (const { memory, relevance } of memories) {
    lines.push(`### ${memory.title} (${memory.type}, relevance: ${Math.round(relevance * 100)}%)`);
    lines.push(memory.description);
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Inject context for a task
 *
 * Collects relevant context from krolik tools:
 * - Database schema (Prisma)
 * - API routes (tRPC)
 * - Relevant memories
 *
 * @param task - PRD task to get context for
 * @param projectRoot - Project root directory
 * @param options - Injection options
 * @returns Injected context
 */
export async function injectContext(
  task: PRDTask,
  projectRoot: string,
  options: InjectContextOptions = {},
): Promise<InjectedContext> {
  const startTime = Date.now();
  const sections: string[] = [];

  const result: InjectedContext = {
    meta: {
      generatedAt: new Date().toISOString(),
      sections: [],
      durationMs: 0,
    },
  };

  // Build search query from task
  const searchQuery = `${task.title} ${task.description}`;

  // Collect context in parallel where possible
  const promises: Promise<void>[] = [];

  // Schema
  promises.push(
    (async () => {
      const schemaDir = findDirectory(projectRoot, SCHEMA_DIR_CANDIDATES, options.schemaDir);
      if (schemaDir) {
        try {
          const schema = analyzeSchema(schemaDir);
          result.schema = formatSchemaForAI(schema);
          sections.push('schema');
        } catch {
          // Schema analysis failed, continue without it
        }
      }
    })(),
  );

  // Routes
  if (options.includeRoutes !== false) {
    promises.push(
      (async () => {
        const routesDir = findDirectory(projectRoot, ROUTES_DIR_CANDIDATES, options.routesDir);
        if (routesDir) {
          try {
            const routes = analyzeRoutes(routesDir);
            result.routes = formatRoutesForAI(routes);
            sections.push('routes');
          } catch {
            // Routes analysis failed, continue without it
          }
        }
      })(),
    );
  }

  // Memory search
  if (options.includeMemories !== false) {
    promises.push(
      (async () => {
        try {
          // Use smart shared memory loading
          const memories = loadContextMemories(
            projectRoot,
            searchQuery,
            undefined, // feature
            options.memoryLimit ?? 5,
          );

          if (memories.length > 0) {
            // Transform Memory[] to the format expected by formatMemoriesForAI
            // The existing formatMemoriesForAI expects { memory, relevance }
            // But loadContextMemories returns Memory[]
            // We'll mock relevance as 1.0 for now since smartSearch logic is internal
            const formattedMemories = memories.map((m) => ({
              memory: m,
              relevance: 1.0,
            }));

            result.memories = formatMemoriesForAI(formattedMemories);
            sections.push('memories');
          }
        } catch {
          // Memory search failed, continue without it
        }
      })(),
    );
  }

  // File discovery (Smart Code Search)
  // biome-ignore lint/correctness/noConstantCondition: It's intended to be always enabled.
  promises.push(
    (async () => {
      try {
        const { discoverContextFiles } = await import('@/lib/@context/discovery');

        // Extract keywords from task
        const keywords = [
          ...task.title.split(' ').filter((w) => w.length > 3),
          ...task.tags,
          ...(task.labels ?? []),
        ];

        const discoveredFiles = discoverContextFiles(projectRoot, keywords, { limit: 5 });

        if (discoveredFiles.length > 0) {
          // Add discovered files to result, ensuring no duplicates with files_affected
          const existingFiles = new Set([
            ...task.files_affected,
            ...(result.files?.map((f) => f.path) ?? []),
          ]);

          const newFiles = discoveredFiles
            .filter((f) => !existingFiles.has(f.path))
            .map((f) => ({
              path: f.path,
              description: `(Discovered: ${f.reason})`,
            }));

          if (newFiles.length > 0) {
            result.files = [...(result.files || []), ...newFiles];
            // We don't push to sections because 'files' section is always handled if result.files has content?
            // Actually injector logic usually assumes explicit files_affected are distinct from context
            // But let's append to the files list so `formatInjectedContext` picks them up
          }
        }
      } catch (e) {
        // Ignore discovery errors
      }
    })(),
  );

  // Wait for all context collection
  await Promise.all(promises);

  // Add hints based on task type
  result.hints = generateTaskHints(task);

  result.meta.sections = sections;
  result.meta.durationMs = Date.now() - startTime;

  return result;
}

/**
 * Generate hints based on task type
 */
function generateTaskHints(task: PRDTask): string[] {
  const hints: string[] = [];
  const taskType = detectTaskType(task);

  switch (taskType) {
    case 'feature':
      hints.push('Focus on implementing the new functionality');
      hints.push('Consider edge cases and error handling');
      break;
    case 'bugfix':
      hints.push('Identify the root cause before fixing');
      hints.push('Add tests to prevent regression');
      break;
    case 'refactor':
      hints.push('Ensure existing tests pass after changes');
      hints.push('Keep the refactoring focused, avoid scope creep');
      break;
    case 'test':
      hints.push('Cover both happy path and edge cases');
      hints.push('Use meaningful test descriptions');
      break;
    default:
      hints.push('Follow existing code patterns and conventions');
      break;
  }

  return hints;
}

/**
 * Format injected context as a single string
 */
export function formatInjectedContext(context: InjectedContext): string {
  const parts: string[] = [];

  if (context.schema) {
    parts.push(context.schema);
  }

  if (context.routes) {
    parts.push(context.routes);
  }

  if (context.files && context.files.length > 0) {
    parts.push(
      `<discovered-files>\n${context.files
        .map((f) => `  <file path="${f.path}">${f.description || ''}</file>`)
        .join('\n')}\n</discovered-files>`,
    );
  }

  if (context.memories) {
    parts.push(context.memories);
  }

  if (context.hints && context.hints.length > 0) {
    parts.push('## Hints');
    parts.push(context.hints.map((h) => `- ${h}`).join('\n'));
  }

  return parts.join('\n\n');
}
