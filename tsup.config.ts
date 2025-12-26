import { defineConfig } from 'tsup';

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
    // SWC has native bindings that can't be bundled
    external: ['@swc/core', '@swc/wasm'],
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
    // SWC has native bindings that can't be bundled
    external: ['@swc/core', '@swc/wasm'],
  },
]);
