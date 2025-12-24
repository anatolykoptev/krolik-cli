/**
 * @module config/defaults
 * @description Default configuration values
 */

import type {
  FeatureConfig,
  PathConfig,
  PrismaConfig,
  ResolvedConfig,
  TemplateConfig,
  TrpcConfig,
} from '../types';

/**
 * Default path configuration
 */
export const DEFAULT_PATHS: Required<PathConfig> = {
  web: 'src',
  api: 'src/api',
  db: 'prisma',
  shared: 'src/shared',
  components: 'src/components',
  hooks: 'src/hooks',
  lib: 'src/lib',
};

/**
 * Default feature configuration
 */
export const DEFAULT_FEATURES: Required<FeatureConfig> = {
  prisma: false,
  trpc: false,
  nextjs: false,
  react: true,
  monorepo: false,
  typescript: true,
};

/**
 * Default Prisma configuration
 */
export const DEFAULT_PRISMA: Required<PrismaConfig> = {
  schemaDir: 'prisma',
  migrationsDir: 'prisma/migrations',
};

/**
 * Default tRPC configuration
 */
export const DEFAULT_TRPC: Required<TrpcConfig> = {
  routersDir: 'src/server/routers',
  appRouter: 'src/server/routers/index.ts',
};

/**
 * Default template configuration
 */
export const DEFAULT_TEMPLATES: Required<TemplateConfig> = {
  hook: '',
  component: '',
  test: '',
  schema: '',
};

/**
 * Default exclude patterns
 */
export const DEFAULT_EXCLUDE = [
  'node_modules',
  '.next',
  'dist',
  'build',
  '.git',
  '.turbo',
  'coverage',
  '.cache',
];

/**
 * Default file extensions
 */
export const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * Create default resolved config
 */
export function createDefaultConfig(projectRoot: string): ResolvedConfig {
  return {
    name: 'project',
    projectRoot,
    paths: { ...DEFAULT_PATHS },
    features: { ...DEFAULT_FEATURES },
    prisma: { ...DEFAULT_PRISMA },
    trpc: { ...DEFAULT_TRPC },
    templates: { ...DEFAULT_TEMPLATES },
    exclude: [...DEFAULT_EXCLUDE],
    extensions: [...DEFAULT_EXTENSIONS],
  };
}
