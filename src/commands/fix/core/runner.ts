/**
 * @module commands/fix/core/runner
 * @description Fixer Analysis Runner
 *
 * Runs all registered fixers through the registry and returns QualityIssue[].
 * This provides integration between the new fixer architecture and existing pipeline.
 *
 * @example
 * ```ts
 * import { runFixerAnalysis } from './core/runner';
 *
 * // Analyze a file with all enabled fixers
 * const issues = runFixerAnalysis(content, filepath, options);
 *
 * // Analyze with specific fixers only
 * const issues = runFixerAnalysis(content, filepath, { fixerIds: ['console', 'debugger'] });
 * ```
 */

import { registry } from './registry';
import type { QualityIssue } from './types';

/**
 * Options for running fixer analysis
 */
export interface FixerRunnerOptions {
  /** Filter by specific fixer IDs */
  fixerIds?: string[];
  /** Filter by category */
  category?: string;
  /** Filter by difficulty */
  difficulty?: 'trivial' | 'safe' | 'risky';
  /** CLI options for getEnabled() filtering */
  cliOptions?: Record<string, unknown>;
  /** Include risky fixers (default: false for analysis-only) */
  includeRisky?: boolean;
}

/**
 * Result of running fixer analysis
 */
export interface FixerRunResult {
  issues: QualityIssue[];
  fixersRun: string[];
  fixersSkipped: string[];
}

/**
 * Run all enabled fixers on a file and return issues
 */
export function runFixerAnalysis(
  content: string,
  filepath: string,
  options: FixerRunnerOptions = {}
): FixerRunResult {
  const issues: QualityIssue[] = [];
  const fixersRun: string[] = [];
  const fixersSkipped: string[] = [];

  // Get fixers based on options
  let fixers = options.cliOptions
    ? registry.getEnabled(options.cliOptions)
    : registry.all();

  // Apply additional filters
  if (options.fixerIds?.length) {
    fixers = fixers.filter(f => options.fixerIds!.includes(f.metadata.id));
  }

  if (options.category) {
    fixers = fixers.filter(f => f.metadata.category === options.category);
  }

  if (options.difficulty) {
    fixers = fixers.filter(f => f.metadata.difficulty === options.difficulty);
  }

  // By default, exclude risky fixers unless explicitly included
  if (!options.includeRisky) {
    fixers = fixers.filter(f => f.metadata.difficulty !== 'risky');
  }

  // Run each fixer
  for (const fixer of fixers) {
    try {
      const fixerIssues = fixer.analyze(content, filepath);

      // Filter out issues that should be skipped
      const filteredIssues = fixer.shouldSkip
        ? fixerIssues.filter(issue => !fixer.shouldSkip!(issue, content))
        : fixerIssues;

      // Ensure fixerId is set on all issues
      for (const issue of filteredIssues) {
        issue.fixerId = fixer.metadata.id;
      }

      issues.push(...filteredIssues);
      fixersRun.push(fixer.metadata.id);
    } catch (error) {
      // Log error but continue with other fixers
      fixersSkipped.push(fixer.metadata.id);
    }
  }

  return { issues, fixersRun, fixersSkipped };
}

/**
 * Run only trivial fixers (safe to auto-apply)
 */
export function runTrivialFixers(
  content: string,
  filepath: string
): FixerRunResult {
  return runFixerAnalysis(content, filepath, {
    difficulty: 'trivial',
    includeRisky: false,
  });
}

/**
 * Run safe fixers (trivial + safe, but not risky)
 */
export function runSafeFixers(
  content: string,
  filepath: string
): FixerRunResult {
  const fixers = registry.all().filter(
    f => f.metadata.difficulty === 'trivial' || f.metadata.difficulty === 'safe'
  );

  return runFixerAnalysis(content, filepath, {
    fixerIds: fixers.map(f => f.metadata.id),
    includeRisky: false,
  });
}

/**
 * Run analysis with specific fixers by ID
 */
export function runSpecificFixers(
  content: string,
  filepath: string,
  fixerIds: string[]
): FixerRunResult {
  return runFixerAnalysis(content, filepath, {
    fixerIds,
    includeRisky: true, // If user specifies a fixer, they want it run
  });
}

/**
 * Get a summary of what fixers would run with given options
 */
export function getFixerSummary(options: FixerRunnerOptions = {}): {
  willRun: string[];
  willSkip: string[];
} {
  let fixers = options.cliOptions
    ? registry.getEnabled(options.cliOptions)
    : registry.all();

  if (options.fixerIds?.length) {
    fixers = fixers.filter(f => options.fixerIds!.includes(f.metadata.id));
  }

  if (!options.includeRisky) {
    const withoutRisky = fixers.filter(f => f.metadata.difficulty !== 'risky');
    return {
      willRun: withoutRisky.map(f => f.metadata.id),
      willSkip: fixers
        .filter(f => f.metadata.difficulty === 'risky')
        .map(f => f.metadata.id),
    };
  }

  return {
    willRun: fixers.map(f => f.metadata.id),
    willSkip: [],
  };
}
