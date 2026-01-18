/**
 * Test Output Parsers
 *
 * Framework-specific parsers for test output.
 *
 * @module @ralph/test-runner/parsers
 */

export { BaseTestParser } from './base';
export { PlaywrightParser } from './playwright';
export { VitestParser } from './vitest';

import type { TestFramework, TestOutputParser } from '../../types';
import { PlaywrightParser } from './playwright';
import { VitestParser } from './vitest';

/**
 * Get parser for a specific test framework
 */
export function getParser(framework: TestFramework): TestOutputParser | null {
  switch (framework) {
    case 'vitest':
      return new VitestParser();
    case 'playwright':
      return new PlaywrightParser();
    case 'jest':
      // Jest uses similar format to Vitest
      return new VitestParser();
    default:
      return null;
  }
}
