/**
 * @module commands/quality/recommendations/rules/performance
 * @description Performance recommendations
 */

import type { Recommendation } from '../types';

export const PERFORMANCE_RULES: Recommendation[] = [
  {
    id: 'perf-avoid-inline-objects',
    title: 'Avoid inline object/array creation in render',
    description: 'Move static objects outside component or use useMemo',
    category: 'performance',
    severity: 'recommendation',
    check: (content, analysis) => {
      if (analysis.fileType !== 'component') return false;
      return /(?:style|options|config)\s*=\s*\{\s*\{/.test(content);
    },
  },
  {
    id: 'perf-lazy-imports',
    title: 'Consider lazy loading for large components',
    description: 'Use React.lazy() for code splitting on routes/modals',
    category: 'performance',
    severity: 'suggestion',
    check: (content, analysis) => {
      if (analysis.fileType !== 'component') return false;
      return analysis.lines > 300;
    },
  },
  {
    id: 'perf-avoid-rerender',
    title: 'Avoid unnecessary re-renders with React.memo',
    description: 'Wrap components that receive stable props in React.memo',
    category: 'performance',
    severity: 'suggestion',
    check: (content, analysis) => {
      if (analysis.fileType !== 'component') return false;
      const hasExport = content.includes('export');
      const noMemo = !content.includes('React.memo') && !content.includes('memo(');
      const hasProps = /function\s+\w+\s*\(\s*\{/.test(content);
      return hasExport && noMemo && hasProps && analysis.lines > 50;
    },
  },
  {
    id: 'perf-debounce-handlers',
    title: 'Consider debouncing frequent event handlers',
    description: 'Use debounce/throttle for scroll, resize, input handlers',
    category: 'performance',
    severity: 'suggestion',
    check: (content) => {
      const hasFrequentHandlers =
        /on(?:Scroll|Resize|Input|MouseMove)\s*=/.test(content) ||
        /addEventListener\s*\(\s*['"](?:scroll|resize|input|mousemove)['"]/.test(content);
      const hasDebounce = content.includes('debounce') || content.includes('throttle');
      return hasFrequentHandlers && !hasDebounce;
    },
  },
  {
    id: 'perf-virtualize-lists',
    title: 'Consider virtualization for long lists',
    description: 'Use react-window or react-virtualized for lists > 100 items',
    category: 'performance',
    severity: 'suggestion',
    check: (content) => {
      // Check for .map() with hardcoded large arrays or data fetching
      const hasLargeMap = /\.map\s*\([^)]+\)/.test(content);
      const mentionsLargeData = /(?:items|data|list|results)\s*\.length\s*>\s*\d{2,}/.test(content);
      const hasVirtualization =
        content.includes('react-window') ||
        content.includes('react-virtualized') ||
        content.includes('VirtualList');
      return hasLargeMap && mentionsLargeData && !hasVirtualization;
    },
  },
];
