/**
 * @module commands/context
 * @description AI context generation command
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { CommandContext, ContextResult, KrolikConfig } from "../../types";
import { getIssue } from "../../lib/github";
import {
  getCurrentBranch,
  getStatus,
  getRecentCommits,
  getDiff,
  isGitRepo,
} from "../../lib/git";
import {
  detectDomains,
  findRelatedFiles,
  getApproaches,
  generateChecklist,
} from "./domains";
import {
  printContext,
  formatJson,
  formatMarkdown,
  formatAiPrompt,
  type AiContextData,
  type DiscoveredFiles,
  type GitContextInfo,
  type ProjectTree,
} from "./output";
import { analyzeSchema } from "../schema";
import { analyzeRoutes } from "../routes";
import {
  parseZodSchemas,
  parseComponents,
  parseTestFiles,
  generateContextHints,
} from "./parsers";

const MAX_VALUE = 3;

const MAX_LENGTH = 150;

const MAGIC_150 = MAX_LENGTH;

const MAGIC_5 = 5;

/**
 * Domain to file pattern mapping
 */
const DOMAIN_FILE_PATTERNS: Record<
  string,
  { zod: string[]; components: string[]; tests: string[] }
> = {
  booking: {
    zod: ["booking", "availability", "schedule"],
    components: ["Booking", "Calendar", "Schedule", "Availability"],
    tests: ["booking", "availability"],
  },
  events: {
    zod: ["event", "ticket", "venue"],
    components: ["Event", "Ticket", "Venue", "Ticketing"],
    tests: ["event", "ticket"],
  },
  crm: {
    zod: ["customer", "interaction", "lead", "crm"],
    components: ["Customer", "CRM", "Lead", "Interaction"],
    tests: ["customer", "crm"],
  },
  places: {
    zod: ["place", "business", "location"],
    components: ["Place", "Business", "Location"],
    tests: ["place", "business"],
  },
  users: {
    zod: ["user", "auth", "profile"],
    components: ["User", "Auth", "Profile"],
    tests: ["user", "auth"],
  },
};

/**
 * Context command options
 */
export interface ContextOptions {
  issue?: string;
  feature?: string;
  file?: string;
  json?: boolean;
  markdown?: boolean;
  ai?: boolean;
  verbose?: boolean;
}

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
 * Discover relevant files based on domains
 */
function discoverFiles(
  projectRoot: string,
  domains: string[],
): DiscoveredFiles {
  const result: DiscoveredFiles = {
    zodSchemas: [],
    components: [],
    tests: [],
  };

  // Collect patterns from domains
  const zodPatterns: string[] = [];
  const componentPatterns: string[] = [];
  const testPatterns: string[] = [];

  for (const domain of domains) {
    const patterns = DOMAIN_FILE_PATTERNS[domain.toLowerCase()];
    if (patterns) {
      zodPatterns.push(...patterns.zod);
      componentPatterns.push(...patterns.components);
      testPatterns.push(...patterns.tests);
    }
  }

  // Search for Zod schemas
  const zodDirs = [
    "packages/shared/src/schemas",
    "src/schemas",
    "src/lib/schemas",
  ];
  for (const dir of zodDirs) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      const files = findFilesMatching(fullPath, zodPatterns, ".ts");
      result.zodSchemas.push(...files.map((f) => path.relative(fullPath, f)));
    }
  }

  // Search for components
  const componentDirs = [
    "apps/web/components/Business",
    "apps/web/components",
    "src/components",
  ];
  for (const dir of componentDirs) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      const files = findFilesMatching(fullPath, componentPatterns, ".tsx");
      result.components.push(...files.map((f) => path.relative(fullPath, f)));
    }
  }

  // Search for tests
  const testDirs = [
    "packages/api/src/routers/__tests__",
    "apps/web/__tests__",
    "__tests__",
    "tests",
  ];
  for (const dir of testDirs) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      const files = findFilesMatching(fullPath, testPatterns, ".test.ts");
      result.tests.push(...files.map((f) => path.relative(fullPath, f)));
    }
  }

  return result;
}

/**
 * Find files matching patterns in a directory
 */
function findFilesMatching(
  dir: string,
  patterns: string[],
  ext: string,
): string[] {
  const results: string[] = [];

  function scanDir(currentDir: string): void {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (
          entry.isDirectory() &&
          !entry.name.startsWith(".") &&
          entry.name !== "node_modules"
        ) {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(ext)) {
          const nameLower = entry.name.toLowerCase();
          if (patterns.some((p) => nameLower.includes(p.toLowerCase()))) {
            results.push(fullPath);
          }
        }
      }
    } catch {
      // Directory not readable, skip
    }
  }

  scanDir(dir);
  return results;
}

