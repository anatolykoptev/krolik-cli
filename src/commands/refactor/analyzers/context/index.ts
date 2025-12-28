/**
 * @module commands/refactor/analyzers/context
 * @description Project context detection and analysis
 */

// Context detection
export {
  detectEntryPoints,
  detectImportAlias,
  detectProjectContext,
  detectProjectType,
  detectSrcDir,
  detectTechStack,
} from './context';
// AI navigation
export { generateAiNavigation } from './navigation';
// Standards compliance
export { checkStandards } from './standards';
