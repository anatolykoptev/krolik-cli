/**
 * @module types/config
 * @description Configuration type definitions
 */

/**
 * Path configuration for project directories
 */
export interface PathConfig {
  /** Web application directory (e.g., 'apps/web', 'src') */
  web?: string;
  /** API/backend directory (e.g., 'packages/api', 'server') */
  api?: string;
  /** Database/ORM directory (e.g., 'packages/db', 'prisma') */
  db?: string;
  /** Shared packages directory */
  shared?: string;
  /** Components directory */
  components?: string;
  /** Hooks directory */
  hooks?: string;
  /** Library/utilities directory */
  lib?: string;
}

/**
 * Feature flags for project capabilities
 */
export interface FeatureConfig {
  /** Project uses Prisma ORM */
  prisma?: boolean;
  /** Project uses tRPC */
  trpc?: boolean;
  /** Project uses Next.js */
  nextjs?: boolean;
  /** Project uses React */
  react?: boolean;
  /** Project is a monorepo */
  monorepo?: boolean;
  /** Project uses TypeScript */
  typescript?: boolean;
}

/**
 * Prisma-specific configuration
 */
export interface PrismaConfig {
  /** Path to Prisma schema directory or file */
  schemaDir?: string;
  /** Path to migrations directory */
  migrationsDir?: string;
}

/**
 * tRPC-specific configuration
 */
export interface TrpcConfig {
  /** Path to routers directory */
  routersDir?: string;
  /** Path to main router file */
  appRouter?: string;
}

/**
 * Template configuration for code generation
 */
export interface TemplateConfig {
  /** Path to hook template */
  hook?: string;
  /** Path to component template */
  component?: string;
  /** Path to test template */
  test?: string;
  /** Path to schema template */
  schema?: string;
}

/**
 * Domain configuration for context filtering
 */
export interface DomainConfig {
  /** Primary keywords that get highest priority in filtering */
  primary: string[];
  /** Secondary keywords for broader matching */
  secondary?: string[];
  /** File patterns related to this domain (glob) */
  files?: string[];
  /** Suggested approach steps */
  approach?: string[];
  /** Context hints for AI */
  hints?: Record<string, string>;
}

/**
 * Main project configuration
 */
export interface KrolikConfig {
  /** Project name (for display purposes) */
  name?: string;

  /** Project root directory (auto-detected if not set) */
  projectRoot?: string;

  /** Path configurations */
  paths?: PathConfig;

  /** Feature flags */
  features?: FeatureConfig;

  /** Prisma configuration */
  prisma?: PrismaConfig;

  /** tRPC configuration */
  trpc?: TrpcConfig;

  /** Template paths */
  templates?: TemplateConfig;

  /** Custom domain definitions for context filtering */
  domains?: Record<string, DomainConfig>;

  /** Directories to exclude from analysis */
  exclude?: string[];

  /** Custom extensions to include */
  extensions?: string[];
}

/** @deprecated Use KrolikConfig instead */
export type RabbitConfig = KrolikConfig;

/**
 * Resolved configuration with all defaults applied
 * Note: domains remains optional as it's project-specific configuration
 */
export interface ResolvedConfig extends Omit<Required<KrolikConfig>, 'domains'> {
  paths: Required<PathConfig>;
  features: Required<FeatureConfig>;
  prisma: Required<PrismaConfig>;
  trpc: Required<TrpcConfig>;
  templates: Required<TemplateConfig>;
  domains?: Record<string, DomainConfig>;
}