/**
 * Find prisma schema directory
 */
function findSchemaDir(projectRoot: string): string | null {
  const candidates = [
    "packages/db/prisma",
    "prisma",
    "src/prisma",
    "db/prisma",
  ];
  for (const candidate of candidates) {
    const fullPath = path.join(projectRoot, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

/**
 * Find tRPC routers directory
 */
function findRoutersDir(projectRoot: string): string | null {
  const candidates = [
    "packages/api/src/routers",
    "src/server/routers",
    "src/routers",
    "server/routers",
  ];
  for (const candidate of candidates) {
    const fullPath = path.join(projectRoot, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

/**
 * Run context command
 */
export async function runContext(
  ctx: CommandContext & { options: ContextOptions },
): Promise<void> {
  const { config, logger, options } = ctx;

  let task = options.feature || options.file || "General development context";
  let issueData: ContextResult["issue"] | undefined;

  // Fetch issue if provided
  if (options.issue) {
    const issueNum = Number.parseInt(options.issue, 10);
    if (!Number.isNaN(issueNum)) {
      const issue = getIssue(issueNum, config.projectRoot);
      if (issue) {
        issueData = {
          number: issue.number,
          title: issue.title,
          body: issue.body,
          labels: issue.labels,
        };
        task = issue.title;
      } else {
        logger.warn(
          `Could not fetch issue #${issueNum}. Check gh auth status.`,
        );
        task = `Issue #${issueNum}`;
      }
    }
  }

  const result = generateContext(task, config.projectRoot, issueData, config);

  if (options.json) {
    console.log(formatJson(result));
    return;
  }

  if (options.markdown) {
    console.log(formatMarkdown(result));
    return;
  }

  // AI-ready structured output
  if (options.ai) {
    const aiData: AiContextData = {
      context: result,
      config,
      checklist: generateChecklist(result.domains),
    };

    // Try to get schema
    const schemaDir = findSchemaDir(config.projectRoot);
    if (schemaDir) {
      try {
        aiData.schema = analyzeSchema(schemaDir);
      } catch {
        // Schema analysis failed, continue without
      }
    }

    // Try to get routes
    const routersDir = findRoutersDir(config.projectRoot);
    if (routersDir) {
      try {
        aiData.routes = analyzeRoutes(routersDir);
      } catch {
        // Routes analysis failed, continue without
      }
    }

    // Discover related files
    aiData.files = discoverFiles(config.projectRoot, result.domains);

    // Collect domain patterns for file discovery
    const domainPatterns = result.domains.flatMap((d) => {
      const patterns = DOMAIN_FILE_PATTERNS[d.toLowerCase()];
      return patterns ? patterns.zod : [d.toLowerCase()];
    });

    // Parse Zod schemas with validation details
    const zodDirs = [
      "packages/shared/src/schemas",
      "packages/shared/src/validation",
      "packages/db/src/schemas",
      "packages/api/src/lib",
      "src/schemas",
      "src/lib/schemas",
    ];
    for (const dir of zodDirs) {
      const fullPath = path.join(config.projectRoot, dir);
      if (fs.existsSync(fullPath)) {
        const schemas = parseZodSchemas(fullPath, domainPatterns);
        if (schemas.length > 0) {
          aiData.ioSchemas = [...(aiData.ioSchemas || []), ...schemas];
        }
      }
    }

    // Parse component details
    const componentPatterns = result.domains.flatMap((d) => {
      const patterns = DOMAIN_FILE_PATTERNS[d.toLowerCase()];
      return patterns ? patterns.components : [d];
    });
    const componentDirs = ["apps/web/components", "src/components"];
    for (const dir of componentDirs) {
      const fullPath = path.join(config.projectRoot, dir);
      if (fs.existsSync(fullPath)) {
        const components = parseComponents(fullPath, componentPatterns);
        if (components.length > 0) {
          aiData.componentDetails = [
            ...(aiData.componentDetails || []),
            ...components,
          ];
        }
      }
    }

    // Parse test files
    const testPatterns = result.domains.flatMap((d) => {
      const patterns = DOMAIN_FILE_PATTERNS[d.toLowerCase()];
      return patterns ? patterns.tests : [d.toLowerCase()];
    });
    const testDirs = [
      "packages/api/src/routers/__tests__",
      "apps/web/__tests__",
      "__tests__",
      "tests",
    ];
    for (const dir of testDirs) {
      const fullPath = path.join(config.projectRoot, dir);
      if (fs.existsSync(fullPath)) {
        const tests = parseTestFiles(fullPath, testPatterns);
        if (tests.length > 0) {
          aiData.testDetails = [...(aiData.testDetails || []), ...tests];
        }
      }
    }

    // Generate context hints
    aiData.hints = generateContextHints(result.domains);

    // Gather git information
    if (isGitRepo(config.projectRoot)) {
      const branch = getCurrentBranch(config.projectRoot);
      const status = getStatus(config.projectRoot);
      const commits = getRecentCommits(MAGIC_5, config.projectRoot);

      const gitInfo: GitContextInfo = {
        branch: branch ?? "unknown",
        changedFiles: [
          ...status.modified,
          ...status.staged.filter((f) => !status.modified.includes(f)),
        ],
        stagedFiles: status.staged,
        untrackedFiles: status.untracked.slice(0, 10),
        recentCommits: commits.map((c) => `${c.hash} ${c.message}`),
      };

      // Add diff if there are changes (limit to 150 lines for context size)
      if (status.hasChanges) {
        const diff = getDiff({ cwd: config.projectRoot });
        if (diff) {
          const lines = diff.split("\n");
          gitInfo.diff = lines.slice(0, MAGIC_150).join("\n");
          if (lines.length > MAX_LENGTH) {
            gitInfo.diff += `\n... (${lines.length - MAX_LENGTH} more lines)`;
          }
        }
      }

      aiData.git = gitInfo;
    }

    // Generate project tree
    aiData.tree = generateProjectTree(config.projectRoot);

    console.log(formatAiPrompt(aiData));
    return;
  }

  printContext(result, logger, options.verbose);
}

/**
 * Generate project tree structure
 */
function generateProjectTree(projectRoot: string): ProjectTree {
  const excludeDirs = [
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    ".turbo",
    "coverage",
    ".pnpm",
  ];
  const importantDirs = [
    "src",
    "apps",
    "packages",
    "lib",
    "components",
    "pages",
    "api",
  ];

  let totalFiles = 0;
  let totalDirs = 0;
  const lines: string[] = [];

  function scanDir(dir: string, prefix: string, depth: number): void {
    if (depth > MAX_VALUE) return; // Max depth 3 for readability

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const dirs = entries.filter(
        (e) =>
          e.isDirectory() &&
          !excludeDirs.includes(e.name) &&
          !e.name.startsWith("."),
      );
      const files = entries.filter(
        (e) => e.isFile() && !e.name.startsWith("."),
      );

      // Sort: important dirs first, then alphabetically
      dirs.sort((a, b) => {
        const aImportant = importantDirs.includes(a.name);
        const bImportant = importantDirs.includes(b.name);
        if (aImportant && !bImportant) return -1;
        if (!aImportant && bImportant) return 1;
        return a.name.localeCompare(b.name);
      });

      for (let i = 0; i < dirs.length; i++) {
        const entry = dirs[i];
        if (!entry) continue;

        const isLast = i === dirs.length - 1 && files.length === 0;
        const connector = isLast ? "└── " : "├── ";
        const subPrefix = isLast ? "    " : "│   ";

        lines.push(`${prefix}${connector}${entry.name}/`);
        totalDirs++;

        scanDir(path.join(dir, entry.name), prefix + subPrefix, depth + 1);
      }

      // Show file count at leaf level instead of listing all files
      if (files.length > 0 && depth > 0) {
        const exts = [
          ...new Set(files.map((f) => path.extname(f.name)).filter(Boolean)),
        ];
        const extStr = exts.slice(0, MAX_VALUE).join(", ");
        lines.push(`${prefix}└── (${files.length} files: ${extStr})`);
        totalFiles += files.length;
      } else if (depth === 0) {
        // At root, show key files
        const keyFiles = files.filter((f) =>
          ["package.json", "tsconfig.json", "CLAUDE.md", "README.md"].includes(
            f.name,
          ),
        );
        for (const file of keyFiles) {
          lines.push(`${prefix}├── ${file.name}`);
          totalFiles++;
        }
      }
    } catch {
      // Directory not readable
    }
  }

  lines.push(path.basename(projectRoot) + "/");
  scanDir(projectRoot, "", 0);

  return {
    structure: lines.join("\n"),
    totalFiles,
    totalDirs,
  };
}

// Re-export for external use
export {
  detectDomains,
  findRelatedFiles,
  getApproaches,
  generateChecklist,
} from "./domains";
