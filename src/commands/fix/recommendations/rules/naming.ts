/**
 * @module commands/quality/recommendations/rules/naming
 * @description Naming convention recommendations
 */

import type { Recommendation } from '../types';

export const NAMING_RULES: Recommendation[] = [
  {
    id: 'naming-boolean-prefix',
    title: 'Boolean variables should have is/has/can/should prefix',
    description: 'Use isLoading, hasError, canSubmit instead of loading, error, submittable',
    category: 'naming',
    severity: 'suggestion',
    antiPattern:
      /const\s+(loading|error|visible|disabled|active|open|closed|valid|invalid|enabled|selected|checked|focused)\s*[=:]/,
  },
  {
    id: 'naming-handler-prefix',
    title: 'Event handlers should have handle/on prefix',
    description: 'Use handleClick, onSubmit instead of click, submit for event handlers',
    category: 'naming',
    severity: 'suggestion',
    antiPattern: /(?:onClick|onSubmit|onChange|onFocus|onBlur)\s*=\s*\{?\s*(?!handle|on)[a-z]\w*\}?/,
  },
  {
    id: 'naming-constants-uppercase',
    title: 'Constants should be UPPER_SNAKE_CASE',
    description: 'Use MAX_RETRIES, API_URL instead of maxRetries, apiUrl for true constants',
    category: 'naming',
    severity: 'suggestion',
    check: (content) => {
      const constPattern = /export\s+const\s+([a-z][a-zA-Z]+)\s*=\s*(?:\d+|['"`][^'"`]+['"`])\s*;/g;
      return constPattern.test(content);
    },
  },
  {
    id: 'naming-private-underscore',
    title: 'Avoid underscore prefix for private members',
    description: 'Use TypeScript private/# instead of _privateVar convention',
    category: 'naming',
    severity: 'suggestion',
    pattern: /(?:private|protected)\s+_\w+/,
  },
  {
    id: 'naming-function-verb',
    title: 'Function names should start with a verb',
    description: 'Use getUserById, calculateTotal instead of user, total',
    category: 'naming',
    severity: 'suggestion',
    antiPattern: /(?:export\s+)?(?:async\s+)?function\s+(?:the|a|an|my)[A-Z]\w*\s*\(/,
  },
];
