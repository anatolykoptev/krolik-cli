/**
 * @module commands/quality/recommendations/rules/react
 * @description React best practices recommendations
 */

import type { Recommendation } from '../types';

export const REACT_RULES: Recommendation[] = [
  {
    id: 'react-use-fragments',
    title: 'Use React.Fragment or <> instead of wrapper divs',
    description: 'Avoid unnecessary DOM nodes with fragments',
    category: 'react',
    severity: 'suggestion',
    check: (content, analysis) => {
      if (analysis.fileType !== 'component') return false;
      return /return\s*\(\s*<div[^>]*>\s*</.test(content);
    },
  },
  {
    id: 'react-extract-hooks',
    title: 'Extract complex logic to custom hooks',
    description: 'Components with multiple useState/useEffect should use custom hooks',
    category: 'react',
    severity: 'recommendation',
    check: (content, analysis) => {
      if (analysis.fileType !== 'component') return false;
      const stateCount = (content.match(/useState\s*[<(]/g) || []).length;
      const effectCount = (content.match(/useEffect\s*\(/g) || []).length;
      return stateCount + effectCount > 5;
    },
  },
  {
    id: 'react-memo-callbacks',
    title: 'Memoize callbacks passed to child components',
    description: 'Use useCallback for functions passed as props to prevent re-renders',
    category: 'react',
    severity: 'recommendation',
    check: (content, analysis) => {
      if (analysis.fileType !== 'component') return false;
      return /<\w+[^>]+\{[^}]*=>\s*[^}]+\}/.test(content);
    },
  },
  {
    id: 'react-key-index',
    title: 'Avoid using array index as key',
    description: 'Use unique IDs as keys, index causes issues with reordering',
    category: 'react',
    severity: 'best-practice',
    pattern: /\.map\s*\([^)]*,\s*(?:index|i|idx)\s*\)[^}]*key\s*=\s*\{?\s*(?:index|i|idx)\s*\}?/,
  },
  {
    id: 'react-use-memo',
    title: 'Memoize expensive computations with useMemo',
    description: 'Wrap expensive calculations in useMemo to prevent recalculation on every render',
    category: 'react',
    severity: 'recommendation',
    check: (content, analysis) => {
      if (analysis.fileType !== 'component') return false;
      // Check for .filter().map() or .sort() chains in components
      const hasExpensiveOps = /\.(filter|sort|reduce)\s*\([^)]+\)\s*\.(map|filter)/.test(content);
      const hasUseMemo = content.includes('useMemo');
      return hasExpensiveOps && !hasUseMemo;
    },
  },
  {
    id: 'react-avoid-inline-styles',
    title: 'Avoid inline styles, use CSS classes',
    description: 'Inline styles create new objects on each render and are harder to maintain',
    category: 'react',
    severity: 'suggestion',
    check: (content, analysis) => {
      if (analysis.fileType !== 'component') return false;
      const inlineStyleCount = (content.match(/style=\{\{/g) || []).length;
      return inlineStyleCount > 3;
    },
  },
  {
    id: 'react-controlled-components',
    title: 'Prefer controlled components over uncontrolled',
    description: 'Use value + onChange instead of defaultValue for forms',
    category: 'react',
    severity: 'suggestion',
    pattern: /defaultValue\s*=\s*\{/,
  },
  {
    id: 'react-error-boundary',
    title: 'Consider adding error boundaries for error handling',
    description: 'Error boundaries prevent entire app crashes from component errors',
    category: 'react',
    severity: 'suggestion',
    check: (content, analysis) => {
      if (analysis.fileType !== 'component') return false;
      // Large components without error handling
      return analysis.lines > 200 && !content.includes('ErrorBoundary');
    },
  },
];
