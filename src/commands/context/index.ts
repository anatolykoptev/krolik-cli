/**
 * @module commands/context
 * @description AI context generation command
 *
 * Refactored architecture:
 * - constants.ts: All paths and limits
 * - builders/: Context assembly (git-info)
 * - sections/: Data gathering (memory, library-docs, github, quality, parsers)
 * - modes/: Mode-specific logic (minimal, quick, deep)
 */

import { getIssue, getStatus, isGitRepo } from '@/lib/@vcs';
import { saveToKrolik } from '../../lib/@core/krolik-paths';
import type { CommandContext } from '../../types/commands/base';
import type { ContextResult } from '../../types/commands/context';
import type { KrolikConfig } from '../../types/config';
import { buildGitInfo } from './builders';
import { detectDomains, findRelatedFiles, generateChecklist, getApproaches } from './domains';
import { formatAiPrompt, formatJson, formatMarkdown, printContext } from './formatters';
import { collectLibModules, searchInProject } from './helpers';
import { buildDeepSections, buildMinimalSections, buildQuickSections } from './modes';
import { loadLibraryDocs, loadRelevantMemory, loadSkills } from './sections';
import { buildSmartContext } from './smart-context';
import type { AiContextData, ContextMode, ContextOptions } from './types';

/**
 * Generate task context
 */
export function generateContext(
  task: string,
  projectRoot: string,
  issueData?: { number: number; title: string; body: string; labels: string[] },
  config?: KrolikConfig,
): ContextResult {
  const searchText = issueData ? `${issueData.title} ${issueData.body}` : task;
  const domains = detectDomains(searchText, config);
  const relatedFiles = findRelatedFiles(domains, projectRoot);
  const approach = getApproaches(domains);

  const result: ContextResult = {
    task: issueData ? issueData.title : task,
    domains,
    relatedFiles,
    approach,
  };

  if (issueData) {
    result.issue = issueData;
  }

  return result;
}

/**
 * Run context command
 */
export async function runContext(ctx: CommandContext & { options: ContextOptions }): Promise<void> {
  const { config, logger, options } = ctx;
  const projectRoot = config.projectRoot ?? process.cwd();

  let task = options.feature || options.file || 'General development context';
  let issueData: ContextResult['issue'] | undefined;

  // Fetch issue if provided
  if (options.issue) {
    const issueNum = Number.parseInt(options.issue, 10);
    if (!Number.isNaN(issueNum)) {
      const issue = getIssue(issueNum, projectRoot);
      if (issue) {
        issueData = {
          number: issue.number,
          title: issue.title,
          body: issue.body,
          labels: issue.labels,
        };
        task = issue.title;
      } else {
        logger.warn(`Could not fetch issue #${issueNum}. Check gh auth status.`);
        task = `Issue #${issueNum}`;
      }
    }
  }

  const result = generateContext(task, projectRoot, issueData, config);

  // Handle --changed-only
  if (options.changedOnly && isGitRepo(projectRoot)) {
    const status = getStatus(projectRoot);
    const changedFiles = [
      ...status.modified,
      ...status.staged.filter((f) => !status.modified.includes(f)),
      ...status.untracked,
    ];
    if (changedFiles.length > 0) {
      result.relatedFiles = changedFiles;
      result.domains = ['changed-files'];
    } else {
      logger.info('No changed files found in git status.');
    }
  }

  const format = options.format ?? 'ai';

  // Non-AI formats
  if (format === 'json') {
    console.log(formatJson(result));
    return;
  }
  if (format === 'markdown') {
    console.log(formatMarkdown(result));
    return;
  }
  if (format === 'text') {
    printContext(result, logger, options.verbose);
    return;
  }

  // Default: AI-ready structured output
  const aiData = await buildAiContextData(result, config, options);
  const xmlOutput = formatAiPrompt(aiData);
  saveToKrolik('CONTEXT.xml', xmlOutput, { projectRoot });
  console.log(xmlOutput);
}

/**
 * Build AI context data with mode-specific sections
 */
async function buildAiContextData(
  result: ContextResult,
  config: KrolikConfig,
  options: ContextOptions,
): Promise<AiContextData> {
  const projectRoot = config.projectRoot ?? process.cwd();
  const isMinimalMode = options.minimal === true;
  const isQuickMode = options.quick === true;
  const isDeepMode = options.deep === true;

  const mode: ContextMode = isMinimalMode
    ? 'minimal'
    : isQuickMode
      ? 'quick'
      : isDeepMode
        ? 'deep'
        : 'full';

  const aiData: AiContextData = {
    mode,
    generatedAt: new Date().toISOString(),
    context: result,
    config,
    checklist: generateChecklist(result.domains),
  };

  // Smart context (repo-map) - ALL modes
  try {
    aiData.repoMap = await buildSmartContext(projectRoot, result.domains, options);
  } catch (error) {
    if (process.env.DEBUG) console.error('[context] Smart context failed:', error);
  }

  // Git information - ALL modes
  if (isGitRepo(projectRoot)) {
    aiData.git = buildGitInfo(projectRoot);
  }

  // Search results (--search option)
  if (options.search) {
    const searchResults = searchInProject(projectRoot, options.search);
    if (searchResults) {
      aiData.searchResults = searchResults;
    }
  }

  // Mode-specific building
  if (isMinimalMode) {
    buildMinimalSections(aiData, result, projectRoot);
    return aiData;
  }

  if (!isDeepMode) {
    await buildQuickSections(aiData, result, projectRoot, options);
  }

  // Lib modules (non-minimal modes)
  const libModules = collectLibModules(projectRoot);
  if (libModules) aiData.libModules = libModules;

  // Memory & docs (non-minimal modes)
  aiData.memories = loadRelevantMemory(projectRoot, result.domains);
  aiData.libraryDocs = await loadLibraryDocs(projectRoot, result.domains);
  aiData.skills = loadSkills(projectRoot, result.domains);

  if (isQuickMode) return aiData;

  // Deep/Full mode
  await buildDeepSections(aiData, result, projectRoot, options);

  return aiData;
}

// Re-exports
export { detectDomains, findRelatedFiles, generateChecklist, getApproaches } from './domains';
export type { ContextOptions } from './types';
