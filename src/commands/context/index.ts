/**
 * @module commands/context
 * @description AI context generation command
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  detectLibraries,
  fetchAndCacheDocs,
  getSuggestions,
  hasContext7ApiKey,
} from '@/lib/@integrations/context7';
import { getSectionsByLibrary, searchDocs } from '@/lib/@storage/docs';
import { type Memory, search as searchMemory } from '@/lib/@storage/memory';
import { saveToKrolik } from '../../lib/@core/krolik-paths';
import { filterGeneratedFindings } from '../../lib/@detectors/noise-filter';
import {
  getCurrentBranch,
  getDiff,
  getIssue,
  getRecentCommits,
  getStatus,
  isGhAuthenticated,
  isGhAvailable,
  isGitRepo,
  listIssues,
} from '../../lib/@vcs';
import type { CommandContext } from '../../types/commands/base';
import type { ContextResult } from '../../types/commands/context';
import type { KrolikConfig } from '../../types/config';
import { analyzeRoutes } from '../routes';
import { analyzeSchema } from '../schema';
import { extractTodos } from '../status/todos';
import { detectEntryPoints, generateDataFlows } from './collectors';
import { matchesDomain, scanFeaturesDir } from './collectors/entrypoints';
import { detectDomains, findRelatedFiles, generateChecklist, getApproaches } from './domains';
import { formatAiPrompt, formatJson, formatMarkdown, printContext } from './formatters';
import {
  collectArchitecturePatterns,
  collectLibModules,
  DOMAIN_FILE_PATTERNS,
  discoverFiles,
  findRoutersDir,
  findSchemaDir,
  generateProjectTree,
  searchInProject,
} from './helpers';
import {
  buildImportGraph,
  buildImportGraphSwc,
  generateContextHints,
  parseApiContracts,
  parseComponents,
  parseDbRelations,
  parseEnvVars,
  parseTestFiles,
  parseTypesInDir,
  parseZodSchemas,
} from './parsers';
import { buildSmartContext } from './smart-context';
import type {
  AiContextData,
  ContextMode,
  ContextOptions,
  GitContextInfo,
  GitHubIssuesData,
  LibraryDocsEntry,
} from './types';

const MAX_COMMITS = 5;
const MAX_MEMORIES = 10;

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

  // Handle --changed-only: override relatedFiles with git changed files
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
  const xmlOutput = formatAiPrompt(aiData);

  // Save to .krolik/CONTEXT.xml for AI reference
  saveToKrolik('CONTEXT.xml', xmlOutput, { projectRoot });

  console.log(xmlOutput);
}

/**
 * Build AI context data with all enhanced sections
 *
 * Modes:
 * - Minimal (--minimal): ultra-compact (~1500 tokens) - summary, git, memory only
 * - Quick (--quick): compact (~3500 tokens) - architecture, git, tree, schema, routes, repo-map
 * - Deep (--deep): imports, types, env, contracts only (complements --quick)
 * - Full (default): all sections
 *
 * Usage:
 *   krolik context --minimal # Ultra-compact for token-constrained AI
 *   krolik context --quick   # Fast overview with repo-map
 *   krolik context --deep    # Heavy analysis only
 *   krolik context           # Everything (quick + deep)
 */
