/**
 * @module lib/claude/sections/providers/recent-memories
 * @description Recent memories section provider
 *
 * Auto-injects recent high-importance memories for the project.
 * Displays decisions, patterns, and other important context.
 */

import { basename } from 'node:path';
import type { Memory, MemoryImportance } from '@/lib/storage/memory';
import { recent } from '@/lib/storage/memory';
import type { SectionContext, SectionProvider, SectionResult } from '../types';

/** Priority for recent memories section (after session startup, before context cache) */
const RECENT_MEMORIES_PRIORITY = 150;

/** Number of memories to display */
const MEMORY_LIMIT = 10;

/** High importance levels to prioritize */
const HIGH_IMPORTANCE: MemoryImportance[] = ['high', 'critical'];

/**
 * Truncate description to reasonable length
 */
function truncateDescription(description: string, maxLength = 60): string {
  if (description.length <= maxLength) {
    return description;
  }
  return `${description.slice(0, maxLength - 3)}...`;
}

/**
 * Format memory type for display
 */
function formatType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Sort memories by importance and recency
 */
function sortByImportance(memories: Memory[]): Memory[] {
  const importanceOrder: Record<MemoryImportance, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...memories].sort((a, b) => {
    const aOrder = importanceOrder[a.importance];
    const bOrder = importanceOrder[b.importance];
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    // If same importance, sort by date (newer first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Render recent memories as markdown table
 */
function renderRecentMemories(ctx: SectionContext): string {
  const projectName = basename(ctx.projectRoot);

  // Get recent memories for the project
  // First try to get high-importance ones, then fill with others
  const allRecent = recent(projectName, MEMORY_LIMIT * 2);

  if (allRecent.length === 0) {
    return '';
  }

  // Prioritize high-importance memories
  const highImportance = allRecent.filter((m) => HIGH_IMPORTANCE.includes(m.importance));
  const otherMemories = allRecent.filter((m) => !HIGH_IMPORTANCE.includes(m.importance));

  // Take high importance first, then fill with others
  const sorted = sortByImportance([...highImportance, ...otherMemories]);
  const displayMemories = sorted.slice(0, MEMORY_LIMIT);

  if (displayMemories.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('### Recent Decisions & Patterns');
  lines.push('');
  lines.push('| Type | Title | Description |');
  lines.push('|------|-------|-------------|');

  for (const memory of displayMemories) {
    const type = formatType(memory.type);
    const title = memory.title;
    const desc = truncateDescription(memory.description);
    lines.push(`| ${type} | ${title} | ${desc} |`);
  }

  return lines.join('\n');
}

/**
 * Recent memories section provider
 *
 * Priority 150 - renders after session startup, before context cache
 */
export const recentMemoriesProvider: SectionProvider = {
  id: 'recent-memories',
  name: 'Recent Memories',
  priority: RECENT_MEMORIES_PRIORITY,

  render(ctx: SectionContext): SectionResult {
    try {
      const content = renderRecentMemories(ctx);

      return {
        content,
        skip: content === '',
      };
    } catch {
      // If memory system is not available, skip silently
      return {
        content: '',
        skip: true,
      };
    }
  },
};
