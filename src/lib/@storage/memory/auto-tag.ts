/**
 * @module lib/@storage/memory/auto-tag
 * @description Automatic tag extraction from memory content
 *
 * Implements Google-style auto-tagging:
 * - Technical terms extraction
 * - File/path detection
 * - Known pattern matching
 * - Domain-specific vocabulary
 */

// ============================================================================
// KNOWN PATTERNS
// ============================================================================

/**
 * Technical domain keywords and their canonical tags
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  // Architecture
  architecture: ['architecture', 'architectural', 'design pattern', 'structure', 'module'],
  api: ['api', 'endpoint', 'route', 'rest', 'graphql', 'trpc'],
  database: ['database', 'db', 'schema', 'prisma', 'sql', 'migration', 'model'],
  auth: ['auth', 'authentication', 'authorization', 'login', 'session', 'jwt', 'oauth'],

  // Frontend
  ui: ['ui', 'component', 'button', 'form', 'modal', 'dialog', 'layout'],
  state: ['state', 'redux', 'zustand', 'context', 'store'],
  css: ['css', 'tailwind', 'style', 'theme', 'responsive'],

  // Backend
  server: ['server', 'backend', 'middleware', 'handler'],
  cache: ['cache', 'caching', 'redis', 'memo', 'memoize'],
  queue: ['queue', 'job', 'worker', 'background'],

  // Testing
  test: ['test', 'testing', 'spec', 'jest', 'vitest', 'e2e', 'unit'],

  // DevOps
  deploy: ['deploy', 'deployment', 'ci', 'cd', 'docker', 'kubernetes'],
  config: ['config', 'configuration', 'env', 'environment', 'settings'],

  // Quality
  performance: ['performance', 'optimization', 'speed', 'latency', 'perf'],
  security: ['security', 'vulnerability', 'xss', 'csrf', 'injection'],
  refactor: ['refactor', 'refactoring', 'cleanup', 'technical debt'],

  // Features
  booking: ['booking', 'reservation', 'schedule', 'calendar', 'slot'],
  payment: ['payment', 'stripe', 'billing', 'invoice', 'subscription'],
  notification: ['notification', 'email', 'sms', 'push', 'alert'],
  i18n: ['i18n', 'translation', 'localization', 'locale', 'intl'],
};

/**
 * Common technology keywords
 */
const TECH_KEYWORDS: Record<string, string> = {
  // Frameworks
  react: 'react',
  nextjs: 'nextjs',
  'next.js': 'nextjs',
  node: 'nodejs',
  express: 'express',

  // Languages
  typescript: 'typescript',
  javascript: 'javascript',
  python: 'python',

  // Tools
  prisma: 'prisma',
  trpc: 'trpc',
  zod: 'zod',
  tailwind: 'tailwind',
  eslint: 'eslint',
  webpack: 'webpack',
  vite: 'vite',
};

/**
 * Action keywords that indicate memory type
 */
const ACTION_KEYWORDS: Record<string, string[]> = {
  decision: ['decided', 'chose', 'selected', 'will use', 'going with', 'prefer'],
  pattern: ['pattern', 'convention', 'standard', 'always', 'never', 'must'],
  bugfix: ['fixed', 'bug', 'issue', 'error', 'problem', 'crash', 'broken'],
  feature: ['added', 'implemented', 'created', 'built', 'new feature'],
};

// ============================================================================
// EXTRACTION
// ============================================================================

/**
 * Extract tags from text content
 *
 * @example
 * ```typescript
 * const tags = extractTags(
 *   'Decided to use tRPC for type safety in API routes'
 * );
 * // Returns: ['api', 'trpc', 'typescript']
 * ```
 */
export function extractTags(text: string, existingTags: string[] = []): string[] {
  const lowerText = text.toLowerCase();
  const tags = new Set<string>(existingTags.map((t) => t.toLowerCase()));

  // 1. Match domain keywords
  for (const [tag, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((kw) => lowerText.includes(kw))) {
      tags.add(tag);
    }
  }

  // 2. Match tech keywords
  for (const [keyword, tag] of Object.entries(TECH_KEYWORDS)) {
    if (lowerText.includes(keyword)) {
      tags.add(tag);
    }
  }

  // 3. Extract file extensions mentioned
  const fileExtensions = text.match(/\.(ts|tsx|js|jsx|json|md|yml|yaml|sql|prisma)\b/g);
  if (fileExtensions) {
    for (const ext of fileExtensions) {
      tags.add(ext.slice(1)); // Remove the dot
    }
  }

  // 4. Extract camelCase/PascalCase identifiers (likely component/function names)
  const identifiers = text.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g);
  if (identifiers) {
    for (const id of identifiers.slice(0, 3)) {
      // Limit to 3
      tags.add(id.toLowerCase());
    }
  }

  // 5. Extract common patterns like "use X for Y"
  const usePattern = lowerText.match(/use\s+(\w+)\s+for/);
  if (usePattern?.[1]) {
    tags.add(usePattern[1]);
  }

  // Limit total tags
  return Array.from(tags).slice(0, 10);
}

