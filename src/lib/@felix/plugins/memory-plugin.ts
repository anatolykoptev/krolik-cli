/**
 * MemoryPlugin - Auto-save decisions and bugfixes to memory
 *
 * Monitors agent output for decisions, patterns, and bugfixes.
 * Automatically saves them to krolik memory for future sessions.
 *
 * @module @felix/plugins/memory-plugin
 */

import type { BaseAgent, CallbackContext, Event } from '@google/adk';
import { BasePlugin } from '@google/adk';
import type { Content } from '@google/genai';

export type MemoryType = 'decision' | 'bugfix' | 'pattern' | 'observation';

export interface MemoryPluginConfig {
  projectRoot: string;
  autoSave?: boolean;
  types?: MemoryType[];
  minConfidence?: number;
}

export interface DetectedMemory {
  type: MemoryType;
  title: string;
  description: string;
  confidence: number;
  source: string;
}

// Patterns to detect memory-worthy content
const DETECTION_PATTERNS: Record<MemoryType, RegExp[]> = {
  decision: [
    /(?:decided|chose|selected|will use|going with)\s+(.+?)\s+(?:because|for|to)/i,
    /(?:decision|approach):\s*(.+)/i,
    /(?:using|implementing)\s+(.+?)\s+(?:pattern|approach|strategy)/i,
  ],
  bugfix: [
    /(?:fixed|resolved|patched)\s+(.+?)\s+(?:by|with|using)/i,
    /(?:bug|issue|problem):\s*(.+)/i,
    /(?:root cause|caused by):\s*(.+)/i,
  ],
  pattern: [
    /(?:pattern|convention|standard):\s*(.+)/i,
    /(?:always|never|should)\s+(.+?)\s+(?:when|for|in)/i,
    /(?:best practice|guideline):\s*(.+)/i,
  ],
  observation: [
    /(?:noticed|observed|found)\s+that\s+(.+)/i,
    /(?:note|important):\s*(.+)/i,
    /(?:remember|keep in mind):\s*(.+)/i,
  ],
};

export class MemoryPlugin extends BasePlugin {
  private config: Required<MemoryPluginConfig>;
  private pendingMemories: DetectedMemory[] = [];

  constructor(config: MemoryPluginConfig) {
    super('memory');
    this.config = {
      autoSave: true,
      types: ['decision', 'bugfix', 'pattern'],
      minConfidence: 0.7,
      ...config,
    };
  }

  /**
   * After agent completes, analyze output for memories
   */
  override async afterAgentCallback({
    agent: _agent,
    callbackContext,
  }: {
    agent: BaseAgent;
    callbackContext: CallbackContext;
  }): Promise<Content | undefined> {
    const agentName = callbackContext.invocationContext.agent.name;

    // Get recent events from session via invocationContext
    const session = callbackContext.invocationContext.session;
    const recentEvents = session?.events?.slice(-5) ?? [];

    // Analyze events for memory-worthy content
    for (const event of recentEvents) {
      const memories = this.analyzeEvent(event, agentName);
      this.pendingMemories.push(...memories);
    }

    // Filter by confidence
    const highConfidence = this.pendingMemories.filter(
      (m) => m.confidence >= this.config.minConfidence,
    );

    // Auto-save if enabled
    if (this.config.autoSave && highConfidence.length > 0) {
      await this.saveMemories(highConfidence);
    }

    // Store in state for reporting
    callbackContext.eventActions.stateDelta['__memory'] = {
      detected: this.pendingMemories.length,
      saved: highConfidence.length,
      types: highConfidence.map((m) => m.type),
    };

    // Clear pending
    this.pendingMemories = [];

    return undefined;
  }

  /**
   * Analyze an event for memory-worthy content
   */
  private analyzeEvent(event: Event, source: string): DetectedMemory[] {
    const memories: DetectedMemory[] = [];

    // Get text content from event
    const content = this.extractTextContent(event);
    if (!content) return memories;

    // Check each memory type
    for (const type of this.config.types) {
      const patterns = DETECTION_PATTERNS[type];

      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          const title = this.cleanTitle(match[1]);
          const confidence = this.calculateConfidence(content, type, match);

          memories.push({
            type,
            title,
            description: this.extractDescription(content, match),
            confidence,
            source,
          });
        }
      }
    }

    // Deduplicate by title
    return this.deduplicateMemories(memories);
  }

  /**
   * Extract text content from event
   */
  private extractTextContent(event: Event): string | undefined {
    if (!event.content?.parts) return undefined;

    return event.content.parts
      .map((p) => {
        if (typeof p === 'object' && 'text' in p) {
          return (p as { text: string }).text;
        }
        return '';
      })
      .join('\n');
  }

  /**
   * Clean up title text
   */
  private cleanTitle(raw: string): string {
    return raw.replace(/[`'"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 100);
  }

  /**
   * Extract description from context
   */
  private extractDescription(content: string, match: RegExpMatchArray): string {
    const start = Math.max(0, (match.index ?? 0) - 50);
    const end = Math.min(content.length, (match.index ?? 0) + match[0].length + 100);
    return content.slice(start, end).trim();
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(content: string, type: MemoryType, match: RegExpMatchArray): number {
    let confidence = 0.5;

    // Boost for explicit markers
    if (/(?:decision|bug|pattern|note):/i.test(content)) {
      confidence += 0.2;
    }

    // Boost for longer matches (more context)
    if (match[0].length > 50) {
      confidence += 0.1;
    }

    // Boost for technical content
    if (/(?:function|class|interface|type|const|let)/i.test(match[0])) {
      confidence += 0.1;
    }

    // Type-specific boosts
    if (type === 'bugfix' && /(?:fixed|resolved|root cause)/i.test(content)) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Deduplicate memories by title similarity
   */
  private deduplicateMemories(memories: DetectedMemory[]): DetectedMemory[] {
    const seen = new Set<string>();
    return memories.filter((m) => {
      const key = m.title.toLowerCase().slice(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Save memories to storage
   */
  private async saveMemories(memories: DetectedMemory[]): Promise<void> {
    try {
      const { save } = await import('@/lib/@storage/memory');

      const projectName = this.config.projectRoot.split('/').pop() ?? 'unknown';
      const context = { project: projectName };

      for (const memory of memories) {
        await save(
          {
            type: memory.type,
            title: memory.title,
            description: memory.description,
            importance: memory.confidence > 0.9 ? 'high' : 'medium',
            source: 'ai-generated',
          },
          context,
        );
      }
    } catch {
      // Silently fail - memory saving is optional
    }
  }

  /**
   * Get pending memories (for inspection)
   */
  getPendingMemories(): DetectedMemory[] {
    return [...this.pendingMemories];
  }
}

/**
 * Create a memory plugin
 */
export function createMemoryPlugin(projectRoot: string): MemoryPlugin {
  return new MemoryPlugin({ projectRoot });
}
