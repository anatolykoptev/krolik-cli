/**
 * @module lib/@detectors/noise-filter/stages/semantic
 * @description Stage 2: Semantic Context Filter
 *
 * Filters findings based on semantic understanding of code:
 * - Function intent (route-handler, wrapper, factory, etc.)
 * - Domain boundaries (different domains = not duplicates)
 * - Complexity gates (trivial code = skip)
 * - Call graph similarity (different calls = not duplicates)
 */

import {
  allMakeDifferentCalls,
  allRenderDifferentComponents,
  areAllDifferentDomains,
  type DomainContext,
  detectIntent,
  extractDomain,
  type FunctionIntent,
  getDefaultSkipIntents,
  type IntentContext,
} from '../extractors';

// ============================================================================
// TYPES
// ============================================================================

export interface SemanticFilterConfig {
  /** Skip these intent types entirely */
  skipIntents: FunctionIntent[];
  /** Allow cross-domain duplicates */
  allowCrossDomain: boolean;
  /** Minimum complexity for structural clones */
  minComplexity: number;
  /** Check call graph similarity */
  checkCallGraph: boolean;
  /** Check JSX children similarity */
  checkJsxChildren: boolean;
}

export const DEFAULT_SEMANTIC_CONFIG: SemanticFilterConfig = {
  skipIntents: getDefaultSkipIntents(),
  allowCrossDomain: false,
  minComplexity: 25,
  checkCallGraph: true,
  checkJsxChildren: true,
};

export interface SemanticFilterResult {
  passed: boolean;
  reason?: string | undefined;
  intent?: FunctionIntent | undefined;
  domain?: DomainContext | undefined;
  complexity?: number | undefined;
  confidence: number;
}

export interface SemanticFinding {
  id?: string | undefined;
  type: string;
  file: string;
  line?: number | undefined;
  text: string;
  metadata?:
    | {
        name?: string | undefined;
        complexity?: number | undefined;
        jsxChildren?: string[] | undefined;
        calledComponents?: string[] | undefined;
        calledFunctions?: string[] | undefined;
        isFactoryGenerated?: boolean | undefined;
        normalizedBody?: string | undefined;
      }
    | undefined;
}

// ============================================================================
// FILTER FUNCTIONS
// ============================================================================

/**
 * Apply semantic filter to a single finding.
 *
 * @param finding - The finding to filter
 * @param config - Filter configuration
 * @returns Filter result with pass/fail and reason
 */
export function applySemanticFilter(
  finding: SemanticFinding,
  config: Partial<SemanticFilterConfig> = {},
): SemanticFilterResult {
  const cfg = { ...DEFAULT_SEMANTIC_CONFIG, ...config };

  // Only applies to duplicate-type findings
  if (!['duplicate-function', 'structural-clone', 'duplicate'].includes(finding.type)) {
    return { passed: true, confidence: 1.0 };
  }

  // Build intent context
  const intentCtx: IntentContext = {
    name: finding.metadata?.name,
    file: finding.file,
    text: finding.metadata?.normalizedBody ?? finding.text,
    complexity: finding.metadata?.complexity,
    jsxChildren: finding.metadata?.jsxChildren,
    isFactoryGenerated: finding.metadata?.isFactoryGenerated,
    calledComponents: finding.metadata?.calledComponents,
    calledFunctions: finding.metadata?.calledFunctions,
  };

  // 1. Detect and check intent
  const { intent } = detectIntent(intentCtx);
  if (cfg.skipIntents.includes(intent)) {
    return {
      passed: false,
      reason: `Skipped intent: ${intent}`,
      intent,
      confidence: 0.9,
    };
  }

  // 2. Check complexity
  const complexity = finding.metadata?.complexity;
  if (complexity !== undefined && complexity < cfg.minComplexity) {
    return {
      passed: false,
      reason: `Low complexity: ${complexity} < ${cfg.minComplexity}`,
      intent,
      complexity,
      confidence: 0.85,
    };
  }

  // 3. Extract domain
  const domain = extractDomain(finding.file);

  return {
    passed: true,
    intent,
    domain,
    complexity,
    confidence: 1.0,
  };
}

