/**
 * @module commands/codegen/generators
 * @description Generator registry
 */

import type { Generator, GeneratorTarget } from '../types';
import { bundleGenerator } from './bundle';
import { prismaZodGenerator } from './prisma-zod';
import { testGenerator } from './test';
import { trpcRouteGenerator } from './trpc-route';
import { tsZodGenerator } from './ts-zod';
import { zodSchemaGenerator } from './zod-schema';

/**
 * Map of all available generators
 */
const generators = new Map<GeneratorTarget, Generator>([
  ['trpc-route', trpcRouteGenerator as Generator],
  ['zod-schema', zodSchemaGenerator as Generator],
  ['ts-zod', tsZodGenerator as Generator],
  ['prisma-zod', prismaZodGenerator as Generator],
  ['test', testGenerator as Generator],
  ['bundle', bundleGenerator as Generator],
  // Aliases for backwards compatibility
  ['schemas', zodSchemaGenerator as Generator],
  ['tests', testGenerator as Generator],
]);

/**
 * Get a generator by target name
 */
export function getGenerator(target: string): Generator | undefined {
  return generators.get(target as GeneratorTarget);
}

/**
 * Get all registered generators (unique, no aliases)
 */
export function getAllGenerators(): Generator[] {
  const uniqueGenerators = new Map<string, Generator>();

  for (const generator of generators.values()) {
    uniqueGenerators.set(generator.metadata.id, generator);
  }

  return Array.from(uniqueGenerators.values());
}

/**
 * Check if a target is valid
 */
export function isValidTarget(target: string): target is GeneratorTarget {
  return generators.has(target as GeneratorTarget);
}

/**
 * Get list of valid target names
 */
export function getValidTargets(): string[] {
  return Array.from(generators.keys());
}

export { BaseGenerator } from './base';
export type { BundleType } from './bundle';
// Re-export individual generators
export {
  BUNDLE_TYPES,
  bundleGenerator,
  getAvailableBundleTypes,
  isValidBundleType,
} from './bundle';
export type { PrismaZodOptions } from './prisma-zod';
export { prismaZodGenerator } from './prisma-zod';
export { testGenerator } from './test';
export { trpcRouteGenerator } from './trpc-route';
export { tsZodGenerator } from './ts-zod';
export { zodSchemaGenerator } from './zod-schema';
