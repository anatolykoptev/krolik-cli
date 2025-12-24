/**
 * @module commands/quality/recommendations/rules/testing
 * @description Testing recommendations
 */

import type { Recommendation } from '../types';

export const TESTING_RULES: Recommendation[] = [
  {
    id: 'testing-describe-it',
    title: 'Use describe blocks to group related tests',
    description: 'Organize tests with describe("FeatureName", () => { it(...) })',
    category: 'testing',
    severity: 'suggestion',
    check: (content, analysis) => {
      if (analysis.fileType !== 'test') return false;
      const hasIt = content.includes('it(') || content.includes('test(');
      const hasDescribe = content.includes('describe(');
      return hasIt && !hasDescribe;
    },
  },
  {
    id: 'testing-avoid-only',
    title: 'Remove .only() from tests before committing',
    description: '.only() skips other tests and should not be committed',
    category: 'testing',
    severity: 'best-practice',
    pattern: /\.(only|skip)\s*\(/,
  },
  {
    id: 'testing-meaningful-names',
    title: 'Use descriptive test names',
    description:
      'Test names should describe expected behavior: "should return user when ID exists"',
    category: 'testing',
    severity: 'suggestion',
    check: (content, analysis) => {
      if (analysis.fileType !== 'test') return false;
      // Check for short test names
      const shortTestPattern = /(?:it|test)\s*\(\s*['"][^'"]{1,20}['"]/g;
      const matches = content.match(shortTestPattern) || [];
      return matches.length > 3;
    },
  },
  {
    id: 'testing-arrange-act-assert',
    title: 'Follow Arrange-Act-Assert pattern',
    description: 'Structure tests: setup data, execute action, verify result',
    category: 'testing',
    severity: 'suggestion',
    check: (content, analysis) => {
      if (analysis.fileType !== 'test') return false;
      // Check for tests without expect
      const hasTest = content.includes('it(') || content.includes('test(');
      const hasExpect = content.includes('expect(');
      return hasTest && !hasExpect;
    },
  },
  {
    id: 'testing-mock-external',
    title: 'Mock external dependencies',
    description: 'Use mocks for APIs, databases, and external services in unit tests',
    category: 'testing',
    severity: 'recommendation',
    check: (content, analysis) => {
      if (analysis.fileType !== 'test') return false;
      const hasExternalCalls = /(?:fetch|axios|prisma|supabase)\s*[.(]/.test(content);
      const hasMock =
        content.includes('mock') || content.includes('Mock') || content.includes('jest.fn');
      return hasExternalCalls && !hasMock;
    },
  },
];
