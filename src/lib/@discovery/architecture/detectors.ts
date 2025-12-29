/**
 * @module lib/@discovery/architecture/detectors
 * @description Pattern detector definitions for architecture analysis
 *
 * Each detector is a declarative configuration that describes:
 * - What directory names to look for (directoryPatterns)
 * - What files to expect inside (filePatterns)
 * - What content markers verify the pattern (contentMarkers)
 * - Whether to look for sub-modules (detectSubModules)
 */

import type { PatternDetector } from './types';

// ============================================================================
// API & BACKEND PATTERNS
// ============================================================================

/**
 * tRPC router pattern detector
 *
 * Looks for directories named "routers" containing .ts files
 * with tRPC-specific keywords.
 */
export const trpcRoutersDetector: PatternDetector = {
  id: 'trpc-routers',
  name: 'tRPC Routers',
  description: 'tRPC API routers',
  directoryPatterns: [/routers?$/i, /trpc.*routers?/i],
  filePatterns: [/\.ts$/],
  contentMarkers: [
    'router',
    'publicProcedure',
    'protectedProcedure',
    'createTRPCRouter',
    't.router',
  ],
  detectSubModules: true,
  patternTemplate: '{path}/{name}.ts exports {name}Router',
};

/**
 * Next.js API routes detector
 *
 * Looks for "api" directories with route.ts files (App Router)
 * or handler files (Pages Router).
 */
export const nextApiRoutesDetector: PatternDetector = {
  id: 'nextjs-api',
  name: 'Next.js API Routes',
  description: 'Next.js route handlers',
  directoryPatterns: [/^api$/],
  filePatterns: [/route\.ts$/, /\[.*\]\.ts$/],
  contentMarkers: ['GET', 'POST', 'PUT', 'DELETE', 'NextRequest', 'NextResponse'],
  patternTemplate: '{path}/[route]/route.ts',
};

/**
 * REST API endpoints detector
 *
 * Looks for controller/handler/endpoint directories.
 */
export const apiEndpointsDetector: PatternDetector = {
  id: 'api-endpoints',
  name: 'API Endpoints',
  description: 'REST API endpoints',
  directoryPatterns: [/^endpoints?$/i, /^controllers?$/i, /^handlers?$/i],
  filePatterns: [/\.ts$/],
  contentMarkers: ['Request', 'Response', 'Handler', 'Controller', '@Get', '@Post'],
  patternTemplate: '{path}/{endpoint}.ts',
};

/**
 * Middleware detector
 */
export const middlewareDetector: PatternDetector = {
  id: 'middleware',
  name: 'Middleware',
  description: 'Request/response middleware',
  directoryPatterns: [/^middlewares?$/i],
  filePatterns: [/\.ts$/],
  contentMarkers: ['middleware', 'next(', 'NextFunction', 'NextMiddleware'],
  patternTemplate: '{path}/{name}.ts',
};

// ============================================================================
// FRONTEND PATTERNS
// ============================================================================

/**
 * React components detector
 *
 * Looks for "components" or "ui" directories containing .tsx files.
 */
export const reactComponentsDetector: PatternDetector = {
  id: 'react-components',
  name: 'React Components',
  description: 'React component modules',
  directoryPatterns: [/^components?$/i, /^ui$/i],
  filePatterns: [/\.tsx$/],
  contentMarkers: ['React', 'export default', 'export function', 'export const'],
  detectSubModules: true,
  patternTemplate: '{path}/{ComponentName}.tsx',
};

/**
 * React hooks detector
 */
export const hooksDetector: PatternDetector = {
  id: 'hooks',
  name: 'Hooks',
  description: 'React hooks',
  directoryPatterns: [/^hooks?$/i],
  filePatterns: [/^use[A-Z].*\.tsx?$/],
  contentMarkers: ['useState', 'useEffect', 'useMemo', 'useCallback', 'useQuery'],
  patternTemplate: '{path}/use{Name}.ts',
};

/**
 * State stores detector
 *
 * Looks for Zustand, Redux, Jotai, or similar state management.
 */
export const stateStoresDetector: PatternDetector = {
  id: 'state-stores',
  name: 'State Stores',
  description: 'State management stores',
  directoryPatterns: [/^stores?$/i, /^state$/i],
  filePatterns: [/store\.ts$/, /Store\.ts$/, /\.store\.ts$/],
  contentMarkers: ['create', 'useStore', 'zustand', 'redux', 'atom', 'createStore'],
  patternTemplate: '{path}/{domain}.store.ts',
};

// ============================================================================
// ARCHITECTURE PATTERNS
// ============================================================================

/**
 * Feature modules detector
 *
 * Looks for feature-based architecture (DDD-style).
 */
