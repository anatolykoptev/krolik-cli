/**
 * @module commands/refactor/runner/registry-runner
 * @description Registry-based runner for refactor analysis
 *
 * This module demonstrates the new registry-based architecture:
 * 1. Analyzers register themselves and are run in dependency order
 * 2. Sections register themselves and format output based on analyzer results
 * 3. Full status tracking and debug output
 *
 * @example
 * ```typescript
 * import { runRegistryAnalysis } from './registry-runner';
 *
 * const output = await runRegistryAnalysis({
 *   projectRoot: '/path/to/project',
 *   targetPath: '/path/to/project/src/lib',
 *   verbose: true,
 * });
 *
 * console.log(output);
 * ```
 */

import { type AnalyzerContext, type AnalyzerResult, analyzerRegistry } from '../analyzers/registry';
import type { RefactorAnalysis } from '../core/types';
import type { ArchHealth } from '../core/types-ai';
import { getLimits, type SectionLimits } from '../output/limits';
import { type OutputLevel, type SectionContext, sectionRegistry } from '../output/registry';

// Import modules to trigger auto-registration
import '../analyzers/modules';
import '../output/sections/modules';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for registry-based analysis
 */
export interface RegistryRunnerOptions {
  /** Absolute path to project root */
  projectRoot: string;

  /** Absolute path to target directory being analyzed */
  targetPath: string;

  /** Base analysis from core refactor analysis */
  baseAnalysis?: RefactorAnalysis;

  /** Output verbosity level */
  outputLevel?: OutputLevel;

  /** Show verbose debug output */
  verbose?: boolean;

  /** Additional analyzer options */
  analyzerOptions?: Record<string, unknown>;
}

/**
 * Result of registry-based analysis
 */
export interface RegistryRunnerResult {
  /** Final formatted output (XML) */
  output: string;

  /** Map of analyzer ID to result */
  analyzerResults: Map<string, AnalyzerResult<unknown>>;

  /** Execution statistics */
  stats: {
    analyzersRun: number;
    analyzersSkipped: number;
    analyzersFailed: number;
    totalDurationMs: number;
  };
}

// ============================================================================
// RUNNER
// ============================================================================

/**
 * Run analysis using the registry-based architecture.
 *
 * This is the main entry point for the new architecture.
 * It runs all registered analyzers and formats output using sections.
 *
 * @param options - Runner options
 * @returns Analysis result with output and statistics
 */
