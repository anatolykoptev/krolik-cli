/**
 * @module cli/builders
 * @description Barrel export for CLI option builders
 */

// Common options
export {
  addCommonOptions,
  addPathOption,
  addProjectOption,
} from './common-options';

// Mode options
export {
  addDryRunOption,
  addForceOption,
  addModeSwitch,
} from './mode-options';

// Output options
export {
  addJsonOption,
  addOutputLevelOptions,
  addSummaryOption,
} from './output-options';
