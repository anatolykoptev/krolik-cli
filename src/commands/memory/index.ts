/**
 * @module commands/memory
 * @description Memory management command - save, search, recent
 */

import * as path from 'node:path';
import {
  type Memory,
  type MemoryImportance,
  type MemorySaveOptions,
  type MemorySearchOptions,
  type MemorySearchResult,
  type MemoryType,
  recent,
  save,
  search,
  stats,
} from '@/lib/@storage/memory';
import { getCurrentBranch, getRecentCommits } from '../../lib/@vcs';
import type { CommandContext, OutputFormat } from '../../types/commands/base';

/**
 * Memory save options
 */
export interface MemSaveOptions {
  type: MemoryType;
  title: string;
  description: string;
  importance?: MemoryImportance;
  tags?: string;
  files?: string;
  features?: string;
  format?: OutputFormat;
}

/**
 * Memory search options
 */
export interface MemSearchOptions {
  query?: string;
  type?: MemoryType;
  importance?: MemoryImportance;
  tags?: string;
  features?: string;
  project?: string;
  limit?: number;
  format?: OutputFormat;
}

/**
 * Memory recent options
 */
export interface MemRecentOptions {
  limit?: number;
  type?: MemoryType;
  format?: OutputFormat;
}

/**
 * Parse comma-separated string to array
 */
function parseList(value?: string): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Format memory as XML
 */
function formatMemoryXml(memory: Memory): string {
  const tags = memory.tags.length > 0 ? `\n    <tags>${memory.tags.join(', ')}</tags>` : '';
  const files = memory.files?.length ? `\n    <files>${memory.files.join(', ')}</files>` : '';
  const features = memory.features?.length
    ? `\n    <features>${memory.features.join(', ')}</features>`
    : '';

  return `  <memory id="${memory.id}" type="${memory.type}" importance="${memory.importance}">
    <title>${memory.title}</title>
    <description>${memory.description}</description>
    <project>${memory.project}</project>
    <created>${memory.createdAt}</created>${tags}${files}${features}
  </memory>`;
}

/**
 * Format search result as XML
 */
function formatSearchResultXml(result: MemorySearchResult): string {
  const memory = result.memory;
  const relevance = result.relevance > 0 ? ` relevance="${result.relevance}"` : '';
  const tags = memory.tags.length > 0 ? `\n    <tags>${memory.tags.join(', ')}</tags>` : '';
  const files = memory.files?.length ? `\n    <files>${memory.files.join(', ')}</files>` : '';
  const features = memory.features?.length
    ? `\n    <features>${memory.features.join(', ')}</features>`
    : '';

  return `  <memory id="${memory.id}" type="${memory.type}" importance="${memory.importance}"${relevance}>
    <title>${memory.title}</title>
    <description>${memory.description}</description>
    <project>${memory.project}</project>
    <created>${memory.createdAt}</created>${tags}${files}${features}
  </memory>`;
}

/**
 * Run memory save command
 */
export async function runMemSave(ctx: CommandContext & { options: MemSaveOptions }): Promise<void> {
  const { config, options } = ctx;
  const projectName = path.basename(config.projectRoot);

  // Get git context
  const branch = getCurrentBranch(config.projectRoot);
  const commits = getRecentCommits(1, config.projectRoot);
  const commit = commits[0]?.hash;

  const saveOptions: MemorySaveOptions = {
    type: options.type,
    title: options.title,
    description: options.description,
    importance: options.importance,
    tags: parseList(options.tags),
    files: parseList(options.files),
    features: parseList(options.features),
  };

  const memory = await save(saveOptions, {
    project: projectName,
    branch: branch || undefined,
    commit: commit || undefined,
  });

  const format = options.format ?? 'ai';

  if (format === 'json') {
    console.log(JSON.stringify(memory, null, 2));
    return;
  }

  // AI-friendly XML format
  console.log(`<memory-saved>
${formatMemoryXml(memory)}
</memory-saved>`);
}

/**
 * Run memory search command
 */
export async function runMemSearch(
  ctx: CommandContext & { options: MemSearchOptions },
): Promise<void> {
  const { config, options } = ctx;
  const projectName = path.basename(config.projectRoot);

  const searchOptions: MemorySearchOptions = {
    query: options.query,
    type: options.type,
    importance: options.importance,
    project: options.project ?? projectName,
    tags: parseList(options.tags),
    features: parseList(options.features),
    limit: options.limit ?? 10,
  };

  const results = search(searchOptions);

  const format = options.format ?? 'ai';

  if (format === 'json') {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log(
      '<memory-search>\n  <result count="0">No memories found</result>\n</memory-search>',
    );
    return;
  }

  const memoriesXml = results.map(formatSearchResultXml).join('\n');
  console.log(`<memory-search count="${results.length}">
${memoriesXml}
</memory-search>`);
}

/**
 * Run memory recent command
 */
export async function runMemRecent(
  ctx: CommandContext & { options: MemRecentOptions },
): Promise<void> {
  const { config, options } = ctx;
  const projectName = path.basename(config.projectRoot);

  const memories = recent(projectName, options.limit ?? 10, options.type);

  const format = options.format ?? 'ai';

  if (format === 'json') {
    console.log(JSON.stringify(memories, null, 2));
    return;
  }

  if (memories.length === 0) {
    console.log(
      '<memory-recent>\n  <result count="0">No memories found</result>\n</memory-recent>',
    );
    return;
  }

  const memoriesXml = memories.map(formatMemoryXml).join('\n');
  console.log(`<memory-recent count="${memories.length}">
${memoriesXml}
</memory-recent>`);
}

/**
 * Run memory stats command
 */
export async function runMemStats(
  ctx: CommandContext & { options: { format?: OutputFormat } },
): Promise<void> {
  const { config, options } = ctx;
  const projectName = path.basename(config.projectRoot);

  const memStats = stats(projectName);

  const format = options.format ?? 'ai';

  if (format === 'json') {
    console.log(JSON.stringify(memStats, null, 2));
    return;
  }

  console.log(`<memory-stats project="${projectName}">
  <total>${memStats.total}</total>
  <by-type>
    <observation>${memStats.byType.observation}</observation>
    <decision>${memStats.byType.decision}</decision>
    <pattern>${memStats.byType.pattern}</pattern>
    <bugfix>${memStats.byType.bugfix}</bugfix>
    <feature>${memStats.byType.feature}</feature>
  </by-type>
  <by-importance>
    <low>${memStats.byImportance.low}</low>
    <medium>${memStats.byImportance.medium}</medium>
    <high>${memStats.byImportance.high}</high>
    <critical>${memStats.byImportance.critical}</critical>
  </by-importance>
</memory-stats>`);
}
