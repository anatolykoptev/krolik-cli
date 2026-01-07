/**
 * @module config
 * @description Configuration exports
 */

export { findProjectRoot } from '../lib/@discovery/project';
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
  detectSrcPaths,
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
export { clearConfigCache, defineConfig, getConfig, loadConfig } from './loader';
