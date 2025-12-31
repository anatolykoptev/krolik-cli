/**
 * @module lib/@detectors/noise-filter/extractors
 * @description Semantic Feature Extractors
 *
 * Extractors for semantic code analysis:
 * - Intent detection (route-handler, wrapper, factory, etc.)
 * - Domain boundary detection
 * - Call graph extraction
 * - JSX children extraction
 */

// Call Graph
export {
  allMakeDifferentCalls,
  type CallGraphResult,
  type CallNode,
  compareCallGraphs,
  extractCallGraph,
  getCallSignature,
  haveSameCalls,
} from './call-graph';

// Domain Boundaries
export {
  areAllDifferentDomains,
  areDifferentDomains,
  areDifferentRouteSegments,
  type DomainContext,
  type DomainLayer,
  extractDomain,
  extractRouteSegment,
  groupByDomain,
} from './domain';
// Intent Detection
export {
  detectIntent,
  type FunctionIntent,
  getDefaultSkipIntents,
  hasSkippableIntent,
  type IntentContext,
  type IntentResult,
  shouldSkipIntent,
} from './intent';

// JSX Children
export {
  allRenderDifferentComponents,
  extractJSXChildren,
  getMainComponent,
  haveSameJSXChildren,
  isSingleComponentWrapper,
  type JSXChildrenResult,
} from './jsx-children';