export async function runRegistryAnalysis(
  options: RegistryRunnerOptions,
): Promise<RegistryRunnerResult> {
  const {
    projectRoot,
    targetPath,
    baseAnalysis,
    outputLevel = 'standard',
    verbose = false,
    analyzerOptions = {},
  } = options;

  const startTime = performance.now();

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Create analyzer context
  // ─────────────────────────────────────────────────────────────────────────

  const analyzerContext: AnalyzerContext = {
    projectRoot,
    targetPath,
    baseAnalysis: baseAnalysis ?? createEmptyBaseAnalysis(targetPath),
    options: {
      ...analyzerOptions,
      verbose,
    },
    ...(verbose && {
      logger: {
        warn: (msg: string) => console.warn(`[WARN] ${msg}`),
      },
    }),
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Run all analyzers
  // ─────────────────────────────────────────────────────────────────────────

  if (verbose) {
    console.log('\n┌─────────────────────────────────────────┐');
    console.log(`Registered analyzers: ${analyzerRegistry.size}`);
  }

  const analyzerResults = await analyzerRegistry.runAll(analyzerContext);

  // ─────────────────────────────────────────────────────────────────────────
  // 2.1 Extract results and re-run dependent analyzers with enriched context
  // ─────────────────────────────────────────────────────────────────────────

  // Extract data from completed analyzers
  const projectContextResult = analyzerResults.get('project-context');
  const archResult = analyzerResults.get('architecture');
  const domainsResult = analyzerResults.get('domains');

  const projectContext =
    projectContextResult?.status === 'success' ? projectContextResult.data : undefined;
  const archHealth = archResult?.status === 'success' ? (archResult.data as ArchHealth) : undefined;
  const domains = domainsResult?.status === 'success' ? domainsResult.data : undefined;

  // Create enriched context with all extracted data
  const enrichedContext: AnalyzerContext = {
    ...analyzerContext,
    options: {
      ...analyzerContext.options,
      projectContext,
      archHealth,
      domains,
      ...(archHealth && { dependencyGraph: archHealth.dependencyGraph }),
    },
  };

  // Re-run analyzers that depend on extracted data
  const dependentAnalyzers = [
    { id: 'ranking', needsDependencyGraph: true },
    { id: 'navigation', needsProjectContext: true },
    { id: 'migration', needsArchHealth: true },
    { id: 'recommendations', needsArchAndDomains: true },
  ];

  for (const {
    id,
    needsDependencyGraph,
    needsProjectContext,
    needsArchHealth,
    needsArchAndDomains,
  } of dependentAnalyzers) {
    const result = analyzerResults.get(id);

    // Check if analyzer was skipped due to missing dependencies
    if (result?.status === 'skipped') {
      const shouldRerun =
        (needsDependencyGraph &&
          archHealth &&
          Object.keys(archHealth.dependencyGraph).length > 0) ||
        (needsProjectContext && projectContext) ||
        (needsArchHealth && archHealth) ||
        (needsArchAndDomains && archHealth && domains);

      if (shouldRerun) {
        const analyzer = analyzerRegistry.get(id);
        if (analyzer) {
          const startMs = performance.now();
          const newResult = await analyzer.analyze(enrichedContext);
          newResult.durationMs = performance.now() - startMs;
          analyzerResults.set(id, newResult);
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Log analyzer summary (verbose mode)
  // ─────────────────────────────────────────────────────────────────────────

  if (verbose) {
    logAnalyzerSummary(analyzerResults);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Create section context
  // ─────────────────────────────────────────────────────────────────────────

  const limits: SectionLimits = getLimits(outputLevel);

  const sectionContext: SectionContext = {
    results: analyzerResults,
    limits,
    outputLevel,
    options: analyzerOptions,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Format output
  // ─────────────────────────────────────────────────────────────────────────

  if (verbose) {
    console.log('\n┌─────────────────────────────────────────┐');
    console.log('│         SECTION RENDERING               │');
    console.log('└─────────────────────────────────────────┘\n');
    console.log(`Registered sections: ${sectionRegistry.size}`);
    console.log(`IDs: ${sectionRegistry.ids().join(', ')}\n`);
  }

  const lines = sectionRegistry.formatAll(sectionContext);

  // Wrap in XML document
  const output = wrapInXml(lines, outputLevel, targetPath);

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Calculate statistics
  // ─────────────────────────────────────────────────────────────────────────

  const stats = calculateStats(analyzerResults, startTime);

  if (verbose) {
    console.log('\n┌─────────────────────────────────────────┐');
    console.log('│         EXECUTION SUMMARY               │');
    console.log('└─────────────────────────────────────────┘\n');
    console.log(`Analyzers run: ${stats.analyzersRun}`);
    console.log(`Analyzers skipped: ${stats.analyzersSkipped}`);
    console.log(`Analyzers failed: ${stats.analyzersFailed}`);
    console.log(`Total duration: ${stats.totalDurationMs.toFixed(0)}ms\n`);
  }

  return {
    output,
    analyzerResults,
    stats,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Log analyzer execution summary.
 */
function logAnalyzerSummary(results: Map<string, AnalyzerResult<unknown>>): void {
  console.log('Analyzer Results:');
  console.log('─'.repeat(50));

  for (const [id, result] of results) {
    const icon = result.status === 'success' ? '✓' : result.status === 'skipped' ? '○' : '✗';

    const duration = result.durationMs ? ` (${result.durationMs.toFixed(0)}ms)` : '';
    const error = result.error ? ` → ${result.error}` : '';
    const dataInfo = result.status === 'success' && result.data ? ` [has data]` : '';

    console.log(`  ${icon} ${id}${duration}${dataInfo}${error}`);
  }

  console.log('─'.repeat(50));
}

/**
 * Wrap output lines in XML document structure.
 */
function wrapInXml(lines: string[], outputLevel: OutputLevel, path: string): string {
  const header = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!--',
    '  REGISTRY-BASED REFACTOR ANALYSIS',
    '  This output uses the new registry architecture.',
    `  Output level: ${outputLevel}`,
    '-->',
    '',
    `<refactor-analysis mode="registry" level="${outputLevel}" path="${path}" timestamp="${new Date().toISOString()}">`,
  ];

  const footer = ['</refactor-analysis>'];

  return [...header, ...lines, ...footer].join('\n');
}

/**
 * Calculate execution statistics.
 */
function calculateStats(
  results: Map<string, AnalyzerResult<unknown>>,
  startTime: number,
): RegistryRunnerResult['stats'] {
  let analyzersRun = 0;
  let analyzersSkipped = 0;
  let analyzersFailed = 0;

  for (const result of results.values()) {
    switch (result.status) {
      case 'success':
        analyzersRun++;
        break;
      case 'skipped':
        analyzersSkipped++;
        break;
      case 'error':
        analyzersFailed++;
        break;
    }
  }

  return {
    analyzersRun,
    analyzersSkipped,
    analyzersFailed,
    totalDurationMs: performance.now() - startTime,
  };
}

/**
 * Create empty base analysis for standalone runs.
 */
function createEmptyBaseAnalysis(targetPath: string): RefactorAnalysis {
  return {
    path: targetPath,
    libPath: targetPath,
    timestamp: new Date().toISOString(),
    duplicates: [],
    structure: {
      flatFiles: [],
      namespacedFolders: [],
      doubleNested: [],
      ungroupedFiles: [],
      score: 0,
      issues: [],
    },
    migration: {
      filesAffected: 0,
      importsToUpdate: 0,
      actions: [],
      riskSummary: {
        safe: 0,
        medium: 0,
        risky: 0,
      },
    },
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { analyzerRegistry, sectionRegistry };
