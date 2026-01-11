/**
 * @module lib/@detectors/noise-filter/extractors/intent
 * @description Function Intent Detection
 *
 * Classifies functions by their semantic intent to prevent
 * false positive duplicate detection.
 */

// ============================================================================
// TYPES
// ============================================================================

export type FunctionIntent =
  | 'route-handler' // Next.js page/API route
  | 'component-wrapper' // Thin component wrapper
  | 'schema-generator' // JSON-LD, Zod schema
  | 'factory-instance' // Created by factory function
  | 'hook-consumer' // Hook usage (useX)
  | 'hook-provider' // Hook provider (useXProvider)
  | 'event-handler' // Event/callback handler
  | 'utility' // Pure utility function
  | 'business-logic'; // Domain business logic

export interface IntentContext {
  name?: string | undefined;
  file: string;
  text?: string | undefined;
  complexity?: number | undefined;
  jsxChildren?: string[] | undefined;
  isFactoryGenerated?: boolean | undefined;
  calledComponents?: string[] | undefined;
  calledFunctions?: string[] | undefined;
  /** Function parameters as strings */
  params?: string[] | undefined;
  /** Whether function is async */
  isAsync?: boolean | undefined;
  /** Number of parameters (for architectural pattern detection) */
  paramCount?: number | undefined;
}

export interface IntentResult {
  intent: FunctionIntent;
  confidence: number;
  signals: string[];
}

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

/** Patterns for route handlers */
const ROUTE_HANDLER_PATTERNS = {
  pageFile: /\/page\.tsx?$/,
  routeFile: /\/route\.tsx?$/,
  layoutFile: /\/layout\.tsx?$/,
  apiRoute: /\/api\//,
  httpMethods: /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/,
};

