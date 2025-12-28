/**
 * @module commands/context/repomap
 * @description Smart Context / RepoMap system barrel exports
 */

export { formatRepoMap, formatRepoMapXml, formatStats } from './formatter.js';
export type { ExtractorOptions } from './tag-extractor.js';
export {
  buildSymbolGraph,
  buildSymbolGraphSync,
  extractFileTags,
  getExportedSymbols,
  getFileSignatures,
} from './tag-extractor.js';
export type {
  RankedFile,
  RepoMapOptions,
  RepoMapResult,
  Signature,
  SymbolGraph,
  Tag,
} from './types.js';
