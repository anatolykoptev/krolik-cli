/**
 * Vitest Test Output Parser
 *
 * Parses Vitest output to extract test results, failures, and coverage.
 *
 * @module @ralph/test-runner/parsers/vitest
 */

import type { TestFailure, TestResult, TestSuite } from '../../types';
import { BaseTestParser } from './base';

export class VitestParser extends BaseTestParser {
  framework = 'vitest' as const;

  parse(stdout: string, stderr: string, exitCode: number): TestResult {
    const cleanOutput = this.cleanAnsi(stdout);
    const cleanError = this.cleanAnsi(stderr);
    const fullOutput = `${cleanOutput}\n${cleanError}`;

    const summary = this.parseSummary(fullOutput);
    const suites = this.parseTestSuites(fullOutput);
    const failures = this.extractFailures(fullOutput);
    const coverage = this.parseCoverage(fullOutput);

    return {
      framework: this.framework,
      type: 'unit',
      status: exitCode === 0 ? 'success' : 'failure',
      exitCode,
      duration: 0,
      timestamp: new Date().toISOString(),
      totalTests: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      suites,
      failures,
      coverage,
      stdout,
      stderr,
      retryCount: 0,
      maxRetries: 3,
    };
  }

  extractFailures(output: string): TestFailure[] {
    const failures: TestFailure[] = [];
    const failureBlocks = output.split(/❯|×/).slice(1);

    for (const block of failureBlocks) {
      const failure = this.parseFailureBlock(block);
      if (failure) failures.push(failure);
    }

    return failures;
  }

  private parseSummary(output: string): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  } {
    const summary = { total: 0, passed: 0, failed: 0, skipped: 0 };

    const testsMatch = output.match(
      /Tests\s+(?:(\d+)\s+failed,?\s*)?(?:(\d+)\s+passed)?(?:\s*\((\d+)\))?/,
    );
    if (testsMatch) {
      summary.failed = testsMatch[1] ? Number.parseInt(testsMatch[1], 10) : 0;
      summary.passed = testsMatch[2] ? Number.parseInt(testsMatch[2], 10) : 0;
      summary.total = testsMatch[3]
        ? Number.parseInt(testsMatch[3], 10)
        : summary.passed + summary.failed;
    }

    const skippedMatch = output.match(/(\d+)\s+skipped/);
    if (skippedMatch?.[1]) {
      summary.skipped = Number.parseInt(skippedMatch[1], 10);
    }

    return summary;
  }

  private parseTestSuites(output: string): TestSuite[] {
    const suites: TestSuite[] = [];
    const fileRegex = /(?:FAIL|PASS)\s+([\w/.-]+\.(?:test|spec)\.(?:ts|tsx|js|jsx))/g;
    const matches = [...output.matchAll(fileRegex)];

    for (const match of matches) {
      const file = match[1];
      if (file) {
        suites.push({
          name: file,
          file,
          duration: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          tests: [],
        });
      }
    }

    return suites;
  }

  private parseFailureBlock(block: string): TestFailure | null {
    const lines = block.trim().split('\n');
    const testNameMatch = lines[0]?.match(/(.+?)\s+>/);
    if (!testNameMatch?.[1]) return null;

    const testName = testNameMatch[1].trim();
    const fileMatch = block.match(/([\w/.-]+\.(?:test|spec)\.(?:ts|tsx|js|jsx)):(\d+):(\d+)/);
    const testFile = fileMatch?.[1] ?? 'unknown';
    const line = fileMatch?.[2] ? Number.parseInt(fileMatch[2], 10) : undefined;
    const column = fileMatch?.[3] ? Number.parseInt(fileMatch[3], 10) : undefined;

    const errorMatch = block.match(/Error:\s*(.+)/);
    const errorMessage = errorMatch?.[1] ?? block.split('\n').slice(1, 3).join('\n').trim();

    const stackTraceMatch = block.match(/(?:at\s+.+\n?)+/);
    const stackTrace = stackTraceMatch?.[0];

    const expectedMatch = block.match(/Expected:\s*(.+)/);
    const actualMatch = block.match(/Received:\s*(.+)/);
    const diff = this.extractDiff(block);

    return {
      testName,
      testFile,
      errorMessage,
      stackTrace,
      line,
      column,
      expected: expectedMatch?.[1],
      actual: actualMatch?.[1],
      diff,
      isDeterministic: this.isDeterministic(errorMessage),
      retryable: this.isRetryable(errorMessage),
    };
  }

  private parseCoverage(output: string): TestResult['coverage'] | undefined {
    const coverageMatch = output.match(
      /All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/,
    );
    if (!coverageMatch?.[1] || !coverageMatch[2] || !coverageMatch[3] || !coverageMatch[4]) {
      return undefined;
    }

    const statements = Number.parseFloat(coverageMatch[1]);
    const branches = Number.parseFloat(coverageMatch[2]);
    const functions = Number.parseFloat(coverageMatch[3]);
    const lines = Number.parseFloat(coverageMatch[4]);

    return {
      lines: { total: 100, covered: Math.round(lines), percentage: lines },
      statements: { total: 100, covered: Math.round(statements), percentage: statements },
      functions: { total: 100, covered: Math.round(functions), percentage: functions },
      branches: { total: 100, covered: Math.round(branches), percentage: branches },
    };
  }
}
