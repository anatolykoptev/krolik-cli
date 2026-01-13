/**
 * @module commands/fix/reporter/file-context
 * @description File context building for audit reports
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FileAnalysis } from '../../commands/fix/core';
import { extractExportNames, extractImportPaths } from '../@discovery';
import type { ContentProvider, FileContext, ReportContext } from './types';

// ============================================================================
// TECH STACK DETECTION
// ============================================================================

const TECH_STACK_DEPS: Record<string, string> = {
  typescript: 'TypeScript',
  react: 'React',
  'react-dom': 'React',
  next: 'Next.js',
  '@trpc/server': 'tRPC',
  '@prisma/client': 'Prisma',
  zod: 'Zod',
  tailwindcss: 'Tailwind CSS',
  expo: 'Expo',
};

/**
 * Detect tech stack from package.json
 */
function detectTechStack(projectRoot: string): string[] {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const techStack: string[] = [];

  if (!fs.existsSync(packageJsonPath)) return techStack;

  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    for (const [dep, name] of Object.entries(TECH_STACK_DEPS)) {
      if (deps[dep] && !techStack.includes(name)) {
        techStack.push(name);
      }
    }
  } catch {
    // Ignore parse errors
  }

  return techStack;
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

/**
 * Build report context from project info
 */
export function buildContext(
  projectRoot: string,
  gitInfo?: { branch?: string; status?: { modified: number; untracked: number; staged: number } },
): ReportContext {
  const context: ReportContext = { projectRoot };

  if (gitInfo) {
    context.gitBranch = gitInfo.branch;
    context.gitStatus = gitInfo.status;
  }

  const techStack = detectTechStack(projectRoot);
  if (techStack.length > 0) {
    context.techStack = techStack;
  }

  return context;
}

// ============================================================================
// FILE CONTEXT
// ============================================================================

/**
 * Determine file purpose from analysis
 */
function determinePurpose(file: FileAnalysis): string {
  const mainFn = file.functions.find((f) => f.isExported);
  if (mainFn) {
    return `Module (main: ${mainFn.name})`;
  }
  if (file.exports > 0) {
    return 'Module';
  }
  return 'Internal';
}

/**
 * Build file contexts from quality report
 */
export function buildFileContexts(
  files: FileAnalysis[],
  fileContents: Map<string, string> | ContentProvider,
): FileContext[] {
  return files.map((file) => {
    let content = '';
    if (fileContents instanceof Map) {
      content = fileContents.get(file.path) ?? '';
    } else if (typeof fileContents === 'function') {
      content = fileContents(file.path) ?? '';
    }
    const avgComplexity =
      file.functions.length > 0
        ? Math.round(
            file.functions.reduce((sum, f) => sum + f.complexity, 0) / file.functions.length,
          )
        : 0;

    return {
      path: file.relativePath || file.path,
      purpose: determinePurpose(file),
      type: file.fileType,
      metrics: {
        lines: file.lines,
        functions: file.functions.length,
        avgComplexity,
      },
      exports: extractExportNames(content),
      imports: extractImportPaths(content),
    };
  });
}
