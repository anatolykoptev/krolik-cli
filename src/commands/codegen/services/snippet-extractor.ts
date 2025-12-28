/**
 * @module commands/codegen/services/snippet-extractor
 * @description Extract and process code snippets from cached docs
 */

import type { DocSearchResult } from '@/lib/storage/docs';
import type { CodeSnippet, ImportSuggestion, PatternHint } from './types';

/** Extract code snippets from search results */
export function extractSnippets(results: DocSearchResult[], limit: number): CodeSnippet[] {
  const snippets: CodeSnippet[] = [];

  for (const result of results) {
    const { section, libraryName, relevance } = result;

    for (const code of section.codeSnippets) {
      if (snippets.length >= limit) break;

      // Skip very short or very long snippets
      if (code.length < 20 || code.length > 2000) continue;

      snippets.push({
        code: code.trim(),
        library: libraryName,
        relevance,
        topic: section.topic,
      });
    }

    if (snippets.length >= limit) break;
  }

  // Sort by relevance
  return snippets.sort((a, b) => b.relevance - a.relevance);
}

/** Extract import statements from code snippets */
export function extractImports(snippets: CodeSnippet[]): ImportSuggestion[] {
  const imports: ImportSuggestion[] = [];
  const seen = new Set<string>();

  const importRegex = /^import\s+(?:type\s+)?(\{[^}]+\}|[\w*]+)\s+from\s+['"]([^'"]+)['"]/gm;

  for (const snippet of snippets) {
    let match: RegExpExecArray | null;
    importRegex.lastIndex = 0;

    while ((match = importRegex.exec(snippet.code)) !== null) {
      const statement = match[0];
      const pkg = match[2] as string;

      if (seen.has(statement)) continue;
      seen.add(statement);

      imports.push({
        statement,
        package: pkg,
        typeOnly: statement.includes('import type'),
      });
    }
  }

  return imports;
}

/** Identify common patterns from snippets */
export function extractPatterns(snippets: CodeSnippet[]): PatternHint[] {
  const patterns: PatternHint[] = [];

  // Pattern detection heuristics
  const patternMatchers: Array<{ name: string; regex: RegExp; description: string }> = [
    {
      name: 'error-handling',
      regex: /try\s*\{[\s\S]*catch/,
      description: 'Error handling with try/catch',
    },
    { name: 'async-await', regex: /async\s+\w+.*await/, description: 'Async/await pattern' },
    {
      name: 'zod-validation',
      regex: /z\.(object|string|number|array)/,
      description: 'Zod schema validation',
    },
    {
      name: 'trpc-procedure',
      regex: /\.(query|mutation|subscription)\(/,
      description: 'tRPC procedure definition',
    },
    {
      name: 'react-hook',
      regex: /^(export\s+)?function\s+use[A-Z]/,
      description: 'React custom hook',
    },
  ];

  for (const snippet of snippets) {
    for (const { name, regex, description } of patternMatchers) {
      if (regex.test(snippet.code) && !patterns.some((p) => p.name === name)) {
        patterns.push({
          name,
          description,
          example: snippet.code.slice(0, 200),
        });
      }
    }
  }

  return patterns;
}
