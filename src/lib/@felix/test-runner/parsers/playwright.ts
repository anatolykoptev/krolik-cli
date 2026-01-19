/**
 * Playwright Test Output Parser
 *
 * Parses Playwright output to extract test results and failures.
 *
 * @module @felix/test-runner/parsers/playwright
 */

import type { TestFailure, TestResult, TestSuite } from '../../types';
import { BaseTestParser } from './base';

export class PlaywrightParser extends BaseTestParser {
  framework = 'playwright' as const;

  parse(stdout: string, stderr: string, exitCode: number): TestResult {
    const cleanOutput = this.cleanAnsi(stdout);
    const cleanError = this.cleanAnsi(stderr);
    const fullOutput = `${cleanOutput}\n${cleanError}`;

    const summary = this.parseSummary(fullOutput);
    const suites = this.parseTestSuites(fullOutput);
    const failures = this.extractFailures(fullOutput);

    return {
      framework: this.framework,
      type: 'e2e',
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
      stdout,
      stderr,
      retryCount: 0,
      maxRetries: 3,
    };
  }

  extractFailures(output: string): TestFailure[] {
    const failures: TestFailure[] = [];

    // Playwright failure format: "✘ [chromium] › path/to/test.spec.ts:line:col › test name"
    const failureRegex =
      /✘\s+\[([^\]]+)\]\s+›\s+([\w/.-]+\.(?:spec|test)\.(?:ts|js)):(\d+):(\d+)\s+›\s+(.+)/g;
    let match: RegExpExecArray | null;

    while ((match = failureRegex.exec(output)) !== null) {
      const testFile = match[2];
      const lineStr = match[3];
      const columnStr = match[4];
      const testName = match[5];

      if (!testFile || !lineStr || !columnStr || !testName) continue;

      // Try to extract error message following the failure
      const afterMatch = output.slice(match.index + match[0].length);
      const errorMatch = afterMatch.match(/Error:\s*(.+?)(?=\n\n|$)/s);
      const errorMessage = errorMatch?.[1]?.trim() ?? 'Test failed';

      const stackMatch = afterMatch.match(/(?:at\s+.+\n?)+/);
      const stackTrace = stackMatch?.[0];

      failures.push({
        testName: testName.trim(),
        testFile,
        errorMessage,
        stackTrace,
        line: Number.parseInt(lineStr, 10),
        column: Number.parseInt(columnStr, 10),
        isDeterministic: this.isDeterministic(errorMessage),
        retryable: this.isRetryable(errorMessage),
      });
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

    // Playwright summary: "X passed", "Y failed", "Z skipped"
    const passedMatch = output.match(/(\d+)\s+passed/);
    const failedMatch = output.match(/(\d+)\s+failed/);
    const skippedMatch = output.match(/(\d+)\s+skipped/);

    if (passedMatch?.[1]) summary.passed = Number.parseInt(passedMatch[1], 10);
    if (failedMatch?.[1]) summary.failed = Number.parseInt(failedMatch[1], 10);
    if (skippedMatch?.[1]) summary.skipped = Number.parseInt(skippedMatch[1], 10);

    summary.total = summary.passed + summary.failed + summary.skipped;

    return summary;
  }

  private parseTestSuites(output: string): TestSuite[] {
    const suiteMap = new Map<string, TestSuite>();

    // Extract test files from output
    const testRegex = /[✓✘○]\s+\[([^\]]+)\]\s+›\s+([\w/.-]+\.(?:spec|test)\.(?:ts|js))/g;
    let match: RegExpExecArray | null;

    while ((match = testRegex.exec(output)) !== null) {
      const file = match[2];

      if (file && !suiteMap.has(file)) {
        suiteMap.set(file, {
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

    return Array.from(suiteMap.values());
  }
}
