/**
 * @module lib/@core
 * @description Core utilities for krolik-cli
 *
 * This module consolidates the following utilities:
 * - logger: Colored console logging with multiple output styles
 * - time: Time measurement utilities for performance tracking
 * - utils: General utility functions (object manipulation)
 * - shell: Shell command execution utilities
 * - fs: File system utilities and directory scanning
 * - registry: Generic registry pattern implementation
 * - constants: Centralized constants for Krolik CLI
 * - text: Text and linguistic analysis (morphology, syllables, naming)
 */

// Constants (centralized)
export * from './constants';
// File system utilities
export * from './fs';
// Logger utilities
export * from './logger';
// Registry pattern
export * from './registry';
// Shell execution utilities
export * from './shell';
// Text and linguistic analysis
export * from './text';
// Time measurement utilities
export * from './time';
// General utilities
export * from './utils';