/**
 * Apply semantic filter to a group of related findings (duplicate candidates).
 *
 * This is the key function for filtering false positive duplicates:
 * - If all findings are in different domains → NOT duplicates
 * - If all findings render different JSX components → NOT duplicates
 * - If all findings make different function calls → NOT duplicates
 */
export function filterDuplicateGroup(
  findings: SemanticFinding[],
  config: Partial<SemanticFilterConfig> = {},
): SemanticFilterResult {
  const cfg = { ...DEFAULT_SEMANTIC_CONFIG, ...config };

  if (findings.length < 2) {
    return { passed: true, confidence: 1.0 };
  }

  // 1. Check if all in different domains
  if (!cfg.allowCrossDomain) {
    const paths = findings.map((f) => f.file);
    if (areAllDifferentDomains(paths)) {
      return {
        passed: false,
        reason: 'Cross-domain: different route segments/domains',
        confidence: 0.95,
      };
    }
  }

  // 2. Check intents - if ANY has skippable intent, filter
  const intents = findings.map((f) => {
    const ctx: IntentContext = {
      name: f.metadata?.name,
      file: f.file,
      text: f.metadata?.normalizedBody ?? f.text,
      complexity: f.metadata?.complexity,
      jsxChildren: f.metadata?.jsxChildren,
      isFactoryGenerated: f.metadata?.isFactoryGenerated,
    };
    return detectIntent(ctx);
  });

  const hasSkippableIntent = intents.some((i) => cfg.skipIntents.includes(i.intent));

  if (hasSkippableIntent) {
    const skippedIntents = intents
      .filter((i) => cfg.skipIntents.includes(i.intent))
      .map((i) => i.intent);
    return {
      passed: false,
      reason: `Skippable intents: ${[...new Set(skippedIntents)].join(', ')}`,
      confidence: 0.9,
    };
  }

  // 3. Check complexity - if ANY is below threshold, filter
  const complexities = findings.map((f) => f.metadata?.complexity ?? 0);
  const allBelowThreshold = complexities.every((c) => c < cfg.minComplexity);
  if (allBelowThreshold && complexities.some((c) => c > 0)) {
    return {
      passed: false,
      reason: `All below complexity threshold: ${cfg.minComplexity}`,
      confidence: 0.85,
    };
  }

  // 4. Check JSX children - if all render different components, filter
  if (cfg.checkJsxChildren) {
    const bodies = findings.map((f) => f.metadata?.normalizedBody ?? f.text).filter(Boolean);

    if (bodies.length >= 2 && allRenderDifferentComponents(bodies)) {
      return {
        passed: false,
        reason: 'All render different JSX components',
        confidence: 0.9,
      };
    }
  }

  // 5. Check call graph - if all make different calls, filter
  if (cfg.checkCallGraph) {
    const bodies = findings.map((f) => f.metadata?.normalizedBody ?? f.text).filter(Boolean);

    if (bodies.length >= 2 && allMakeDifferentCalls(bodies)) {
      return {
        passed: false,
        reason: 'All make different function/component calls',
        confidence: 0.85,
      };
    }
  }

  return { passed: true, confidence: 1.0 };
}

/**
 * Filter an array of findings through semantic analysis.
 */
export function filterWithSemantics<T extends SemanticFinding>(
  findings: T[],
  config: Partial<SemanticFilterConfig> = {},
): { passed: T[]; filtered: T[]; results: Map<T, SemanticFilterResult> } {
  const passed: T[] = [];
  const filtered: T[] = [];
  const results = new Map<T, SemanticFilterResult>();

  for (const finding of findings) {
    const result = applySemanticFilter(finding, config);
    results.set(finding, result);

    if (result.passed) {
      passed.push(finding);
    } else {
      filtered.push(finding);
    }
  }

  return { passed, filtered, results };
}
