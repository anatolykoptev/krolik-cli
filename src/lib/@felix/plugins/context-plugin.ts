/**
 * ContextPlugin - Inject project context before model execution
 *
 * Injects schema, routes, and memories into LLM request.
 * Uses krolik tools to gather relevant context for the task.
 *
 * @module @felix/plugins/context-plugin
 */

import type { CallbackContext, LlmRequest, LlmResponse } from '@google/adk';
import { BasePlugin } from '@google/adk';
import type { TrpcRouter } from '@/commands/routes';

export interface ContextPluginConfig {
  projectRoot: string;
  includeSchema?: boolean;
  includeRoutes?: boolean;
  includeMemories?: boolean;
  maxContextTokens?: number;
}

export interface InjectedContext {
  schema?: string;
  routes?: string;
  memories?: string;
  timestamp: number;
}

export class ContextPlugin extends BasePlugin {
  private config: Required<ContextPluginConfig>;
  private contextCache: Map<string, InjectedContext> = new Map();
  private cacheMaxAge = 300_000; // 5 minutes

  constructor(config: ContextPluginConfig) {
    super('context');
    this.config = {
      includeSchema: true,
      includeRoutes: true,
      includeMemories: true,
      maxContextTokens: 4000,
      ...config,
    };
  }

  /**
   * Before model call, inject relevant context into LLM request
   */
  override async beforeModelCallback({
    callbackContext,
    llmRequest,
  }: {
    callbackContext: CallbackContext;
    llmRequest: LlmRequest;
  }): Promise<LlmResponse | undefined> {
    const agentName = callbackContext.invocationContext.agent.name;
    const cachedContext = this.getCachedContext(agentName);

    let context: InjectedContext;
    if (cachedContext && !this.isStale(cachedContext)) {
      context = cachedContext;
    } else {
      context = await this.gatherContext(agentName);
      this.contextCache.set(agentName, context);
    }

    // Inject context into system instruction
    const contextMessage = this.formatContext(context);
    if (contextMessage) {
      this.injectIntoRequest(llmRequest, contextMessage);
    }

    // Store in state for other plugins
    callbackContext.eventActions.stateDelta['__context'] = {
      injected: true,
      hasSchema: !!context.schema,
      hasRoutes: !!context.routes,
      hasMemories: !!context.memories,
    };

    return undefined; // Don't modify the response
  }

  /**
   * Gather context from project
   */
  private async gatherContext(agentName: string): Promise<InjectedContext> {
    const context: InjectedContext = { timestamp: Date.now() };

    try {
      if (this.config.includeSchema) {
        const schema = await this.getSchemaContext();
        if (schema !== undefined) {
          context.schema = schema;
        }
      }
      if (this.config.includeRoutes) {
        const routes = await this.getRoutesContext();
        if (routes !== undefined) {
          context.routes = routes;
        }
      }
      if (this.config.includeMemories) {
        const memories = await this.getMemoriesContext(agentName);
        if (memories !== undefined) {
          context.memories = memories;
        }
      }
    } catch {
      // Silently fail - context injection is optional
    }

    return context;
  }

  /**
   * Get database schema context (compact format)
   */
  private async getSchemaContext(): Promise<string | undefined> {
    try {
      const { analyzeSchema } = await import('@/commands/schema');
      const fs = await import('node:fs');
      const path = await import('node:path');

      const schemaDir = this.findSchemaDir(this.config.projectRoot, fs, path);
      if (!schemaDir) return undefined;

      const result = analyzeSchema(schemaDir);
      // Return compact model list
      return result.models.map((m) => `${m.name}: ${m.fields.length} fields`).join('\n');
    } catch {
      return undefined;
    }
  }

  /**
   * Find prisma schema directory (inline implementation)
   */
  private findSchemaDir(
    projectRoot: string,
    fs: typeof import('node:fs'),
    path: typeof import('node:path'),
  ): string | null {
    const candidates = ['packages/db/prisma', 'prisma', 'src/prisma', 'db/prisma'];

    for (const candidate of candidates) {
      const fullPath = path.join(projectRoot, candidate);
      if (fs.existsSync(fullPath)) return fullPath;
    }

    return null;
  }

  /**
   * Get API routes context (compact format)
   */
  private async getRoutesContext(): Promise<string | undefined> {
    try {
      const { analyzeRoutes } = await import('@/commands/routes');
      const fs = await import('node:fs');
      const path = await import('node:path');

      const routersDir = this.findRoutersDir(this.config.projectRoot, fs, path);
      if (!routersDir) return undefined;

      const result = analyzeRoutes(routersDir);
      if (!result || result.routers.length === 0) return undefined;

      // Return compact router list
      return result.routers
        .map((r: TrpcRouter) => `${r.name}: ${r.procedures.length} procedures`)
        .join('\n');
    } catch {
      return undefined;
    }
  }

  /**
   * Find tRPC routers directory (inline implementation)
   */
  private findRoutersDir(
    projectRoot: string,
    fs: typeof import('node:fs'),
    path: typeof import('node:path'),
  ): string | null {
    const candidates = [
      'packages/api/src/routers',
      'src/server/routers',
      'src/routers',
      'server/routers',
      'src/trpc/routers',
    ];

    for (const candidate of candidates) {
      const fullPath = path.join(projectRoot, candidate);
      if (fs.existsSync(fullPath)) return fullPath;
    }

    return null;
  }

  /**
   * Get relevant memories for the agent/task
   */
  private async getMemoriesContext(agentName: string): Promise<string | undefined> {
    try {
      const { search } = await import('@/lib/@storage/memory');
      const memories = search({ query: agentName, limit: 5 });

      if (!memories || memories.length === 0) return undefined;

      return memories
        .map((m) => `- [${m.memory.type}] ${m.memory.title}: ${m.memory.description}`)
        .join('\n');
    } catch {
      return undefined;
    }
  }

  /**
   * Format gathered context into a message
   */
  private formatContext(context: InjectedContext): string | undefined {
    const sections: string[] = [];

    if (context.schema) {
      sections.push(`<schema>\n${this.truncate(context.schema, 1500)}\n</schema>`);
    }

    if (context.routes) {
      sections.push(`<routes>\n${this.truncate(context.routes, 1500)}\n</routes>`);
    }

    if (context.memories) {
      sections.push(`<relevant-memories>\n${context.memories}\n</relevant-memories>`);
    }

    if (sections.length === 0) return undefined;

    return `
## Project Context (auto-injected)

${sections.join('\n\n')}
`.trim();
  }

  /**
   * Inject context message into LLM request
   */
  private injectIntoRequest(request: LlmRequest, contextMessage: string): void {
    // Add as system message at the beginning
    request.contents.unshift({
      role: 'user',
      parts: [{ text: contextMessage }],
    });
  }

  /**
   * Get cached context for agent
   */
  private getCachedContext(agentName: string): InjectedContext | undefined {
    return this.contextCache.get(agentName);
  }

  /**
   * Check if cached context is stale
   */
  private isStale(context: InjectedContext): boolean {
    return Date.now() - context.timestamp > this.cacheMaxAge;
  }

  /**
   * Truncate text to max length
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}\n...[truncated]`;
  }

  /**
   * Clear context cache
   */
  clearCache(): void {
    this.contextCache.clear();
  }
}

/**
 * Create a context plugin with default configuration
 */
export function createContextPlugin(projectRoot: string): ContextPlugin {
  return new ContextPlugin({ projectRoot });
}
