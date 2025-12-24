/**
 * @module config
 * @description Configuration exports
 */

export {
  createDefaultConfig,
  DEFAULT_EXCLUDE,
  DEFAULT_EXTENSIONS,
  DEFAULT_FEATURES,
  DEFAULT_PATHS,
} from './defaults';
export type { MonorepoPackage } from './detect';
export {
  detectAll,
  detectFeatures,
  detectMonorepoPackages,
  detectPaths,
  detectPrisma,
  detectProjectName,
  detectTrpc,
} from './detect';
// Domain utilities
export {
  DOMAIN_APPROACHES,
  DOMAIN_FILES,
  DOMAIN_KEYWORDS,
  detectDomains,
  getApproaches,
  getRelatedFiles,
} from './domains';
export { clearConfigCache, defineConfig, findProjectRoot, getConfig, loadConfig } from './loader';
