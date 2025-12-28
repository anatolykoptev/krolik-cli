/**
 * @module lib/integrations/context7/fetcher/parse
 * @description Documentation parsing and validation utilities
 */

import type { DocSection } from '../types';

/**
 * Parse Context7 documentation response into sections
 */
export function parseDocsResponse(
  content: string,
  libraryId: string,
  topic?: string,
  pageNumber: number = 1,
): DocSection[] {
  const sections: DocSection[] = [];

  // Split by headers (## or ###)
  const parts = content.split(/(?=^#{2,3}\s)/m);

  for (const part of parts) {
    if (!part.trim()) continue;

    // Extract title from first line
    const titleMatch = part.match(/^#{2,3}\s+(.+)$/m);
    const title = titleMatch?.[1] ?? 'Documentation';

    // Extract code snippets
    const codeSnippets: string[] = [];
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = codeBlockRegex.exec(part)) !== null) {
      const snippet = match[1];
      if (snippet) codeSnippets.push(snippet.trim());
    }

    sections.push({
      id: 0, // Will be set by database
      libraryId,
      topic,
      title: title.trim(),
      content: part.trim(),
      codeSnippets,
      pageNumber,
    });
  }

  return sections;
}

/**
 * Get library display name from Context7 ID
 */
export function getLibraryDisplayName(libraryId: string): string {
  // "/vercel/next.js" -> "next.js"
  const parts = libraryId.split('/');
  return parts[parts.length - 1] || libraryId;
}

/**
 * Check if a library ID is valid Context7 format
 */
export function isValidLibraryId(id: string): boolean {
  return id.startsWith('/') && id.split('/').length >= 3;
}
