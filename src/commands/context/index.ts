/**
 * @module commands/context
 * @description AI context generation command
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getCurrentBranch,
  getDiff,
  getIssue,
  getRecentCommits,
  getStatus,
  isGitRepo,
} from '../../lib';
import type { CommandContext, ContextResult, KrolikConfig } from '../../types';
import { analyzeRoutes } from '../routes';
import { analyzeSchema } from '../schema';
import { detectDomains, findRelatedFiles, generateChecklist, getApproaches } from './domains';
import { formatAiPrompt, formatJson, formatMarkdown, printContext } from './formatters';
import {
  DOMAIN_FILE_PATTERNS,
  discoverFiles,
  findRoutersDir,
  findSchemaDir,
  generateProjectTree,
} from './helpers';
import {
  buildImportGraph,
  generateContextHints,
  parseComponents,
  parseTestFiles,
  parseTypesInDir,
  parseZodSchemas,
} from './parsers';
import type { AiContextData, ContextOptions, GitContextInfo } from './types';

const MAX_COMMITS = 5;

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
  const format = options.format ?? 'ai';

  // JSON output
  if (format === 'json') {
    console.log(formatJson(result));
    return;
  }

  // Markdown output
  if (format === 'markdown') {
    console.log(formatMarkdown(result));
    return;
  }

  // Human-readable text output
  if (format === 'text') {
    printContext(result, logger, options.verbose);
    return;
  }

  // Default: AI-ready structured output
  const aiData = await buildAiContextData(result, config, options);
  console.log(formatAiPrompt(aiData));
}

/**
 * Build AI context data with all enhanced sections
 */
async function buildAiContextData(
  result: ContextResult,
  config: KrolikConfig,
  options: ContextOptions,
): Promise<AiContextData> {
  // projectRoot is guaranteed to exist at this point
  const projectRoot = config.projectRoot ?? process.cwd();

  const aiData: AiContextData = {
    context: result,
    config,
    checklist: generateChecklist(result.domains),
  };

  // Schema analysis
  const schemaDir = findSchemaDir(projectRoot);
  if (schemaDir) {
    try {
      aiData.schema = analyzeSchema(schemaDir);
    } catch {
      // Schema analysis failed, continue without
    }
  }

  // Routes analysis
  const routersDir = findRoutersDir(projectRoot);
  if (routersDir) {
    try {
      aiData.routes = analyzeRoutes(routersDir);
    } catch {
      // Routes analysis failed, continue without
    }
  }

  // Discover related files
  aiData.files = discoverFiles(projectRoot, result.domains);

  // Collect domain patterns
  const domainPatterns = result.domains.flatMap((d) => {
    const patterns = DOMAIN_FILE_PATTERNS[d.toLowerCase()];
    return patterns ? patterns.zod : [d.toLowerCase()];
  });

  // Parse Zod schemas
  parseZodSchemasFromDirs(projectRoot, domainPatterns, aiData);

  // Parse components
  parseComponentsFromDirs(projectRoot, result.domains, aiData);

  // Parse tests
  parseTestsFromDirs(projectRoot, result.domains, aiData);

  // Parse TypeScript types and imports
  parseTypesAndImports(projectRoot, result.domains, aiData);

  // Generate hints
  aiData.hints = generateContextHints(result.domains);

  // Git information
  if (isGitRepo(projectRoot)) {
    aiData.git = buildGitInfo(projectRoot);
  }

  // Project tree
  aiData.tree = generateProjectTree(projectRoot);

  // Quality issues (--with-audit)
  if (options.withAudit) {
    await addQualityIssues(projectRoot, result.relatedFiles, aiData);
  }

  return aiData;
}

/**
 * Parse Zod schemas from standard directories
 */
function parseZodSchemasFromDirs(
  projectRoot: string,
  patterns: string[],
  aiData: AiContextData,
): void {
  const zodDirs = [
    'packages/shared/src/schemas',
    'packages/shared/src/validation',
    'packages/db/src/schemas',
    'packages/api/src/lib',
    'src/schemas',
    'src/lib/schemas',
  ];

  for (const dir of zodDirs) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      const schemas = parseZodSchemas(fullPath, patterns);
      if (schemas.length > 0) {
        aiData.ioSchemas = [...(aiData.ioSchemas || []), ...schemas];
      }
    }
  }
}

/**
 * Parse components from standard directories
 */
function parseComponentsFromDirs(
  projectRoot: string,
  domains: string[],
  aiData: AiContextData,
): void {
  const componentPatterns = domains.flatMap((d) => {
    const patterns = DOMAIN_FILE_PATTERNS[d.toLowerCase()];
    return patterns ? patterns.components : [d];
  });

  const componentDirs = ['apps/web/components', 'src/components'];
  for (const dir of componentDirs) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      const components = parseComponents(fullPath, componentPatterns);
      if (components.length > 0) {
        aiData.componentDetails = [...(aiData.componentDetails || []), ...components];
      }
    }
  }
}

