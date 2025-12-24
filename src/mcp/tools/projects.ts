/**
 * @module mcp/tools/projects
 * @description Project detection utilities for MCP tools
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Project info
 */
export interface ProjectInfo {
  name: string;
  path: string;
  hasPackageJson: boolean;
  hasGit: boolean;
  hasTsConfig: boolean;
  description?: string;
}

/**
 * Project detection result
 */
export interface DetectionResult {
  status: 'single' | 'multiple' | 'none';
  project?: ProjectInfo;
  projects?: ProjectInfo[];
  message?: string;
}

/**
 * Folders to skip when scanning for projects
 */
const SKIP_FOLDERS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  '.krolik',
  '.claude',
]);

/**
 * Check if a directory is a project (has package.json or .git)
 */
function isProject(dir: string): ProjectInfo | null {
  const hasPackageJson = fs.existsSync(path.join(dir, 'package.json'));
  const hasGit = fs.existsSync(path.join(dir, '.git'));
  const hasTsConfig = fs.existsSync(path.join(dir, 'tsconfig.json'));

  if (!hasPackageJson && !hasGit) {
    return null;
  }

  let description: string | undefined;
  if (hasPackageJson) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
      description = pkg.description || pkg.name;
    } catch {
      // Ignore parse errors
    }
  }

  return {
    name: path.basename(dir),
    path: dir,
    hasPackageJson,
    hasGit,
    hasTsConfig,
    ...(description ? { description } : {}),
  };
}

/**
 * Scan directory for projects (one level deep)
 */
function scanForProjects(workspaceRoot: string): ProjectInfo[] {
  const projects: ProjectInfo[] = [];

  try {
    const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_FOLDERS.has(entry.name) || entry.name.startsWith('.')) {
        continue;
      }

      const projectPath = path.join(workspaceRoot, entry.name);
      const project = isProject(projectPath);
      if (project) {
        projects.push(project);
      }
    }
  } catch {
    // Ignore scan errors
  }

  return projects;
}

/**
 * Detect projects in workspace
 */
export function detectProjects(workspaceRoot: string, requestedProject?: string): DetectionResult {
  // Check if workspace root itself is a project
  const rootProject = isProject(workspaceRoot);

  // If a specific project is requested, find it
  if (requestedProject) {
    const projectPath = path.join(workspaceRoot, requestedProject);
    if (fs.existsSync(projectPath)) {
      const project = isProject(projectPath);
      if (project) {
        return { status: 'single', project };
      }
    }
    // Maybe it's an absolute path or the workspace root name
    if (requestedProject === path.basename(workspaceRoot) && rootProject) {
      return { status: 'single', project: rootProject };
    }
    return {
      status: 'none',
      message: `Project "${requestedProject}" not found. Use the tool without project parameter to see available projects.`,
    };
  }

  // If workspace root is a project (has package.json), use it
  if (rootProject) {
    return { status: 'single', project: rootProject };
  }

  // Scan for projects in workspace
  const projects = scanForProjects(workspaceRoot);

  if (projects.length === 0) {
    return {
      status: 'none',
      message:
        'No projects found. Make sure you are in a directory with package.json or subdirectories containing projects.',
    };
  }

  if (projects.length === 1 && projects[0]) {
    return { status: 'single', project: projects[0] };
  }

  // Multiple projects found - return list for selection
  return {
    status: 'multiple',
    projects,
    message: 'Multiple projects found. Please specify which project to analyze.',
  };
}

/**
 * Format project list as XML for AI agent
 */
export function formatProjectList(projects: ProjectInfo[]): string {
  const lines: string[] = [
    '<available-projects>',
    '  <instruction>Multiple projects detected. Please call the tool again with the "project" parameter set to one of these:</instruction>',
    '',
  ];

  for (const p of projects) {
    lines.push(`  <project name="${p.name}">`);
    if (p.description) {
      lines.push(`    <description>${p.description}</description>`);
    }
    lines.push(`    <path>${p.path}</path>`);
    const features: string[] = [];
    if (p.hasPackageJson) features.push('npm');
    if (p.hasGit) features.push('git');
    if (p.hasTsConfig) features.push('typescript');
    lines.push(`    <features>${features.join(', ')}</features>`);
    lines.push('  </project>');
  }

  lines.push('</available-projects>');
  return lines.join('\n');
}

/**
 * Resolve project path from detection result
 */
export function resolveProjectPath(
  workspaceRoot: string,
  requestedProject?: string,
): { path: string } | { error: string } {
  const result = detectProjects(workspaceRoot, requestedProject);

  switch (result.status) {
    case 'single':
      if (!result.project) {
        return { error: 'Project not found' };
      }
      return { path: result.project.path };
    case 'multiple':
      if (!result.projects) {
        return { error: 'No projects found' };
      }
      return { error: formatProjectList(result.projects) };
    case 'none':
      return { error: result.message || 'No projects found' };
  }
}

/**
 * Handler wrapper with project detection
 * Single source of truth for project resolution in all tools
 */
export function withProjectDetection(
  args: Record<string, unknown>,
  workspaceRoot: string,
  handler: (projectPath: string) => string,
): string {
  const projectArg = typeof args.project === 'string' ? args.project : undefined;
  const resolved = resolveProjectPath(workspaceRoot, projectArg);

  if ('error' in resolved) {
    return resolved.error;
  }

  return handler(resolved.path);
}
