#!/usr/bin/env npx tsx

/**
 * @description Test script for the new registry-based architecture
 *
 * Run with: npx tsx scripts/test-registry.ts
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runRegistryAnalysis } from '../src/commands/refactor/runner/registry-runner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const targetPath = path.join(projectRoot, 'src', 'lib');

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     REGISTRY-BASED ARCHITECTURE TEST                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`Project: ${projectRoot}`);
  console.log(`Target: ${targetPath}\n`);

  try {
    const result = await runRegistryAnalysis({
      projectRoot,
      targetPath,
      outputLevel: 'standard',
      verbose: true,
      analyzerOptions: {
        includeFileSize: true,
      },
    });

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║     OUTPUT (first 100 lines)                                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const outputLines = result.output.split('\n');
    console.log(outputLines.slice(0, 100).join('\n'));

    if (outputLines.length > 100) {
      console.log(`\n... (${outputLines.length - 100} more lines)`);
    }

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║     TEST PASSED                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();
