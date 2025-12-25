/**
 * @module lib/@docs-cache/fetcher
 * @description Context7 API integration for fetching library documentation
 */

import {
  type CodeSnippet,
  Context7Client,
  type GetDocsOptions,
  hasContext7ApiKey,
  type SearchResult,
} from './context7-client';
import { getLibrary, saveLibrary, saveSection } from './storage';
import type { DocSection } from './types';

// Default TTL: 7 days in milliseconds
export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Known library mappings for quick resolution
const KNOWN_LIBRARIES: Record<string, string> = {
  next: '/vercel/next.js',
  'next.js': '/vercel/next.js',
  nextjs: '/vercel/next.js',
  prisma: '/prisma/docs',
  '@prisma/client': '/prisma/docs',
  trpc: '/trpc/trpc',
  '@trpc/server': '/trpc/trpc',
  '@trpc/client': '/trpc/trpc',
  react: '/facebook/react',
  typescript: '/microsoft/TypeScript',
  zod: '/colinhacks/zod',
  tailwindcss: '/tailwindlabs/tailwindcss.com',
  tailwind: '/tailwindlabs/tailwindcss.com',
  drizzle: '/drizzle-team/drizzle-orm',
  'drizzle-orm': '/drizzle-team/drizzle-orm',
  expo: '/expo/expo',
  'react-native': '/facebook/react-native',
  zustand: '/pmndrs/zustand',
  'tanstack-query': '/TanStack/query',
  '@tanstack/react-query': '/TanStack/query',
};

/**
 * Resolve library name to Context7 ID
 * Uses known mappings first, then could call Context7 resolve API
 */
export function resolveLibraryId(libraryName: string): string | null {
  const normalized = libraryName.toLowerCase().trim();

  // Check known mappings
  if (KNOWN_LIBRARIES[normalized]) {
    return KNOWN_LIBRARIES[normalized];
  }

  // If already looks like a Context7 ID (starts with /)
  if (normalized.startsWith('/')) {
    return normalized;
  }

  // For unknown libraries, return null (caller should try Context7 resolve)
  return null;
}

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
    let match;
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
 * Check if a library ID is valid
 */
export function isValidLibraryId(id: string): boolean {
  return id.startsWith('/') && id.split('/').length >= 3;
}

// ============================================================================
// Fetch and Cache Functions
// ============================================================================

export interface FetchDocsOptions {
  topic?: string | undefined;
  mode?: 'code' | 'info' | undefined;
  maxPages?: number | undefined;
  force?: boolean | undefined;
}

export interface FetchDocsResult {
  libraryId: string;
  libraryName: string;
  sectionsAdded: number;
  totalSnippets: number;
  fromCache: boolean;
  pages: number;
}

/**
 * Check if Context7 API is available
 */
export { hasContext7ApiKey };

/**
 * Search for a library using Context7 API
 */
export async function searchLibrary(query: string): Promise<SearchResult[]> {
  if (!hasContext7ApiKey()) {
    throw new Error('CONTEXT7_API_KEY not set');
  }

  const client = new Context7Client();
  const response = await client.searchLibrary(query);
  return response.results;
}

/**
 * Fetch documentation from Context7 and cache it
 */
export async function fetchAndCacheDocs(
  libraryName: string,
  options: FetchDocsOptions = {},
): Promise<FetchDocsResult> {
  const { topic, mode = 'code', maxPages = 3, force = false } = options;

  // Resolve library ID
  let libraryId = resolveLibraryId(libraryName);

  if (!libraryId) {
    // Try to search for it
    if (!hasContext7ApiKey()) {
      throw new Error(`Unknown library: ${libraryName}. Set CONTEXT7_API_KEY to search.`);
    }

    const results = await searchLibrary(libraryName);
    if (results.length === 0) {
      throw new Error(`Library not found: ${libraryName}`);
    }

    // Use the first result
    libraryId = results[0]!.id;
  }

  // Check if already cached and not expired
  if (!force) {
    const cached = getLibrary(libraryId);
    if (cached && !cached.isExpired) {
      return {
        libraryId,
        libraryName: cached.name,
        sectionsAdded: 0,
        totalSnippets: cached.totalSnippets,
        fromCache: true,
        pages: 0,
      };
    }
  }

  if (!hasContext7ApiKey()) {
    throw new Error('CONTEXT7_API_KEY not set');
  }

  const client = new Context7Client();
  const displayName = getLibraryDisplayName(libraryId);

  // Save library entry first
  saveLibrary(libraryId, displayName);

  let sectionsAdded = 0;
  let totalSnippets = 0;
  let currentPage = 1;
  let hasMore = true;

  // Fetch pages (API limit is 10 items per page)
  while (hasMore && currentPage <= maxPages) {
    const docsOptions: GetDocsOptions = {
      mode,
      page: currentPage,
      limit: 10,
    };

    if (topic) {
      docsOptions.topic = topic;
    }

    const response = await client.getDocs(libraryId, docsOptions);

    // Process snippets (code mode)
    if ('snippets' in response && Array.isArray(response.snippets)) {
      for (const snippet of response.snippets as CodeSnippet[]) {
        const codeSnippets = snippet.codeList?.map((c) => c.code) || [];

        saveSection(
          libraryId,
          topic,
          snippet.codeTitle || snippet.pageTitle,
          snippet.codeDescription,
          codeSnippets,
          currentPage,
        );

        sectionsAdded++;
        totalSnippets += codeSnippets.length;
      }
    }

    hasMore = response.pagination?.hasNext ?? false;
    currentPage++;
  }

  return {
    libraryId,
    libraryName: displayName,
    sectionsAdded,
    totalSnippets,
    fromCache: false,
    pages: currentPage - 1,
  };
}
