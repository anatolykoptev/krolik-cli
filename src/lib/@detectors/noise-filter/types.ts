/**
 * Shared types for the noise-filter pipeline.
 * Handles finding deduplication, scoring, and generated file detection.
 */

/** Base finding interface that all findings must extend */
export interface Finding {
  file: string;
  line?: number;
  text: string;
  type?: string;
}

/** Signal detected during generated file analysis */
export interface GeneratedSignal {
  type: 'header' | 'path' | 'tool' | 'structure';
  pattern: string;
  weight: number;
  matched: boolean;
}

/** Result of generated file detection */
export interface GeneratedFileResult {
  isGenerated: boolean;
  confidence: number;
  signals: GeneratedSignal[];
  generator?: string;
}

/** Duplicate group after deduplication */
export interface DuplicateGroup<T> {
  fingerprint: string;
  representative: T;
  count: number;
  items: T[];
}

/** Statistics from deduplication process */
export interface DedupStats {
  total: number;
  unique: number;
  duplicateGroups: number;
  duplicatesRemoved: number;
}

/** Result of deduplication process */
export interface DedupResult<T> {
  unique: T[];
  duplicates: DuplicateGroup<T>[];
  stats: DedupStats;
}

/** Scoring breakdown for a finding */
export interface ScoringBreakdown {
  ownership: number;
  freshness: number;
  relevance: number;
  quality: number;
  actionability: number;
}

/** Finding with confidence score */
export interface ScoredFinding<T> {
  finding: T;
  score: number;
  confidence: number;
  relevance: number;
  factors: ScoringBreakdown;
}

/** Context for scoring */
export interface ScoringContext {
  feature?: string;
  recentFiles?: string[];
  projectRoot?: string;
}

/** Configuration for noise filter pipeline */
export interface NoiseFilterConfig {
  excludeGenerated: boolean;
  generatedConfidenceThreshold: number;
  deduplicate: boolean;
  deduplicationSimilarity: number;
  minConfidence: number;
  minRelevance: number;
  maxFindingsPerCategory: number;
  maxFindingsPerFile: number;
}

/** Statistics from filtering process */
export interface FilterStats {
  input: number;
  afterGenerated: number;
  afterDedup: number;
  afterScoring: number;
  output: number;
}

/** Result of the full noise filter pipeline */
export interface FilteredResult<T> {
  findings: ScoredFinding<T>[];
  stats: FilterStats;
  removed: {
    generated: T[];
    duplicates: DuplicateGroup<T>[];
    lowConfidence: T[];
  };
}

/** Default configuration values */
export const DEFAULT_NOISE_FILTER_CONFIG: NoiseFilterConfig = {
  excludeGenerated: true,
  generatedConfidenceThreshold: 0.7,
  deduplicate: true,
  deduplicationSimilarity: 0.8,
  minConfidence: 0.5,
  minRelevance: 0.3,
  maxFindingsPerCategory: 20,
  maxFindingsPerFile: 5,
};
