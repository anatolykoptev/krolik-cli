/**
 * @module lib/discovery/architecture
 * @description Architecture pattern detection for TypeScript/JavaScript projects
 *
 * Provides utilities to analyze project structure and detect common
 * architectural patterns like tRPC routers, React components, feature modules, etc.
 *
 * @example
 * ```typescript
 * import { collectArchitecturePatterns } from '@/lib/discovery/architecture';
 *
 * const patterns = collectArchitecturePatterns('/path/to/project');
 *
 * console.log(patterns.projectType); // 'monorepo' | 'single-app'
 *
 * for (const pattern of patterns.patterns) {
 *   console.log(`${pattern.name}: ${pattern.count} instances`);
 *   console.log(`  Examples: ${pattern.examples.join(', ')}`);
 * }
 * ```
 */

// Detectors
export {
  // Individual detectors
  apiEndpointsDetector,
  cliCommandsDetector,
  // Detector collections
  DEFAULT_DETECTORS,
  featureModulesDetector,
  getDetectorById,
  getDetectorsByCategory,
  hooksDetector,
  mcpToolsDetector,
  middlewareDetector,
  nextApiRoutesDetector,
  prismaSchemaDetector,
  reactComponentsDetector,
  servicesDetector,
  sharedLibDetector,
  stateStoresDetector,
  trpcRoutersDetector,
  validationSchemasDetector,
} from './detectors';
// Main API
export { collectArchitecturePatterns } from './scanner';
// Types
export type {
  ArchitecturePatterns,
  ArchitectureScanOptions,
  DetectedPattern,
  PatternDetector,
  ProjectType,
  ScanResult,
} from './types';
// Constants
export {
  ARCHITECTURE_SKIP_DIRS,
  DEFAULT_MAX_DEPTH,
  MAX_CONTENT_CHECK_SIZE,
  MAX_EXAMPLES,
} from './types';
