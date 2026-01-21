/**
 * Config Resolver - Resolve and validate orchestrator configuration
 *
 * @module @felix/orchestrator/config-resolver
 */

import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { basename, dirname, join, normalize, relative } from 'node:path';
import { findProjectRoot } from '../../@discovery/project.js';
import type { FelixOrchestratorConfig, ResolvedConfig } from './types.js';

/**
 * Default configuration values
 *
 * Note: dbPath and checkpointDbPath are removed - all data is now stored
 * in the central krolik.db at {projectRoot}/.krolik/memory/krolik.db
 *
 * PRD files MUST be stored in .krolik/felix/prd/ directory
 */
const DEFAULT_CONFIG: Omit<ResolvedConfig, 'projectRoot'> = {
  prdPath: '.krolik/felix/prd/PRD.json',
  model: 'sonnet',
  backend: 'cli',
  maxAttempts: 3,
  maxCostUsd: 10,
  validationSteps: [], // Disabled by default for CLI backend (no real code changes)
  continueOnFailure: false,
  onEvent: () => {},
  onCostUpdate: () => {},
  plugins: [],
  enableContext: true,
  enableGitAutoCommit: false,
  qualityGateMode: 'pre-commit', // Enabled by default - runs after each task
  enableMemory: true,
  dryRun: false,
  verbose: false,
  enableParallelExecution: false,
  maxParallelTasks: 3,
  enableCheckpoints: true,
  useMultiAgentMode: false,
  autoMovePrdFiles: true, // Automatically move PRD files to correct location (.krolik/felix/prd/)
};

/**
 * Resolve config with defaults
 */
export function resolveConfig(config: FelixOrchestratorConfig): ResolvedConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
  };
}

/**
 * Required PRD directory relative to project root
 */
const REQUIRED_PRD_DIR = '.krolik/felix/prd';

/**
 * Check if directory is a valid project root
 *
 * A valid project root must have either package.json or .git directory.
 * This prevents treating workspace roots or arbitrary directories as projects.
 *
 * @param dir - Directory path to check
 * @returns true if directory is a valid project root
 */
function isValidProjectRoot(dir: string): boolean {
  return existsSync(join(dir, 'package.json')) || existsSync(join(dir, '.git'));
}

/**
 * Extract project root from PRD file path
 *
 * If PRD is already in correct location (.krolik/felix/prd/), extract project root from path.
 * Otherwise, find nearest project root from file's directory.
 *
 * @param prdPath - Absolute path to PRD file
 * @returns Detected project root path, or null if no valid project root found
 */
function detectProjectRootFromPrd(prdPath: string): string | null {
  // If PRD is already in correct location, extract project root from path
  // Pattern: /path/to/project/.krolik/felix/prd/file.json -> /path/to/project
  const krolikPrdPattern = /^(.+)\/\.krolik\/felix\/prd\/.+\.json$/;
  const match = prdPath.match(krolikPrdPattern);
  if (match?.[1]) {
    return match[1];
  }

  // PRD is not in correct location - find nearest project root from file's directory
  const fileDir = dirname(prdPath);
  const detectedRoot = findProjectRoot(fileDir);

  // Verify that detected root is a valid project (has package.json or .git)
  // This prevents treating workspace roots or arbitrary directories as projects
  if (!isValidProjectRoot(detectedRoot)) {
    return null;
  }

  return detectedRoot;
}

/**
 * Automatically move PRD file to the correct location
 *
 * @param currentPath - Current absolute path of the PRD file
 * @param targetPath - Target absolute path where file should be moved
 * @returns true if file was moved successfully, false otherwise
 */
function movePrdFile(currentPath: string, targetPath: string): boolean {
  try {
    const filename = basename(currentPath);
    const targetDir = dirname(targetPath);

    console.error(`\n⚠️  PRD file found in wrong location: ${currentPath}`);
    console.error(`📁 Auto-moving to: ${targetDir}/\n`);

    // Create target directory if it doesn't exist
    mkdirSync(targetDir, { recursive: true });

    // Move the file
    renameSync(currentPath, targetPath);

    console.error(`✅ File moved successfully: ${filename}\n`);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to move file: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return false;
  }
}

/**
 * Resolve PRD file path (relative or absolute)
 *
 * Validates that PRD file is located in `.krolik/felix/prd/` directory.
 * This ensures consistent PRD storage and prevents accidental placement in project root.
 *
 * If file is in wrong location but exists, automatically moves it (if autoMovePrdFiles is enabled).
 * Detects the correct project root from the PRD file location for multi-project workspaces.
 *
 * @throws {Error} If PRD path is not in the required directory and auto-move fails or is disabled
 */
export function resolvePrdPath(config: ResolvedConfig): string {
  const { prdPath, projectRoot, autoMovePrdFiles } = config;

  // Resolve to absolute path
  const absolutePath = prdPath.startsWith('/') ? prdPath : join(projectRoot, prdPath);

  // Normalize paths for comparison
  const normalizedAbsolutePath = normalize(absolutePath);
  const normalizedProjectRoot = normalize(projectRoot);

  // Get relative path from project root
  const relativePath = relative(normalizedProjectRoot, normalizedAbsolutePath);

  // Check if path starts with .krolik/felix/prd
  if (!relativePath.startsWith(REQUIRED_PRD_DIR)) {
    // Path is invalid - check if file exists and auto-move it
    const fileExists = existsSync(normalizedAbsolutePath);

    if (fileExists && autoMovePrdFiles) {
      // Detect actual project root from PRD file location
      // This handles cases where PRD is in a different project than the one passed in config
      const detectedProjectRoot = detectProjectRootFromPrd(normalizedAbsolutePath);

      // If no valid project root found (e.g., file in workspace root without package.json/.git)
      if (!detectedProjectRoot) {
        const errorMessage =
          `Cannot determine project root for PRD file: ${normalizedAbsolutePath}\n\n` +
          `The file is located outside of any valid project (no package.json or .git found).\n` +
          `PRD files must be located within a project directory.\n\n` +
          `To fix:\n` +
          `1. Move the file into one of your project directories, then run this command again\n` +
          `2. Or initialize a valid project structure with: npm init / git init\n\n` +
          `Expected: PRD files should be in a project with package.json or .git`;
        throw new Error(errorMessage);
      }

      const filename = basename(normalizedAbsolutePath);
      const targetPath = join(detectedProjectRoot, REQUIRED_PRD_DIR, filename);

      // Automatically move file to correct location
      const moved = movePrdFile(normalizedAbsolutePath, targetPath);

      if (moved) {
        // File was moved successfully, return new path
        console.error(`✨ Using new path: ${targetPath}\n`);
        return targetPath;
      }
    }

    // File doesn't exist, auto-move disabled, or move failed - throw error with instructions
    const errorMessage = fileExists
      ? `PRD file is in wrong location.\n` +
        `Current: ${relativePath}\n` +
        `Expected: ${REQUIRED_PRD_DIR}/...\n\n` +
        `To fix manually:\n` +
        `  mkdir -p ${join(projectRoot, REQUIRED_PRD_DIR)}\n` +
        `  mv ${absolutePath} ${join(projectRoot, REQUIRED_PRD_DIR)}/`
      : `PRD file not found: ${absolutePath}\n\n` +
        `Expected location: ${join(projectRoot, REQUIRED_PRD_DIR)}/...\n` +
        `Example: ${join(projectRoot, REQUIRED_PRD_DIR)}/my-feature.json`;

    throw new Error(errorMessage);
  }

  return absolutePath;
}
