/**
 * @module commands/quality/recommendations/rules/async
 * @description Async/await best practices recommendations
 */

import type { Recommendation } from '../types';

export const ASYNC_RULES: Recommendation[] = [
  {
    id: 'async-await-in-loop',
    title: 'Avoid await inside loops',
    description: 'Use Promise.all() for parallel execution instead of sequential awaits',
    category: 'async',
    severity: 'recommendation',
    pattern: /for\s*\([^)]+\)\s*\{[^}]*await\s+/,
  },
  {
    id: 'async-error-handling',
    title: 'Add error handling for async operations',
    description: 'Wrap await calls in try-catch or use .catch() for proper error handling',
    category: 'async',
    severity: 'best-practice',
    check: (content) => {
      const awaitCount = (content.match(/await\s+/g) || []).length;
      const tryCatchCount = (content.match(/try\s*\{/g) || []).length;
      const catchCount = (content.match(/\.catch\s*\(/g) || []).length;
      return awaitCount > 3 && tryCatchCount + catchCount === 0;
    },
  },
  {
    id: 'async-no-floating-promises',
    title: 'Avoid floating promises (unhandled async calls)',
    description: 'Always await, return, or handle promises explicitly',
    category: 'async',
    severity: 'best-practice',
    check: (content) => {
      // Check for async function calls without await
      const hasFloating = /(?<!await\s)(?<!return\s)\w+\s*\(\s*\)\s*;?\s*$/m.test(content);
      const hasAsyncCall = /async\s+function|async\s*\(/.test(content);
      return hasAsyncCall && hasFloating;
    },
  },
  {
    id: 'async-race-condition',
    title: 'Guard against race conditions in effects',
    description: 'Use cleanup functions or abort controllers for async effects',
    category: 'async',
    severity: 'recommendation',
    check: (content, analysis) => {
      if (analysis.fileType !== 'component') return false;
      const hasAsyncEffect = /useEffect\s*\(\s*(?:async|[^)]*=>\s*\{[^}]*await)/.test(content);
      const hasCleanup = /return\s*\(\s*\)\s*=>\s*\{/.test(content);
      return hasAsyncEffect && !hasCleanup;
    },
  },
  {
    id: 'async-parallel-independent',
    title: 'Run independent async operations in parallel',
    description: 'Use Promise.all() when operations do not depend on each other',
    category: 'async',
    severity: 'recommendation',
    check: (content) => {
      // Multiple sequential awaits that could be parallel
      const awaitLines: number[] = [];
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('await ') && !line.includes('for') && !line.includes('while')) {
          awaitLines.push(i);
        }
      });
      // Check for consecutive awaits
      for (let i = 1; i < awaitLines.length; i++) {
        if ((awaitLines[i] ?? 0) - (awaitLines[i - 1] ?? 0) <= 2) {
          return true;
        }
      }
      return false;
    },
  },
];
