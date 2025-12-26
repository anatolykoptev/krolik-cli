/**
 * @module commands/codegen/services/types
 * @description Types for docs-enhanced code generation
 */

/** Code snippet from cached documentation */
export interface CodeSnippet {
  code: string;
  library: string;
  relevance: number;
  topic?: string | undefined;
}

/** Import suggestion derived from docs */
export interface ImportSuggestion {
  statement: string;
  package: string;
  typeOnly: boolean;
}

/** Pattern hint from documentation */
export interface PatternHint {
  name: string;
  description: string;
  example: string;
}

/** Hints derived from documentation for template enhancement */
export interface DocHints {
  snippets: CodeSnippet[];
  imports: ImportSuggestion[];
  patterns: PatternHint[];
  sources: string[];
  /** Whether docs were found and used */
  enhanced: boolean;
}

/** Search strategy for a generator type */
export interface SearchStrategy {
  queries: string[];
  preferredLibraries?: string[];
  maxSnippets: number;
}

/** Empty hints for fallback */
export function emptyHints(): DocHints {
  return { snippets: [], imports: [], patterns: [], sources: [], enhanced: false };
}
