/**
 * @module lib/@integrations/context7/fetcher/types
 * @description Fetcher-specific type definitions
 */

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

export interface FetchWithTopicsOptions {
  topics?: string[] | undefined;
  usePreferredTopics?: boolean | undefined;
  mode?: 'code' | 'info' | undefined;
  pagesPerTopic?: number | undefined;
  force?: boolean | undefined;
}

export interface FetchWithTopicsResult {
  libraryId: string;
  libraryName: string;
  topics: string[];
  totalSections: number;
  totalSnippets: number;
  fromCache: boolean;
}
