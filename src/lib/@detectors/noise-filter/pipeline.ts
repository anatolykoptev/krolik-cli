/**
 * @module lib/@detectors/noise-filter/pipeline
 * @description Noise Filter Pipeline Orchestrator
 *
 * 5-stage pipeline:
 * - Stage 0: Skip Filter (fast path for vendor/dist files)
 * - Stage 1: Generated File Filter
 * - Stage 2: Semantic Context Filter
 * - Stage 3: Content Deduplicator
 * - Stage 4: Confidence Scoring
 */

import { scoreFindings } from './confidence';
import { deduplicateFindings } from './deduplication';
import { detectGeneratedFile } from './generated';
import { applySemanticFilter, type SemanticFilterConfig } from './stages/semantic';
import { shouldSkip } from './stages/skip';
import type {
  DuplicateGroup,
  FilteredResult,
  FilterStats,
  Finding,
  NoiseFilterConfig,
  ScoredFinding,
  ScoringContext,
} from './types';

/** Extended configuration with semantic filter options */
export interface ExtendedNoiseFilterConfig extends NoiseFilterConfig {
  /** Enable skip filter (Stage 0) */
  enableSkipFilter: boolean;
  /** Enable semantic filter (Stage 2) */
  enableSemanticFilter: boolean;
  /** Semantic filter configuration */
  semantic: Partial<SemanticFilterConfig>;
}

/** Default configuration */
const DEFAULTS: ExtendedNoiseFilterConfig = {
  enableSkipFilter: true,
  enableSemanticFilter: true,
  semantic: {},
  excludeGenerated: true,
  generatedConfidenceThreshold: 0.7,
  deduplicate: true,
  deduplicationSimilarity: 0.8,
  minConfidence: 0.5,
  minRelevance: 0.3,
  maxFindingsPerCategory: 20,
  maxFindingsPerFile: 5,
};

/** Extended stats with all stages */
export interface ExtendedFilterStats extends FilterStats {
  afterSkip: number;
  afterSemantic: number;
}

/** Extended result with semantic filtering info */
export interface ExtendedFilteredResult<T> extends FilteredResult<T> {
  removed: FilteredResult<T>['removed'] & {
    skipped: T[];
    semantic: T[];
  };
  stats: ExtendedFilterStats;
}

/**
 * Run the full noise filter pipeline
 *
 * @param findings - Raw findings to filter
 * @param config - Pipeline configuration (merged with defaults)
 * @param context - Scoring context (feature, recent files)
 * @returns Filtered and scored findings with statistics
 */
export function filterNoise<T extends Finding>(
  findings: T[],
  config?: Partial<ExtendedNoiseFilterConfig>,
  context?: ScoringContext,
): ExtendedFilteredResult<T> {
  const cfg = { ...DEFAULTS, ...config };
  const stats: ExtendedFilterStats = {
    input: findings.length,
    afterSkip: findings.length,
    afterGenerated: findings.length,
    afterSemantic: findings.length,
    afterDedup: findings.length,
    afterScoring: findings.length,
    output: 0,
  };

  const removed: ExtendedFilteredResult<T>['removed'] = {
    skipped: [],
    generated: [],
    semantic: [],
    duplicates: [],
    lowConfidence: [],
  };

  let current = [...findings];

  // Stage 0: Skip Filter (fast path)
  if (cfg.enableSkipFilter) {
    const filtered: T[] = [];
    for (const finding of current) {
      const result = shouldSkip(finding.file);
      if (result.skip) {
        removed.skipped.push(finding);
      } else {
        filtered.push(finding);
      }
    }
    current = filtered;
    stats.afterSkip = current.length;
  }

  // Stage 1: Filter generated files
  if (cfg.excludeGenerated) {
    const filtered: T[] = [];
    for (const finding of current) {
      const result = detectGeneratedFile(finding.file);
      if (result.confidence >= cfg.generatedConfidenceThreshold) {
        removed.generated.push(finding);
      } else {
        filtered.push(finding);
      }
    }
    current = filtered;
    stats.afterGenerated = current.length;
  }

  // Stage 2: Semantic Filter
  if (cfg.enableSemanticFilter) {
    const filtered: T[] = [];
    for (const finding of current) {
      // Build semantic finding from generic finding
      const semanticFinding = {
        type: finding.type ?? 'unknown',
        file: finding.file,
        line: finding.line,
        text: finding.text,
        // Cast metadata safely - applySemanticFilter handles undefined gracefully
        metadata: (finding as { metadata?: unknown }).metadata as
          | {
              name?: string;
              complexity?: number;
              jsxChildren?: string[];
              calledComponents?: string[];
              calledFunctions?: string[];
              isFactoryGenerated?: boolean;
              normalizedBody?: string;
            }
          | undefined,
      };
      const result = applySemanticFilter(semanticFinding, cfg.semantic);
      if (result.passed) {
        filtered.push(finding);
      } else {
        removed.semantic.push(finding);
      }
    }
    current = filtered;
    stats.afterSemantic = current.length;
  }

  // Stage 3: Deduplicate
  let duplicateGroups: DuplicateGroup<T>[] = [];
  if (cfg.deduplicate && current.length > 0) {
    const dedupResult = deduplicateFindings(current, {
      byContent: true,
      minSimilarity: cfg.deduplicationSimilarity,
    });
    current = dedupResult.unique;
    duplicateGroups = dedupResult.duplicates;
    removed.duplicates = duplicateGroups;
    stats.afterDedup = current.length;
  }

  // Stage 4: Score and filter by confidence
  let scored: ScoredFinding<T>[] = [];
  if (current.length > 0) {
    scored = scoreFindings(current, context);

    // Filter by min confidence and relevance
    const passing = scored.filter(
      (s) => s.confidence >= cfg.minConfidence && s.relevance >= cfg.minRelevance,
    );
    removed.lowConfidence = scored
      .filter((s) => s.confidence < cfg.minConfidence || s.relevance < cfg.minRelevance)
      .map((s) => s.finding);

    scored = passing;
    stats.afterScoring = scored.length;
  }

  // Apply limits
  const limited = applyLimits(scored, cfg);
  stats.output = limited.length;

  return {
    findings: limited,
    stats,
    removed,
  };
}

/**
 * Apply per-category and per-file limits
 */
function applyLimits<T extends Finding>(
  scored: ScoredFinding<T>[],
  config: NoiseFilterConfig,
): ScoredFinding<T>[] {
  // Group by file and apply per-file limit
  const byFile = new Map<string, ScoredFinding<T>[]>();
  for (const item of scored) {
    const file = item.finding.file;
    const existing = byFile.get(file) ?? [];
    if (existing.length < config.maxFindingsPerFile) {
      existing.push(item);
      byFile.set(file, existing);
    }
  }

  // Flatten and apply total limit
  const flattened = [...byFile.values()].flat();
  return flattened.slice(0, config.maxFindingsPerCategory);
}

/**
 * Quick filter for generated files only
 */
export function filterGeneratedFindings<T extends Finding>(
  findings: T[],
  threshold = 0.7,
): { passed: T[]; removed: T[] } {
  const passed: T[] = [];
  const removed: T[] = [];

  for (const finding of findings) {
    const result = detectGeneratedFile(finding.file);
    if (result.confidence >= threshold) {
      removed.push(finding);
    } else {
      passed.push(finding);
    }
  }

  return { passed, removed };
}