/** Patterns for factory instances */
const FACTORY_PATTERNS = [
  /=\s*create\w+\(/,
  /=\s*create\w+Hook\(/,
  /=\s*create\w+Factory\(/,
  /=\s*make\w+\(/,
  /=\s*build\w+\(/,
  /const\s*\{[^}]+\}\s*=\s*create\w+\(/,
];

/** Patterns for schema generators */
const SCHEMA_PATTERNS = {
  jsonLd: /JsonLd|jsonld|structured-data/i,
  zod: /z\.object|z\.array|z\.string/,
  schemaName: /Schema$/,
};

// ============================================================================
// INTENT DETECTION
// ============================================================================

/**
 * Detect the semantic intent of a function.
 *
 * @param ctx - Context about the function
 * @returns Intent classification with confidence
 *
 * @example
 * detectIntent({ file: '/app/panel/page.tsx', name: 'PanelPage' })
 * // → { intent: 'route-handler', confidence: 0.95, signals: ['pageFile'] }
 */
export function detectIntent(ctx: IntentContext): IntentResult {
  const { name = '', file, text = '', complexity, jsxChildren, isFactoryGenerated } = ctx;
  const signals: string[] = [];

  // 1. Route handlers (highest priority)
  if (ROUTE_HANDLER_PATTERNS.pageFile.test(file)) {
    signals.push('pageFile');
    return { intent: 'route-handler', confidence: 0.95, signals };
  }

  if (ROUTE_HANDLER_PATTERNS.routeFile.test(file)) {
    signals.push('routeFile');
    return { intent: 'route-handler', confidence: 0.95, signals };
  }

  if (ROUTE_HANDLER_PATTERNS.layoutFile.test(file)) {
    signals.push('layoutFile');
    return { intent: 'route-handler', confidence: 0.9, signals };
  }

  if (ROUTE_HANDLER_PATTERNS.apiRoute.test(file) && ROUTE_HANDLER_PATTERNS.httpMethods.test(text)) {
    signals.push('apiRoute', 'httpMethods');
    return { intent: 'route-handler', confidence: 0.9, signals };
  }

  // 2. Factory instances
  if (isFactoryGenerated) {
    signals.push('factoryGenerated');
    return { intent: 'factory-instance', confidence: 0.95, signals };
  }

  for (const pattern of FACTORY_PATTERNS) {
    if (pattern.test(text)) {
      signals.push('factoryPattern');
      return { intent: 'factory-instance', confidence: 0.85, signals };
    }
  }

  // 3. Component wrappers (single JSX child, low complexity)
  if (jsxChildren?.length === 1 && (complexity === undefined || complexity < 20)) {
    signals.push('singleJsxChild', 'lowComplexity');
    return { intent: 'component-wrapper', confidence: 0.85, signals };
  }

  // 4. Schema generators
  if (SCHEMA_PATTERNS.schemaName.test(name)) {
    if (SCHEMA_PATTERNS.jsonLd.test(text)) {
      signals.push('schemaName', 'jsonLd');
      return { intent: 'schema-generator', confidence: 0.9, signals };
    }
    if (SCHEMA_PATTERNS.zod.test(text)) {
      signals.push('schemaName', 'zod');
      return { intent: 'schema-generator', confidence: 0.85, signals };
    }
    signals.push('schemaName');
    return { intent: 'schema-generator', confidence: 0.7, signals };
  }

  // 5. Hook providers
  if (/^use[A-Z].*Provider$/.test(name)) {
    signals.push('hookProviderName');
    return { intent: 'hook-provider', confidence: 0.9, signals };
  }

  // 6. Hook consumers
  if (/^use[A-Z]/.test(name)) {
    signals.push('hookName');
    return { intent: 'hook-consumer', confidence: 0.85, signals };
  }

  // 7. Event handlers
  if (/^(handle|on)[A-Z]/.test(name)) {
    signals.push('eventHandlerName');
    return { intent: 'event-handler', confidence: 0.8, signals };
  }

  // 8. Utility functions (pure functions, no side effects indicators)
  if (/^(get|is|has|can|should|format|parse|convert|calculate|validate|normalize)/.test(name)) {
    signals.push('utilityName');
    return { intent: 'utility', confidence: 0.7, signals };
  }

  // Default: business logic
  return { intent: 'business-logic', confidence: 0.5, signals };
}

/**
 * Check if an intent should be skipped for duplicate detection.
 *
 * Route handlers, component wrappers, factory instances, and schema generators
 * are typically intentionally similar and should not be flagged as duplicates.
 */
export function shouldSkipIntent(intent: FunctionIntent): boolean {
  return ['route-handler', 'component-wrapper', 'factory-instance', 'schema-generator'].includes(
    intent,
  );
}

/**
 * Get intents that should be skipped by default.
 */
export function getDefaultSkipIntents(): FunctionIntent[] {
  return ['route-handler', 'component-wrapper', 'factory-instance', 'schema-generator'];
}

/**
 * Quick check if a function context suggests skippable intent.
 */
export function hasSkippableIntent(ctx: IntentContext): boolean {
  const { intent } = detectIntent(ctx);
  return shouldSkipIntent(intent);
}

// ============================================================================
// ARCHITECTURAL PATTERN DETECTION
// ============================================================================

export type AsyncSyncPattern = 'sync' | 'async' | 'mixed';
export type DependencyPattern = 'injection' | 'internal-fetch' | 'mixed';

export interface ArchitecturalPatternResult {
  asyncSync: AsyncSyncPattern;
  dependency: DependencyPattern;
  isWrapper: boolean;
  /** Combined pattern key for comparison */
  patternKey: string;
  signals: string[];
}

/** Patterns for detecting self-fetching dependencies */
const SELF_FETCH_PATTERNS = [
  /context\.\w+\(/i, // context.getSession()
  /db\.\w+\(/i, // db.query()
  /client\.\w+\(/i, // client.get()
  /api\.\w+\(/i, // api.fetch()
  /\bfetch\s*\(/, // fetch()
  /getSession\s*\(/, // getSession()
  /getServerSession\s*\(/, // Next.js auth
  /prisma\.\w+\.\w+\(/, // prisma.user.findUnique()
  /trpc\.\w+\.\w+\./, // trpc.user.getById.
];

/** Patterns for dependency injection parameters */
const DEPENDENCY_PARAM_PATTERNS = [
  /session/i,
  /context/i,
  /db/i,
  /client/i,
  /config/i,
  /service/i,
  /repository/i,
  /store/i,
];

/**
 * Detect if function is async-oriented or sync-oriented.
 *
 * Distinguishes between:
 * - `sync`: Pure sync function, takes dependencies as params
 * - `async`: Async function that fetches dependencies internally
 * - `mixed`: Uses both patterns
 *
 * @example
 * // Sync pattern (takes session as param)
 * function validateSession(session: Session): boolean
 *
 * // Async pattern (fetches session internally)
 * async function validateSessionSSR(ctx: Context): Promise<boolean>
 */
export function detectAsyncSyncPattern(ctx: IntentContext): AsyncSyncPattern {
  const { text = '', isAsync } = ctx;

  // Signal 1: explicit async/await keywords
  const hasAsyncKeywords = /\basync\b|\bawait\b/.test(text);

  // Signal 2: self-fetching dependencies (context.getSession, db.query)
  const hasSelfFetch = SELF_FETCH_PATTERNS.some((p) => p.test(text));

  // Signal 3: Promise return type indicator
  const hasPromiseReturn = /Promise\s*</.test(text) || /\.then\s*\(/.test(text);

  if (isAsync || hasAsyncKeywords || hasPromiseReturn) {
    if (hasSelfFetch) return 'async'; // Clearly async DAL pattern
    return 'mixed'; // Async but not clearly fetching
  }

  return 'sync';
}

/**
 * Detect dependency injection pattern.
 *
 * Distinguishes between:
 * - `injection`: Takes dependencies as parameters (DI pattern)
 * - `internal-fetch`: Fetches dependencies internally (DAL pattern)
 * - `mixed`: Uses both patterns
 *
 * @example
 * // Dependency injection (session passed in)
 * function isAdmin(session: Session): boolean
 *
 * // Internal fetch (gets session itself)
 * async function requireAdmin(ctx: Context): Promise<void>
 */
export function detectDependencyPattern(ctx: IntentContext): DependencyPattern {
  const { text = '', params = [], paramCount } = ctx;

  // Signal 1: Takes dependency as parameter (check typed params or paramCount)
  const hasDependencyParam = params.some((p) =>
    DEPENDENCY_PARAM_PATTERNS.some((pattern) => pattern.test(p)),
  );

  // Signal 2: Fetches dependency internally
  const fetchesInternal = SELF_FETCH_PATTERNS.some((p) => p.test(text));

  // Signal 3: Use paramCount when typed params not available (SWC fast path)
  // Functions with 0 params that fetch internally = pure internal-fetch pattern
  // Functions with params = likely injection pattern
  const hasAnyParams = params.length > 0 || (paramCount !== undefined && paramCount > 0);
  const hasNoParams = paramCount === 0 || (paramCount === undefined && params.length === 0);

  // Clear internal-fetch: no params + fetches internally
  if (hasNoParams && fetchesInternal) return 'internal-fetch';

  // Clear injection: has dependency params + no internal fetching
  if (hasDependencyParam && !fetchesInternal) return 'injection';

  // Likely injection: has params (even without type info) + no internal fetching
  if (hasAnyParams && !fetchesInternal) return 'injection';

  // Internal fetch without params check
  if (fetchesInternal && !hasDependencyParam) return 'internal-fetch';

  return 'mixed';
}

/**
 * Detect if function is a wrapper around another function.
 *
 * A wrapper:
 * - Calls another function with similar/base name
 * - Adds logic around the call (logging, validation, caching)
 *
 * @example
 * // validateSessionSSR is a wrapper around validateSession
 * async function validateSessionSSR(ctx) {
 *   const session = await ctx.getSession();
 *   return validateSession(session);  // calls base function
 * }
 */
export function detectWrapperPattern(ctx: IntentContext): boolean {
  const { name = '', text = '' } = ctx;

  // Get base name without common suffixes
  const baseName = name.replace(/(SSR|Async|Sync|Internal|Wrapper|Enhanced)$/i, '');

  if (baseName === name || baseName.length < 3) return false;

  // Check if it calls the base function
  const callsBaseFunction = new RegExp(`\\b${baseName}\\s*\\(`).test(text);

  return callsBaseFunction;
}

/**
 * Comprehensive architectural pattern detection.
 *
 * Combines async/sync, dependency, and wrapper patterns to identify
 * architectural separation vs real duplicates.
 *
 * Functions with DIFFERENT pattern keys are architectural variants,
 * not duplicates.
 *
 * @example
 * // @core/auth/guards.ts
 * detectArchitecturalPattern({ name: 'isAdmin', params: ['session'], isAsync: false })
 * // → { patternKey: 'sync|injection|false', ... }
 *
 * // @domain/dal/auth.ts
 * detectArchitecturalPattern({ name: 'requireAdmin', text: 'await getSession()', isAsync: true })
 * // → { patternKey: 'async|internal-fetch|false', ... }
 *
 * // Different pattern keys = NOT duplicates
 */
export function detectArchitecturalPattern(ctx: IntentContext): ArchitecturalPatternResult {
  const asyncSync = detectAsyncSyncPattern(ctx);
  const dependency = detectDependencyPattern(ctx);
  const isWrapper = detectWrapperPattern(ctx);

  const signals: string[] = [];

  if (asyncSync === 'async') signals.push('async-function');
  if (asyncSync === 'sync') signals.push('sync-function');
  if (dependency === 'injection') signals.push('dependency-injection');
  if (dependency === 'internal-fetch') signals.push('internal-fetch');
  if (isWrapper) signals.push('wrapper-pattern');

  const patternKey = `${asyncSync}|${dependency}|${isWrapper}`;

  return {
    asyncSync,
    dependency,
    isWrapper,
    patternKey,
    signals,
  };
}

/**
 * Check if two functions have different architectural patterns.
 *
 * When functions have different patterns, they represent
 * architectural separation (e.g., sync guards vs async DAL),
 * not actual code duplication.
 */
export function haveDifferentArchitecturalPatterns(funcs: Array<{ ctx: IntentContext }>): boolean {
  if (funcs.length < 2) return false;

  const patterns = funcs.map((f) => detectArchitecturalPattern(f.ctx));
  const uniquePatterns = new Set(patterns.map((p) => p.patternKey));

  return uniquePatterns.size > 1;
}
