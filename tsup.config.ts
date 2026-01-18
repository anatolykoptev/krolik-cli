import { defineConfig } from 'tsup';

// Node.js built-in modules that must be external for ESM bundling
// These are used by Ralph CLI LLM adapters (spawn, execSync) and other core utilities
const NODEJS_BUILTINS = [
  'node:child_process',
  'node:fs',
  'node:path',
  'node:url',
  'node:process',
  'node:util',
  'node:buffer',
  'node:stream',
  'node:events',
  'node:crypto',
  'node:os',
  'node:worker_threads',
  // Also include non-prefixed versions for compatibility
  'child_process',
  'fs',
  'path',
  'url',
  'process',
  'util',
  'buffer',
  'stream',
  'events',
  'crypto',
  'os',
  'worker_threads',
];

// Native modules that can't be bundled
const NATIVE_EXTERNALS = ['@swc/core', '@swc/wasm'];

// Google packages that have CommonJS dependencies with child_process
// Note: @google/adk/common is NOT a separate export - it's bundled from @google/adk
const GOOGLE_EXTERNALS = [
  'google-auth-library',
  '@google/genai',
  '@google/adk',
  'gaxios',
  'gcp-metadata',
];

// Combined externals for all builds
const EXTERNALS = [...NODEJS_BUILTINS, ...NATIVE_EXTERNALS, ...GOOGLE_EXTERNALS];

export default defineConfig([
  // Main library entry
  {
    entry: {
      index: 'src/index.ts',
      'config/index': 'src/config/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: true,
    treeshake: true,
    minify: false,
    target: 'node20',
    outDir: 'dist',
    shims: true,
    external: EXTERNALS,
  },
  // CLI entry with shebang
  {
    entry: {
      'bin/cli': 'src/bin/cli.ts',
    },
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    minify: false,
    target: 'node20',
    outDir: 'dist',
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
    external: EXTERNALS,
  },
  // Embedding worker (separate bundle for worker_threads)
  {
    entry: {
      'lib/@storage/memory/embedding-worker': 'src/lib/@storage/memory/embedding-worker.ts',
    },
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    minify: false,
    target: 'node20',
    outDir: 'dist',
    shims: true,
    external: EXTERNALS,
  },
]);
