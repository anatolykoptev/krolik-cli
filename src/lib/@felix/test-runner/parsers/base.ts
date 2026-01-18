/**
 * Base Test Output Parser
 *
 * Abstract base class for test framework parsers.
 *
 * @module @ralph/test-runner/parsers/base
 */

import type { TestFailure, TestFramework, TestOutputParser, TestResult } from '../../types';

// Error patterns categorized by type
const ERROR_PATTERNS = {
  // Flaky test patterns - timing, race conditions, etc.
  flaky: [
    /timeout/i,
    /timed out/i,
    /race condition/i,
    /connection refused/i,
    /ECONNRESET/,
    /ETIMEDOUT/,
    /flaky/i,
  ],
  // Transient errors - network, resources, etc.
  transient: [
    /ENOENT/,
    /EACCES/,
    /network/i,
    /connection/i,
    /socket hang up/i,
    /ECONNREFUSED/,
    /out of memory/i,
  ],
  // Permanent errors - bugs, syntax errors, etc.
  permanent: [/SyntaxError/, /TypeError/, /ReferenceError/, /AssertionError/, /expect\(.*\)\.to/],
};

export abstract class BaseTestParser implements TestOutputParser {
  abstract framework: TestFramework;
  abstract parse(stdout: string, stderr: string, exitCode: number): TestResult;
  abstract extractFailures(output: string): TestFailure[];

  /**
   * Remove ANSI escape codes from output
   */
  protected cleanAnsi(text: string): string {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequences require control characters
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  }

  /**
   * Extract diff from assertion output
   */
  protected extractDiff(block: string): string | undefined {
    const diffMatch = block.match(/(?:Difference|Diff):\s*([\s\S]*?)(?=\n\n|$)/i);
    return diffMatch?.[1]?.trim();
  }

  /**
   * Check if error is deterministic (real bug vs flaky)
   */
  protected isDeterministic(errorMessage: string): boolean {
    // Check against flaky patterns
    for (const pattern of ERROR_PATTERNS.flaky) {
      if (pattern.test(errorMessage)) return false;
    }

    // Check against transient patterns
    for (const pattern of ERROR_PATTERNS.transient) {
      if (pattern.test(errorMessage)) return false;
    }

    return true;
  }

  /**
   * Check if error is retryable
   */
  protected isRetryable(errorMessage: string): boolean {
    // Permanent errors are not retryable
    for (const pattern of ERROR_PATTERNS.permanent) {
      if (pattern.test(errorMessage)) return false;
    }

    // Transient errors are retryable
    for (const pattern of ERROR_PATTERNS.transient) {
      if (pattern.test(errorMessage)) return true;
    }

    // Default: deterministic failures are not retryable
    return !this.isDeterministic(errorMessage);
  }

  /**
   * Detect if a failure is flaky based on history
   */
  detectFlaky(failure: TestFailure, history: TestFailure[]): boolean {
    // If test passed before with same name, it might be flaky
    const previousFailures = history.filter(
      (h) => h.testName === failure.testName && h.testFile === failure.testFile,
    );

    if (previousFailures.length === 0) {
      return false; // First failure, can't determine
    }

    // Check if error messages differ (could indicate flaky)
    const uniqueErrors = new Set(previousFailures.map((f) => f.errorMessage));
    if (uniqueErrors.size > 1) {
      return true; // Different error messages = likely flaky
    }

    // Check for flaky patterns
    for (const pattern of ERROR_PATTERNS.flaky) {
      if (pattern.test(failure.errorMessage)) return true;
    }

    return false;
  }
}