export const featureModulesDetector: PatternDetector = {
  id: 'feature-modules',
  name: 'Feature Modules',
  description: 'Feature-based architecture modules',
  directoryPatterns: [/^features?$/i, /^modules?$/i, /^domains?$/i],
  detectSubModules: true,
  patternTemplate: '{path}/{feature}/',
};

/**
 * Shared libraries detector
 */
export const sharedLibDetector: PatternDetector = {
  id: 'shared-lib',
  name: 'Shared Lib',
  description: 'Shared utility libraries',
  directoryPatterns: [/^lib$/i, /^utils?$/i, /^shared$/i, /^common$/i, /^helpers?$/i],
  detectSubModules: true,
  patternTemplate: '{path}/{module}/index.ts',
};

/**
 * Services detector
 */
export const servicesDetector: PatternDetector = {
  id: 'services',
  name: 'Services',
  description: 'Business logic services',
  directoryPatterns: [/^services?$/i, /^providers?$/i],
  filePatterns: [/\.ts$/],
  contentMarkers: ['Service', 'Provider', 'class', 'inject', '@Injectable'],
  patternTemplate: '{path}/{name}.service.ts',
};

// ============================================================================
// DATA PATTERNS
// ============================================================================

/**
 * Prisma schema detector
 */
export const prismaSchemaDetector: PatternDetector = {
  id: 'prisma-schema',
  name: 'Prisma Schema',
  description: 'Prisma database schema',
  directoryPatterns: [/^prisma$/i, /^db$/i, /^database$/i],
  filePatterns: [/\.prisma$/],
  patternTemplate: '{path}/schema.prisma or {path}/models/*.prisma',
};

/**
 * Validation schemas detector (Zod, Yup, etc.)
 */
export const validationSchemasDetector: PatternDetector = {
  id: 'validation-schemas',
  name: 'Validation Schemas',
  description: 'Zod/Yup validation schemas',
  directoryPatterns: [/^schemas?$/i, /^validation$/i, /^validators?$/i],
  filePatterns: [/\.ts$/],
  contentMarkers: ['z.object', 'z.string', 'yup.object', 'Schema', 'z.infer'],
  patternTemplate: '{path}/{name}.schema.ts',
};

// ============================================================================
// CLI & TOOLS PATTERNS
// ============================================================================

/**
 * CLI commands detector
 */
export const cliCommandsDetector: PatternDetector = {
  id: 'cli-commands',
  name: 'CLI Commands',
  description: 'CLI command handlers',
  directoryPatterns: [/^commands?$/i, /^cli$/i],
  filePatterns: [/\.ts$/],
  contentMarkers: ['command', 'program', 'yargs', 'commander', 'Command'],
  detectSubModules: true,
  patternTemplate: '{path}/{command}/index.ts',
};

/**
 * MCP tools detector
 */
export const mcpToolsDetector: PatternDetector = {
  id: 'mcp-tools',
  name: 'MCP Tools',
  description: 'Model Context Protocol tools',
  directoryPatterns: [/^tools?$/i, /^mcp$/i],
  filePatterns: [/\.ts$/],
  contentMarkers: ['Tool', 'handler', 'inputSchema', 'CallToolResult'],
  detectSubModules: true,
  patternTemplate: '{path}/{tool}/index.ts',
};

// ============================================================================
// DEFAULT DETECTORS
// ============================================================================

/**
 * All default pattern detectors
 *
 * Order matters - more specific patterns should come first
 * to avoid false positives from generic patterns.
 */
export const DEFAULT_DETECTORS: readonly PatternDetector[] = [
  // API patterns (most specific)
  trpcRoutersDetector,
  nextApiRoutesDetector,
  apiEndpointsDetector,
  middlewareDetector,

  // Frontend patterns
  reactComponentsDetector,
  hooksDetector,
  stateStoresDetector,

  // Architecture patterns
  featureModulesDetector,
  sharedLibDetector,
  servicesDetector,

  // Data patterns
  prismaSchemaDetector,
  validationSchemasDetector,

  // CLI & Tools
  cliCommandsDetector,
  mcpToolsDetector,
] as const;

/**
 * Get detector by ID
 */
export function getDetectorById(id: string): PatternDetector | undefined {
  return DEFAULT_DETECTORS.find((d) => d.id === id);
}

/**
 * Get detectors by category
 */
export function getDetectorsByCategory(
  category: 'api' | 'frontend' | 'architecture' | 'data' | 'cli',
): PatternDetector[] {
  const categoryMap: Record<string, string[]> = {
    api: ['trpc-routers', 'nextjs-api', 'api-endpoints', 'middleware'],
    frontend: ['react-components', 'hooks', 'state-stores'],
    architecture: ['feature-modules', 'shared-lib', 'services'],
    data: ['prisma-schema', 'validation-schemas'],
    cli: ['cli-commands', 'mcp-tools'],
  };

  const ids = categoryMap[category] || [];
  return DEFAULT_DETECTORS.filter((d) => ids.includes(d.id));
}
