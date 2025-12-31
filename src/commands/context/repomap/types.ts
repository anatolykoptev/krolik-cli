/**
 * @module commands/context/repomap/types
 * @description Types for Smart Context / RepoMap system
 *
 * Based on Aider's RepoMap architecture for intelligent context selection.
 */

// Tag represents a symbol definition or reference in the codebase
export interface Tag {
  /** Relative file path */
  relPath: string;
  /** Symbol name (function, class, type, etc.) */
  name: string;
  /** Definition or reference */
  kind: 'def' | 'ref';
  /** Line number (1-based) */
  line: number;
  /** Symbol type */
  type: 'class' | 'function' | 'const' | 'type' | 'interface' | 'export' | 'method' | 'property';
  /** End line for multi-line definitions */
  endLine?: number;
  /** Export visibility */
  isExported?: boolean;
}

// Extend ImportGraph with symbol-level tracking
export interface SymbolGraph {
  /** All tags (definitions and references) */
  tags: Tag[];
  /** Map: symbol name → files that define it */
  definitions: Map<string, string[]>;
  /** Map: symbol name → files that reference it */
  references: Map<string, string[]>;
  /** Map: file path → tags in that file */
  fileToTags: Map<string, Tag[]>;
  /** Total files scanned */
  filesScanned: number;
  /** Scan duration in ms */
  scanDurationMs: number;
}

// Signature represents a condensed view of a symbol
export interface Signature {
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Signature text (one line, no body) */
  text: string;
  /** Symbol type */
  type: 'class' | 'function' | 'type' | 'interface' | 'const' | 'method';
  /** Symbol name */
  name: string;
  /** Is exported */
  isExported: boolean;
  /** Number of references to this symbol (for usage-based sorting) */
  refs?: number;
}

// Ranked file with PageRank score
export interface RankedFile {
  path: string;
  rank: number;
  /** Number of definitions in this file */
  defCount: number;
  /** Number of references to symbols in this file */
  refCount: number;
}

// Options for building the repo map
export interface RepoMapOptions {
  /** Token budget for output */
  budget?: number;
  /** Feature/domain to focus on */
  feature?: string;
  /** Related domains to include */
  domains?: string[];
  /** Only output signatures */
  signaturesOnly?: boolean;
  /** PageRank damping factor */
  damping?: number;
  /** PageRank iterations */
  iterations?: number;
  /** File patterns to include */
  include?: string[];
  /** File patterns to exclude */
  exclude?: string[];
}

// Result of building a repo map
export interface RepoMapResult {
  /** Formatted output (markdown/tree-style) */
  output: string;
  /** Statistics */
  stats: {
    filesRanked: number;
    filesIncluded: number;
    tokensUsed: number;
    topFiles: string[];
    buildTimeMs: number;
  };
  /** Raw ranked files (for debugging) */
  rankedFiles: RankedFile[];
}
