/**
 * @module commands/fix/strategies
 * @description Fix strategies utilities
 *
 * NOTE: The strategy-based fix architecture has been replaced by the fixer-based
 * architecture in './fixers'. This module now only re-exports shared utilities.
 *
 * @see ./fixers for the current fix implementation
 */

// Re-export shared utilities (Biome, TypeScript, Prettier)
export * from './shared';