async function buildAiContextData(
  result: ContextResult,
  config: KrolikConfig,
  options: ContextOptions,
): Promise<AiContextData> {
  // projectRoot is guaranteed to exist at this point
  const projectRoot = config.projectRoot ?? process.cwd();
  const isMinimalMode = options.minimal === true;
  const isQuickMode = options.quick === true;
  const isDeepMode = options.deep === true;

  // Determine context mode (minimal takes precedence)
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

  // =====================================================
  // SMART CONTEXT (repo-map) - CRITICAL for AI codebase understanding
  // Included in: ALL modes (compressed in minimal)
  // Provides PageRank-ranked file map for AI to understand codebase structure
  // =====================================================
  try {
    const repoMapResult = await buildSmartContext(projectRoot, result.domains, options);
    aiData.repoMap = repoMapResult;
  } catch (error) {
    // Smart context failed, continue without it
    if (process.env.DEBUG) {
      console.error('[context] Smart context building failed:', error);
    }
  }

  // =====================================================
  // CORE SECTIONS (included in ALL modes)
  // =====================================================
  // Git information - essential for knowing what's changed
  if (isGitRepo(projectRoot)) {
    aiData.git = buildGitInfo(projectRoot);
  }

  // =====================================================
  // SEARCH RESULTS (from --search option)
  // =====================================================
  if (options.search) {
    const searchResults = searchInProject(projectRoot, options.search);
    if (searchResults) {
      aiData.searchResults = searchResults;
    }
  }

  // =====================================================
  // MINIMAL MODE: Optimized context with compressed critical sections
  // Includes: git, memory, repo-map, schema, routes (all compressed)
  // =====================================================
  if (isMinimalMode) {
    // Memory is critical
    aiData.memories = loadRelevantMemory(projectRoot, result.domains);
    aiData.hints = generateContextHints(result.domains);

    // Schema - critical for understanding data model
    const schemaDir = findSchemaDir(projectRoot);
    if (schemaDir) {
      try {
        aiData.schema = analyzeSchema(schemaDir);
      } catch {
        // Schema analysis failed, continue without
      }
    }

    // Routes - critical for understanding API
    const routerDir = findRoutersDir(projectRoot);
    if (routerDir) {
      try {
        aiData.routes = analyzeRoutes(routerDir);
      } catch {
        // Routes analysis failed, continue without
      }
    }

    return aiData;
  }

  // =====================================================
  // QUICK SECTIONS (included in quick and full, NOT in deep)
  // =====================================================
  if (!isDeepMode) {
    // Schema analysis
    const schemaDir = findSchemaDir(projectRoot);
    if (schemaDir) {
      try {
        aiData.schema = analyzeSchema(schemaDir);
      } catch (error) {
        // Schema analysis failed, continue without
        if (process.env.DEBUG) {
          console.error('[context] Schema analysis failed:', error);
        }
      }
    }

    // Routes analysis
    const routersDir = findRoutersDir(projectRoot);
    if (routersDir) {
      try {
        aiData.routes = analyzeRoutes(routersDir);
      } catch (error) {
        // Routes analysis failed, continue without
        if (process.env.DEBUG) {
          console.error('[context] Routes analysis failed:', error);
        }
      }
    }

    // Project tree
    aiData.tree = generateProjectTree(projectRoot);

    // Architecture patterns (default: ON, unless --no-architecture)
    if (options.architecture !== false) {
      aiData.architecture = collectArchitecturePatterns(projectRoot);
    }

    // Extract TODO comments from codebase (included in all modes)
    // Filter out generated files (Prisma, graphql-codegen, etc.)
    const rawTodos = extractTodos(projectRoot);
    const { passed: filteredTodos } = filterGeneratedFindings(rawTodos);
    aiData.todos = filteredTodos;

    // Entry points and data flow (Phase 6)
    // Shows WHERE to start reading code and HOW data moves through the system
    try {
      const entryPoints = await detectEntryPoints(projectRoot, result.domains);
      if (entryPoints.length > 0) {
        aiData.entryPoints = entryPoints;
        // Generate data flows for each domain with entry points
        const dataFlows = result.domains.flatMap((domain) => {
          const domainEntryPoints = entryPoints.filter((ep) =>
            ep.file.toLowerCase().includes(domain.toLowerCase()),
          );
          return generateDataFlows(domain, domainEntryPoints);
        });
        if (dataFlows.length > 0) {
          aiData.dataFlows = dataFlows;
        }
      }
    } catch (error) {
      // Entry points detection failed, continue without
      if (process.env.DEBUG) {
        console.error('[context] Entry points detection failed:', error);
      }
    }
  }

  // Lib modules from src/lib/@* (included in all modes)
  const libModules = collectLibModules(projectRoot);
  if (libModules) {
    aiData.libModules = libModules;
  }

  // Load GitHub issues (--with-issues) - available in all modes
  if (options.withIssues) {
    const issues = loadGitHubIssues(projectRoot);
    if (issues) {
      aiData.githubIssues = issues;
    }
  }

  // =====================================================
  // MEMORY & DOCS (included in ALL modes - critical for AI)
  // =====================================================
  // Memory contains decisions, patterns, bugfixes from previous sessions
  // Without it, AI loses accumulated knowledge about the project
  aiData.memories = loadRelevantMemory(projectRoot, result.domains);

  // Library documentation from Context7 (auto-fetch if needed)
  aiData.libraryDocs = await loadLibraryDocs(projectRoot, result.domains);

  // Quick mode: stop here with minimal context
  if (isQuickMode) {
    aiData.hints = generateContextHints(result.domains);
    return aiData;
  }

  // =====================================================
  // DEEP SECTIONS (included in deep and full, NOT in quick)
  // =====================================================

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

  // Build advanced import graph with circular dependency detection
  buildAdvancedImportGraph(projectRoot, result.domains, aiData);

  // Parse database relations from Prisma schema
  parseDbRelationsFromSchema(projectRoot, aiData);

  // Parse API contracts from tRPC routers
  parseApiContractsFromRouters(projectRoot, result.domains, aiData);

  // Parse environment variables
  parseEnvVarsFromProject(projectRoot, aiData);

  // Generate hints
  aiData.hints = generateContextHints(result.domains);

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
 * Parse components from standard directories + dynamic feature discovery
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

  // Dynamic discovery: feature components via scanFeaturesDir
  // Scans apps/web/features/{domain}/ for .tsx files
  const featureFiles = scanFeaturesDir(projectRoot, 'apps/web/features', domains, '', ['.tsx']);
  for (const file of featureFiles) {
    const fullPath = path.join(projectRoot, file);
    const components = parseComponents(path.dirname(fullPath), ['*']);
    if (components.length > 0) {
      // Deduplicate by component name
      const existingNames = new Set(aiData.componentDetails?.map((c) => c.name) || []);
      const newComponents = components.filter((c) => !existingNames.has(c.name));
      aiData.componentDetails = [...(aiData.componentDetails || []), ...newComponents];
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
 * Discover feature type files dynamically
 * Scans apps/web/features/[domain]/types.ts pattern
 */
function discoverFeatureTypeFiles(projectRoot: string, domains: string[]): string[] {
  const featuresDir = path.join(projectRoot, 'apps/web/features');
  if (!fs.existsSync(featuresDir)) return [];

  const typeFiles: string[] = [];
  try {
    const features = fs.readdirSync(featuresDir, { withFileTypes: true });
    for (const feature of features) {
      if (!feature.isDirectory()) continue;

      // Use matchesDomain from entrypoints for consistent domain matching
      if (domains.length > 0 && !matchesDomain(feature.name, domains)) continue;

      const typesFile = path.join(featuresDir, feature.name, 'types.ts');
      if (fs.existsSync(typesFile)) {
        typeFiles.push(typesFile);
      }
    }
  } catch {
    // Ignore errors
  }
  return typeFiles;
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

  // Dynamic discovery: feature type files (apps/web/features/*/types.ts)
  const featureTypeFiles = discoverFeatureTypeFiles(projectRoot, domains);
  for (const typeFile of featureTypeFiles) {
    const types = parseTypesInDir(path.dirname(typeFile), ['types']);
    if (types.length > 0) {
      aiData.types = [...(aiData.types || []), ...types];
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
 * Load relevant memories for the current context
 */
function loadRelevantMemory(projectRoot: string, domains: string[]): Memory[] {
  const projectName = path.basename(projectRoot);

  try {
    // First try to find memories matching features/domains
    if (domains.length > 0) {
      const domainResults = searchMemory({
        project: projectName,
        features: domains.map((d) => d.toLowerCase()),
        limit: MAX_MEMORIES,
      });

      if (domainResults.length > 0) {
        return domainResults.map((r) => r.memory);
      }
    }

    // Fallback: get recent high-importance memories
    const recentResults = searchMemory({
      project: projectName,
      importance: 'high',
      limit: MAX_MEMORIES,
    });

    if (recentResults.length > 0) {
      return recentResults.map((r) => r.memory);
    }

    // Final fallback: any recent memories
    const anyResults = searchMemory({
      project: projectName,
      limit: MAX_MEMORIES,
    });

    return anyResults.map((r) => r.memory);
  } catch (error) {
    if (process.env.DEBUG) {
      console.error('[context] Memory search failed:', error);
    }
    return [];
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
  } catch (error) {
    // Audit failed, continue without quality issues
    if (process.env.DEBUG) {
      console.error('[context] Audit analysis failed:', error);
    }
  }
}

/**
 * Build advanced import graph with circular dependency detection
 */
function buildAdvancedImportGraph(
  projectRoot: string,
  _domains: string[],
  aiData: AiContextData,
): void {
  // Directories to analyze for import graph
  const importDirs = [
    'packages/api/src',
    'packages/shared/src',
    'apps/web/src',
    'apps/web/components',
    'src',
  ];

  for (const dir of importDirs) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      try {
        // Use empty patterns to include all files
        const graph = buildImportGraphSwc(fullPath, []);

        if (graph.nodes.length > 0) {
          aiData.importGraph = graph;
          break; // Use first found graph
        }
      } catch (error) {
        // Continue to next directory
        if (process.env.DEBUG) {
          console.error('[context] Import graph building failed:', error);
        }
      }
    }
  }
}

/**
 * Parse database relations from Prisma schema
 */
function parseDbRelationsFromSchema(projectRoot: string, aiData: AiContextData): void {
  // parseDbRelations expects a directory containing schema.prisma and/or models/
  const schemaDirs = ['packages/db/prisma', 'prisma'];

  for (const schemaDir of schemaDirs) {
    const fullPath = path.join(projectRoot, schemaDir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      try {
        const relations = parseDbRelations(fullPath);
        if (relations.models.length > 0 || relations.relations.length > 0) {
          aiData.dbRelations = relations;
          break;
        }
      } catch (error) {
        // Continue to next path
        if (process.env.DEBUG) {
          console.error('[context] DB relations parsing failed:', error);
        }
      }
    }
  }
}

/**
 * Parse API contracts from tRPC routers
 */
function parseApiContractsFromRouters(
  projectRoot: string,
  domains: string[],
  aiData: AiContextData,
): void {
  // Filter patterns for domain-specific routers
  const patterns = domains.map((d) => d.toLowerCase());

  const routerDirs = [
    'packages/api/src/routers',
    'packages/api/src/router',
    'src/server/routers',
    'src/routers',
  ];

  for (const dir of routerDirs) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      try {
        const contracts = parseApiContracts(fullPath, patterns);
        if (contracts.length > 0) {
          aiData.apiContracts = [...(aiData.apiContracts || []), ...contracts];
        }
      } catch (error) {
        // Continue to next directory
        if (process.env.DEBUG) {
          console.error('[context] API contracts parsing failed:', error);
        }
      }
    }
  }
}

/**
 * Parse environment variables from project
 */
function parseEnvVarsFromProject(projectRoot: string, aiData: AiContextData): void {
  try {
    // parseEnvVars scans projectRoot for both:
    // - .env files (to get definitions)
    // - TypeScript files (to find process.env usages)
    const envReport = parseEnvVars(projectRoot);
    if (
      envReport.usages.length > 0 ||
      envReport.definitions.length > 0 ||
      envReport.missing.length > 0
    ) {
      aiData.envVars = envReport;
    }
  } catch (error) {
    // Continue without env vars
    if (process.env.DEBUG) {
      console.error('[context] Environment variables parsing failed:', error);
    }
  }
}

/**
 * Load library documentation from Context7 cache (with auto-fetch)
 * Auto-fetches missing/expired libraries if CONTEXT7_API_KEY is set
 */
async function loadLibraryDocs(
  projectRoot: string,
  domains: string[],
): Promise<LibraryDocsEntry[]> {
  const results: LibraryDocsEntry[] = [];

  try {
    // Detect libraries from package.json
    const detected = detectLibraries(projectRoot);
    if (detected.length === 0) return [];

    const suggestions = getSuggestions(detected);
    const apiAvailable = hasContext7ApiKey();

    // Auto-fetch missing libraries if API key is available
    if (apiAvailable && suggestions.toFetch.length > 0) {
      for (const libName of suggestions.toFetch.slice(0, 3)) {
        // Limit to 3 libs
        try {
          await fetchAndCacheDocs(libName, { maxPages: 2 }); // Fetch 2 pages
        } catch (error) {
          // Fetch failed, continue with others
          if (process.env.DEBUG) {
            console.error('[context] Library docs fetch failed:', error);
          }
        }
      }
    }

    // Auto-refresh expired libraries (limit to 2)
    if (apiAvailable && suggestions.toRefresh.length > 0) {
      for (const libName of suggestions.toRefresh.slice(0, 2)) {
        try {
          await fetchAndCacheDocs(libName, { force: true, maxPages: 2 });
        } catch (error) {
          // Refresh failed, will use expired cache
          if (process.env.DEBUG) {
            console.error('[context] Library docs refresh failed:', error);
          }
        }
      }
    }

    // Build search query from domains
    const searchQuery = domains
      .filter((d) => !['general', 'development', 'context'].includes(d.toLowerCase()))
      .join(' ')
      .trim();

    // Search for relevant docs for each cached library
    for (const lib of detected) {
      if (!lib.context7Id) continue;

      // Search cache for relevant sections
      let searchResults =
        searchQuery.length > 0
          ? searchDocs({ query: searchQuery, library: lib.name, limit: 3 })
          : [];

      // If domain-specific search found nothing but library is cached,
      // fall back to getting general sections (first 3)
      if (searchResults.length === 0 && lib.isCached && lib.context7Id) {
        const sections = getSectionsByLibrary(lib.context7Id);
        searchResults = sections.slice(0, 3).map((section) => ({
          section,
          libraryName: lib.name,
          relevance: 0.5,
        }));
      }

      if (searchResults.length === 0 && !lib.isCached) {
        results.push({
          libraryName: lib.name,
          libraryId: lib.context7Id,
          status: 'unavailable',
          sections: [],
        });
        continue;
      }

      if (searchResults.length > 0) {
        results.push({
          libraryName: lib.name,
          libraryId: lib.context7Id,
          status: lib.isExpired ? 'expired' : 'cached',
          sections: searchResults.map((r) => ({
            title: r.section.title,
            content: r.section.content.slice(0, 500), // Truncate for context
            codeSnippets: r.section.codeSnippets.slice(0, 2), // Max 2 snippets
          })),
        });
      } else if (lib.isCached) {
        // Library is cached but no sections found (empty cache)
        results.push({
          libraryName: lib.name,
          libraryId: lib.context7Id,
          status: 'cached',
          sections: [],
        });
      }
    }
  } catch (error) {
    // Docs cache error, return empty
    if (process.env.DEBUG) {
      console.error('[context] Library docs loading failed:', error);
    }
    return [];
  }

  return results;
}

/**
 * Load GitHub issues from repository using gh CLI
 */
function loadGitHubIssues(projectRoot: string): GitHubIssuesData | undefined {
  try {
    // Check if gh CLI is available and authenticated
    if (!isGhAvailable() || !isGhAuthenticated()) {
      return undefined;
    }

    // Fetch open issues (limit to 20)
    const issues = listIssues(20, projectRoot);

    if (issues.length === 0) {
      return undefined;
    }

    return {
      count: issues.length,
      source: 'gh cli',
      issues: issues.map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        labels: issue.labels,
      })),
    };
  } catch (error) {
    // gh CLI not available or error occurred
    if (process.env.DEBUG) {
      console.error('[context] GitHub issues loading failed:', error);
    }
    return undefined;
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
