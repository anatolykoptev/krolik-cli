/**
 * @module config
 * @description Configuration exports
 */

export { loadConfig, getConfig, clearConfigCache, defineConfig, findProjectRoot } from './loader';
export { createDefaultConfig, DEFAULT_PATHS, DEFAULT_FEATURES, DEFAULT_EXCLUDE, DEFAULT_EXTENSIONS } from './defaults';
export { detectAll, detectFeatures, detectPaths, detectPrisma, detectTrpc, detectProjectName } from './detect';