/**
 * Suggest memory type based on content
 *
 * @example
 * ```typescript
 * const type = suggestMemoryType('Fixed the login bug where users...');
 * // Returns: 'bugfix'
 * ```
 */
export function suggestMemoryType(text: string): string | undefined {
  const lowerText = text.toLowerCase();

  for (const [type, keywords] of Object.entries(ACTION_KEYWORDS)) {
    if (keywords.some((kw) => lowerText.includes(kw))) {
      return type;
    }
  }

  return undefined;
}

/**
 * Extract features from file paths mentioned in text
 *
 * @example
 * ```typescript
 * const features = extractFeatures('Updated apps/web/features/booking/...');
 * // Returns: ['booking']
 * ```
 */
export function extractFeatures(text: string): string[] {
  const features = new Set<string>();

  // Match common feature path patterns
  const featurePatterns = [
    /features\/([a-z-]+)/gi,
    /modules\/([a-z-]+)/gi,
    /domains\/([a-z-]+)/gi,
    /apps\/\w+\/([a-z-]+)/gi,
  ];

  for (const pattern of featurePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        features.add(match[1].toLowerCase());
      }
    }
  }

  // Also check for explicit feature mentions
  const explicitFeature = text.match(/(?:feature|domain|module):\s*([a-z-]+)/i);
  if (explicitFeature?.[1]) {
    features.add(explicitFeature[1].toLowerCase());
  }

  return Array.from(features);
}

/**
 * Extract file paths from text
 *
 * @example
 * ```typescript
 * const files = extractFiles('Modified src/components/Button.tsx');
 * // Returns: ['src/components/Button.tsx']
 * ```
 */
export function extractFiles(text: string): string[] {
  const files: string[] = [];

  // Match file path patterns
  const pathPattern = /(?:^|\s)((?:[\w.-]+\/)+[\w.-]+\.[a-z]+)\b/gi;
  const matches = text.matchAll(pathPattern);

  for (const match of matches) {
    if (match[1]) {
      files.push(match[1]);
    }
  }

  return files.slice(0, 10); // Limit to 10 files
}

/**
 * Suggest importance based on keywords
 *
 * @example
 * ```typescript
 * const importance = suggestImportance('CRITICAL: Security vulnerability in...');
 * // Returns: 'critical'
 * ```
 */
export function suggestImportance(
  text: string,
): 'critical' | 'high' | 'medium' | 'low' | undefined {
  const lowerText = text.toLowerCase();

  // Critical indicators
  if (
    lowerText.includes('critical') ||
    lowerText.includes('security') ||
    lowerText.includes('vulnerability') ||
    lowerText.includes('urgent') ||
    lowerText.includes('breaking')
  ) {
    return 'critical';
  }

  // High indicators
  if (
    lowerText.includes('important') ||
    lowerText.includes('must') ||
    lowerText.includes('required') ||
    lowerText.includes('always')
  ) {
    return 'high';
  }

  // Low indicators
  if (
    lowerText.includes('minor') ||
    lowerText.includes('optional') ||
    lowerText.includes('nice to have') ||
    lowerText.includes('maybe')
  ) {
    return 'low';
  }

  return undefined; // Default to medium
}

// ============================================================================
// ENRICHMENT
// ============================================================================

/**
 * Enrich memory save options with auto-extracted metadata
 */
export interface EnrichedMemoryOptions {
  tags: string[];
  features: string[];
  files: string[];
  suggestedType?: string | undefined;
  suggestedImportance?: 'critical' | 'high' | 'medium' | 'low' | undefined;
}

/**
 * Auto-enrich memory options from title and description
 *
 * @example
 * ```typescript
 * const enriched = enrichMemoryOptions(
 *   'Use tRPC for API',
 *   'Decided to use tRPC for type-safe API in apps/web/features/booking'
 * );
 * // Returns: {
 * //   tags: ['api', 'trpc', 'typescript'],
 * //   features: ['booking'],
 * //   files: [],
 * //   suggestedType: 'decision',
 * //   suggestedImportance: undefined
 * // }
 * ```
 */
export function enrichMemoryOptions(
  title: string,
  description: string,
  existingTags: string[] = [],
): EnrichedMemoryOptions {
  const fullText = `${title} ${description}`;

  return {
    tags: extractTags(fullText, existingTags),
    features: extractFeatures(fullText),
    files: extractFiles(description),
    suggestedType: suggestMemoryType(fullText),
    suggestedImportance: suggestImportance(fullText),
  };
}
