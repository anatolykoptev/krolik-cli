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
