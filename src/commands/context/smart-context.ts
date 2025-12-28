/**
 * @module commands/context/smart-context
 * @description Smart context builder using PageRank-based file ranking
 *
 * Creates a repository map showing the most important files for the given
 * feature/domains, ranked by symbol connections and references.
 *
 * The smart context system:
 * 1. Builds a symbol graph from source files
 * 2. Ranks files using PageRank with domain personalization
 * 3. Extracts signatures from top-ranked files
 * 4. Formats output as XML within a token budget
 */

import { countTokens, fitToBudget } from '@/lib/@tokens';
import {
  buildSymbolGraph,
  formatRepoMapXml,
  type RankedFile,
  rankFiles,
  type Signature,
  type SymbolGraph,
} from './repomap';
import type { ContextOptions } from './types';

// =====================================================
// CONSTANTS
// =====================================================

/** Default token budget for repository map output */
export const DEFAULT_REPO_MAP_BUDGET = 4000;

/** Maximum number of files to include in the repo map */
const MAX_FILES_TO_INCLUDE = 50;

/** Maximum signatures per file in default mode */
const MAX_SIGNATURES_PER_FILE_DEFAULT = 10;

/** Maximum signatures per file when fitting to budget */
const MAX_SIGNATURES_PER_FILE_BUDGET = 5;

/** Directories to include in symbol graph scanning */
const INCLUDE_DIRS = ['src', 'packages', 'apps'];

/** Directories to exclude from symbol graph scanning */
const EXCLUDE_DIRS = ['node_modules', 'dist', '.git', '.next', 'coverage', '__tests__'];

// =====================================================
// TYPES
// =====================================================

/** Tag definition extracted from source file */
interface TagDefinition {
  /** Symbol name */
  name: string;
  /** Symbol type (function, class, interface, etc.) */
  type: string;
  /** Line number in file */
  line: number;
  /** Whether the symbol is exported */
  isExported?: boolean;
}

/** Symbol graph with file-to-tags mapping */
interface FileTagsGraph {
  /** Number of files scanned */
  filesScanned: number;
  /** Map of relative file path to extracted tags */
  fileToTags: Map<string, TagDefinition[]>;
}

// =====================================================
// MAIN FUNCTION
// =====================================================

/**
 * Build smart context using PageRank-based file ranking
 *
 * Creates a repository map showing the most important files for the given
 * feature/domains, ranked by symbol connections and references.
 *
 * @param projectRoot - Project root directory
 * @param domains - Detected domains for context (e.g., ['booking', 'auth'])
 * @param options - Context options including budget and feature
 * @returns Formatted XML repo map string, empty string if no files found
 *
 * @example
 * ```typescript
 * const repoMap = await buildSmartContext(
 *   '/path/to/project',
 *   ['booking', 'crm'],
 *   { budget: 5000, feature: 'booking' }
 * );
 * console.log(repoMap);
 * // <repo-map>
 * //   <file path="src/booking/index.ts">
 * //     <signature line="5">export function createBooking()</signature>
 * //   </file>
 * // </repo-map>
 * ```
 */
export async function buildSmartContext(
  projectRoot: string,
  domains: string[],
  options: ContextOptions,
): Promise<string> {
  const budget = options.budget ?? DEFAULT_REPO_MAP_BUDGET;

  // Build symbol graph from source files
  const graph = await buildSymbolGraph(projectRoot, {
    include: INCLUDE_DIRS,
    exclude: EXCLUDE_DIRS,
  });

  // Skip if no files found
  if (graph.filesScanned === 0) {
    return '';
  }

  // Rank files using PageRank with domain personalization
  const rankOptions: { feature?: string; domains?: string[] } = {};
  if (options.feature) {
    rankOptions.feature = options.feature;
  }
  if (domains.length > 0) {
    rankOptions.domains = domains;
  }
  const rankedFiles = rankFiles(graph, rankOptions);

  // Extract signatures from top ranked files
  const filesToInclude = rankedFiles.slice(0, MAX_FILES_TO_INCLUDE);
  const signatures = extractSignaturesForRankedFiles(filesToInclude, graph);

  // Format as XML
  const xmlOutput = formatRepoMapXml(filesToInclude, signatures, {
    showScores: false,
    maxSignaturesPerFile: MAX_SIGNATURES_PER_FILE_DEFAULT,
  });

  // Fit to budget if needed
  const tokens = countTokens(xmlOutput);

  if (tokens > budget) {
    // Reduce files until we fit
    const result = fitToBudget(
      filesToInclude.map((f) => f.path),
      (files) => {
        const subset = filesToInclude.filter((f) => files.includes(f.path));
        return formatRepoMapXml(subset, signatures, {
          showScores: false,
          maxSignaturesPerFile: MAX_SIGNATURES_PER_FILE_BUDGET,
        });
      },
      budget,
    );
    return result.output;
  }

  return xmlOutput;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Extract signatures for ranked files from the symbol graph
 *
 * Converts tag definitions from the symbol graph into signature objects
 * suitable for XML formatting. Only exported symbols are included.
 *
 * @param rankedFiles - Array of PageRank-ranked files
 * @param graph - Symbol graph containing file-to-tags mapping
 * @returns Map of file path to array of signatures
 *
 * @example
 * ```typescript
 * const signatures = extractSignaturesForRankedFiles(rankedFiles, graph);
 * // Map {
 * //   'src/booking/index.ts' => [
 * //     { name: 'createBooking', type: 'function', text: 'function createBooking()' }
 * //   ]
 * // }
 * ```
 */
export function extractSignaturesForRankedFiles(
  rankedFiles: RankedFile[],
  graph: FileTagsGraph | SymbolGraph,
): Map<string, Signature[]> {
  const signatures = new Map<string, Signature[]>();
  const maxSignaturesPerFile = 15;

  for (const { path: relPath } of rankedFiles) {
    const tags = graph.fileToTags.get(relPath);
    if (!tags) continue;

    // Convert definition tags to signatures (only exported symbols)
    const fileSigs: Signature[] = tags
      .filter((tag) => tag.isExported === true)
      .slice(0, maxSignaturesPerFile)
      .map((tag) => ({
        file: relPath,
        line: tag.line,
        text: formatTagAsSignature(tag),
        type: tag.type as Signature['type'],
        name: tag.name,
        isExported: true,
      }));

    if (fileSigs.length > 0) {
      signatures.set(relPath, fileSigs);
    }
  }

  return signatures;
}

/**
 * Format a tag definition as a human-readable signature string
 *
 * Converts tag type and name into a TypeScript-like signature.
 *
 * @param tag - Tag definition with name and type
 * @returns Formatted signature string
 *
 * @example
 * ```typescript
 * formatTagAsSignature({ name: 'MyClass', type: 'class' })
 * // => 'class MyClass'
 *
 * formatTagAsSignature({ name: 'getData', type: 'function' })
 * // => 'function getData()'
 *
 * formatTagAsSignature({ name: 'onClick', type: 'method' })
 * // => 'onClick()'
 * ```
 */
export function formatTagAsSignature(tag: { name: string; type: string }): string {
  switch (tag.type) {
    case 'function':
      return `function ${tag.name}()`;
    case 'class':
      return `class ${tag.name}`;
    case 'interface':
      return `interface ${tag.name}`;
    case 'type':
      return `type ${tag.name}`;
    case 'const':
      return `const ${tag.name}`;
    case 'method':
      return `${tag.name}()`;
    default:
      return tag.name;
  }
}
