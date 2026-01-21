/**
 * @module commands/memory
 * @description Memory management command - save, search, recent
 */

import * as path from 'node:path';
import * as readline from 'node:readline';
import {
  getProjects,
  hybridSearch,
  isGlobalType,
  type Memory,
  type MemoryImportance,
  type MemorySaveOptions,
  type MemorySearchOptions,
  type MemorySearchResult,
  type MemoryType,
  recent,
  save,
  saveGlobal,
  search,
  stats,
} from '@/lib/@storage/memory';
import { releaseEmbeddingPool } from '@/lib/@storage/memory/embedding-pool';
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
  project?: string;
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
 * Interactive project selection
 * Shows options: global, existing projects, or create new
 */
async function selectProject(currentProject: string): Promise<string> {
  const existingProjects = getProjects();

  // Build options list
  const options: string[] = [];
  options.push('1. Global (shared across all projects)');

  // Add current project if it exists
  if (currentProject && !existingProjects.includes(currentProject)) {
    options.push(`2. ${currentProject} (current directory - NEW)`);
  } else if (currentProject) {
    options.push(`2. ${currentProject} (current directory)`);
  }

  // Add existing projects
  let optionNum = 3;
  const projectMap = new Map<number, string>();
  projectMap.set(1, '__global__');
  projectMap.set(2, currentProject);

  for (const proj of existingProjects) {
    if (proj !== currentProject && proj !== '__global__') {
      options.push(`${optionNum}. ${proj}`);
      projectMap.set(optionNum, proj);
      optionNum++;
    }
  }

  options.push(`${optionNum}. Create new project...`);
  const createNewOption = optionNum;

  // Display options
  console.log('\n📁 Select project to save memory:');
  console.log(options.join('\n'));

  // Read user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\nEnter option number: ', (answer) => {
      rl.close();
      const choice = parseInt(answer.trim(), 10);

      if (choice === 1) {
        resolve('__global__');
      } else if (choice === createNewOption) {
        // Ask for new project name
        const rl2 = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl2.question('Enter new project name: ', (name) => {
          rl2.close();
          resolve(name.trim() || currentProject);
        });
      } else if (projectMap.has(choice)) {
        resolve(projectMap.get(choice)!);
      } else {
        // Default to current project
        resolve(currentProject);
      }
    });
  });
}

/**
 * Run memory save command
 */
export async function runMemSave(ctx: CommandContext & { options: MemSaveOptions }): Promise<void> {
  try {
    const { config, options } = ctx;

    let memory: Memory;

    // Global memory types (pattern, library, snippet, anti-pattern) - use saveGlobal
    if (isGlobalType(options.type)) {
      memory = await saveGlobal({
        type: options.type,
        title: options.title,
        description: options.description,
        importance: options.importance,
        tags: parseList(options.tags),
      });
    } else {
      // Project memory types (observation, decision, bugfix, feature) - use save
      const currentProject = path.basename(config.projectRoot);

      // Determine target project
      let projectName: string;

      // If --project was explicitly provided, use it
      if (options.project) {
        projectName = options.project;
      } else if (process.stdin.isTTY) {
        // Interactive mode - ask user to select project
        projectName = await selectProject(currentProject);
      } else {
        // Non-interactive mode - use current project
        projectName = currentProject;
      }

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

      memory = await save(saveOptions, {
        project: projectName,
        branch: branch || undefined,
        commit: commit || undefined,
      });
    }

    const format = options.format ?? 'ai';

    if (format === 'json') {
      console.log(JSON.stringify(memory, null, 2));
      return;
    }

    // AI-friendly XML format
    console.log(`<memory-saved>
${formatMemoryXml(memory)}
</memory-saved>`);
  } finally {
    // Release embedding worker to prevent hanging
    await releaseEmbeddingPool();
  }
}

/**
 * Run memory search command
 */
export async function runMemSearch(
  ctx: CommandContext & { options: MemSearchOptions },
): Promise<void> {
  try {
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

    // Use hybrid search (BM25 + semantic) if query provided, fallback to regular search
    const results = options.query
      ? await hybridSearch(options.query, searchOptions)
      : search(searchOptions);

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
  } finally {
    // Release embedding worker to prevent hanging
    await releaseEmbeddingPool();
  }
}

/**
 * Run memory recent command
 */
export async function runMemRecent(
  ctx: CommandContext & { options: MemRecentOptions },
): Promise<void> {
  try {
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
  } finally {
    // Release embedding worker to prevent hanging
    await releaseEmbeddingPool();
  }
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
