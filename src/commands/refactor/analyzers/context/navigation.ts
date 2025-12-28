/**
 * @module commands/refactor/analyzers/context/navigation
 * @description AI navigation hints generation
 *
 * Generates hints for AI assistants about where to add new code,
 * file patterns, import conventions, and naming conventions.
 */

import * as path from 'node:path';
import type { AddNewCodeHints, AiNavigation, FilePatternInfo, ProjectContext } from '../../core';

// ============================================================================
// ADD NEW CODE HINTS
// ============================================================================

/**
 * Generate hints for CLI projects
 */
function getCliHints(lib: string): AddNewCodeHints {
  return {
    serverLogic: 'src/commands/<command-name>/',
    clientHook: 'N/A (CLI project)',
    utility: `src/${lib}/<category>/`,
    constant: `src/${lib}/constants/`,
    integration: `src/${lib}/integrations/`,
    component: 'N/A (CLI project)',
    apiRoute: 'N/A (CLI project)',
    test: 'tests/ or src/__tests__/',
  };
}

/**
 * Generate hints for web/API projects
 */
function getWebHints(lib: string, projectContext: ProjectContext): AddNewCodeHints {
  return {
    serverLogic: `${lib}/@core/ or ${lib}/@domain/`,
    clientHook: `${lib}/@ui/hooks/`,
    utility: `${lib}/@utils/`,
    constant: `${lib}/@domain/constants/`,
    integration: `${lib}/@integrations/`,
    component: `${projectContext.entryPoints.components || 'components'}/`,
    apiRoute: `${projectContext.entryPoints.apiRoutes || 'app/api'}/`,
    test: '__tests__/ next to the file',
  };
}

// ============================================================================
// FILE PATTERNS
// ============================================================================

/**
 * Get base file patterns
 */
function getBasePatterns(): FilePatternInfo[] {
  return [
    { pattern: '*.tsx', meaning: 'React component', example: 'Button.tsx' },
    { pattern: '*.ts', meaning: 'TypeScript module', example: 'utils.ts' },
    { pattern: 'index.ts', meaning: 'Barrel export file', example: 'components/index.ts' },
    { pattern: '*.test.ts', meaning: 'Unit test file', example: 'Button.test.tsx' },
    { pattern: '*.spec.ts', meaning: 'Integration test', example: 'api.spec.ts' },
    { pattern: 'types.ts', meaning: 'Type definitions', example: 'user/types.ts' },
  ];
}

/**
 * Get Next.js specific patterns
 */
function getNextPatterns(): FilePatternInfo[] {
  return [
    { pattern: 'page.tsx', meaning: 'Next.js page component', example: 'app/about/page.tsx' },
    { pattern: 'layout.tsx', meaning: 'Next.js layout wrapper', example: 'app/layout.tsx' },
    { pattern: 'route.ts', meaning: 'Next.js API route', example: 'app/api/users/route.ts' },
    { pattern: 'loading.tsx', meaning: 'Loading UI', example: 'app/loading.tsx' },
    { pattern: 'error.tsx', meaning: 'Error boundary', example: 'app/error.tsx' },
    { pattern: 'not-found.tsx', meaning: '404 page', example: 'app/not-found.tsx' },
  ];
}

/**
 * Get CLI specific patterns
 */
function getCliPatterns(): FilePatternInfo[] {
  return [
    { pattern: 'cli.ts', meaning: 'CLI entry point', example: 'src/bin/cli.ts' },
    { pattern: 'commands/*.ts', meaning: 'CLI command', example: 'commands/status.ts' },
  ];
}

// ============================================================================
// NAMING CONVENTIONS
// ============================================================================

/**
 * Get naming conventions for web projects
 */
function getWebNamingConventions() {
  return {
    files: 'kebab-case for utilities, PascalCase for components',
    components: 'PascalCase (Button, UserCard)',
    hooks: 'camelCase with use prefix (useAuth, useForm)',
    utilities: 'camelCase (formatDate, parseQuery)',
    constants: 'SCREAMING_SNAKE_CASE (API_URL, MAX_RETRIES)',
    types: 'PascalCase (User, ApiResponse)',
  };
}

/**
 * Get naming conventions for CLI projects
 */
function getCliNamingConventions() {
  return {
    files: 'kebab-case (my-module.ts)',
    components: 'N/A (CLI project)',
    hooks: 'N/A (CLI project)',
    utilities: 'camelCase (formatDate, parseQuery)',
    constants: 'SCREAMING_SNAKE_CASE (API_URL, MAX_RETRIES)',
    types: 'PascalCase (User, ApiResponse)',
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generate AI navigation hints
 */
export function generateAiNavigation(
  projectContext: ProjectContext,
  libDir: string | null,
): AiNavigation {
  const lib = libDir ? path.basename(libDir) : 'lib';
  const isCli = projectContext.type === 'cli';

  // Where to add new code
  const addNewCode = isCli ? getCliHints(lib) : getWebHints(lib, projectContext);

  // File patterns
  const filePatterns: FilePatternInfo[] = getBasePatterns();

  if (projectContext.techStack.framework === 'next') {
    filePatterns.push(...getNextPatterns());
  }

  if (isCli) {
    filePatterns.push(...getCliPatterns());
  }

  return {
    addNewCode,
    filePatterns,
    importConventions: {
      absoluteImports: projectContext.importAlias !== null,
      alias: projectContext.importAlias,
      barrelExports: true,
      preferredOrder: [
        'react/next imports',
        'external packages',
        'absolute imports (@/...)',
        'relative imports (./...)',
        'type imports',
      ],
    },
    namingConventions: isCli ? getCliNamingConventions() : getWebNamingConventions(),
  };
}
