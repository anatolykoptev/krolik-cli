/**
 * @module commands/context/formatters/ai/sections/details
 * @description Re-exports all detail section formatters
 *
 * Split into focused modules:
 * - artifacts: Components, Tests
 * - guidance: Hints, Approach, PreCommit, NextActions
 * - info: Memory, LibraryDocs
 * - issues: Quality, Todos
 */

// Artifacts: Components and Tests
export { formatComponentsSection, formatTestsSection } from './artifacts';

// Guidance: Hints, Approach, PreCommit, NextActions
export {
  formatApproachSection,
  formatHintsSection,
  formatNextActionsSection,
  formatPreCommitSection,
} from './guidance';

// Info: Memory and LibraryDocs
export { formatLibraryDocsSection, formatMemorySection } from './info';

// Issues: Quality and Todos
export { formatQualitySection, formatTodosSection } from './issues';