/**
 * Parse tests from standard directories
 */
function parseTestsFromDirs(projectRoot: string, domains: string[], aiData: AiContextData): void {
  const testPatterns = domains.flatMap((d) => {
    const patterns = DOMAIN_FILE_PATTERNS[d.toLowerCase()];
    return patterns ? patterns.tests : [d.toLowerCase()];
  });

  const testDirs = [
    'packages/api/src/routers/__tests__',
    'apps/web/__tests__',
    '__tests__',
    'tests',
  ];

  for (const dir of testDirs) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      const tests = parseTestFiles(fullPath, testPatterns);
      if (tests.length > 0) {
        aiData.testDetails = [...(aiData.testDetails || []), ...tests];
      }
    }
  }
}

/**
 * Parse TypeScript types and import graph
 */
function parseTypesAndImports(projectRoot: string, domains: string[], aiData: AiContextData): void {
  // Filter out generic domains that won't match file names
  const GENERIC_DOMAINS = ['general', 'development', 'context', 'feature'];
  const typePatterns = domains
    .map((d) => d.toLowerCase())
    .filter((d) => !GENERIC_DOMAINS.some((g) => d.includes(g)));

  // Directories to scan for types
  const typeDirs = [
    'packages/shared/src/types',
    'packages/api/src/types',
    'apps/web/types',
    'src/types',
    'types',
  ];

  for (const dir of typeDirs) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      const types = parseTypesInDir(fullPath, typePatterns);
      if (types.length > 0) {
        aiData.types = [...(aiData.types || []), ...types];
      }
    }
  }

  // Build import graph for domain-related files
  const importDirs = ['packages/api/src/routers', 'apps/web/components', 'src/commands'];

  for (const dir of importDirs) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      const imports = buildImportGraph(fullPath, typePatterns);
      if (imports.length > 0) {
        aiData.imports = [...(aiData.imports || []), ...imports];
      }
    }
  }
}

/**
 * Build git context info
 */
function buildGitInfo(projectRoot: string): GitContextInfo {
  const branch = getCurrentBranch(projectRoot);
  const status = getStatus(projectRoot);
  const commits = getRecentCommits(MAX_COMMITS, projectRoot);

  const gitInfo: GitContextInfo = {
    branch: branch ?? 'unknown',
    changedFiles: [
      ...status.modified,
      ...status.staged.filter((f) => !status.modified.includes(f)),
    ],
    stagedFiles: status.staged,
    untrackedFiles: status.untracked.slice(0, 10),
    recentCommits: commits.map((c) => `${c.hash} ${c.message}`),
  };

  // Add diff if there are changes (smart truncation happens in formatter)
  if (status.hasChanges) {
    const diff = getDiff({ cwd: projectRoot });
    if (diff) {
      gitInfo.diff = diff;
    }
  }

  return gitInfo;
}

/**
 * Add quality issues from audit analysis
 */
async function addQualityIssues(
  projectRoot: string,
  relatedFiles: string[],
  aiData: AiContextData,
): Promise<void> {
  try {
    const { generateAIReportFromAnalysis } = await import('../fix/reporter');

    // Generate audit report
    const report = await generateAIReportFromAnalysis(projectRoot);

    // Filter issues to related files only (if we have related files)
    const relatedSet = new Set(relatedFiles.map((f) => path.resolve(projectRoot, f)));
    const allIssues = report.quickWins.map((qw) => qw.issue);

    const filteredIssues =
      relatedSet.size > 0
        ? allIssues.filter((issue) => relatedSet.has(issue.file))
        : allIssues.slice(0, 20); // Limit to 20 if no filter

    // Convert to context format
    aiData.qualityIssues = filteredIssues.map((issue) => ({
      file: issue.file.replace(`${projectRoot}/`, ''),
      ...(issue.line !== undefined && { line: issue.line }),
      category: issue.category,
      message: issue.message,
      severity: issue.severity,
      autoFixable: Boolean(issue.fixerId),
      ...(issue.fixerId !== undefined && { fixerId: issue.fixerId }),
    }));

    // Add summary
    const byCategory: Record<string, number> = {};
    for (const issue of filteredIssues) {
      byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
    }

    aiData.qualitySummary = {
      totalIssues: filteredIssues.length,
      autoFixable: filteredIssues.filter((i) => i.fixerId).length,
      byCategory,
    };
  } catch {
    // Audit failed, continue without quality issues
  }
}

export {
  detectDomains,
  findRelatedFiles,
  generateChecklist,
  getApproaches,
} from './domains';
// Re-export types and functions
export type { ContextOptions } from './types';
