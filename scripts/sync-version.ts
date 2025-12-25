#!/usr/bin/env tsx
/**
 * @module scripts/sync-version
 * @description Syncs version from package.json to src/version.ts
 *
 * This script is run:
 * - Before build (prebuild hook)
 * - After changeset version (postversion hook)
 *
 * Usage:
 *   pnpm sync-version
 *   tsx scripts/sync-version.ts
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const VERSION_TS = path.join(ROOT, 'src/version.ts');

interface PackageJson {
  version: string;
}

function main(): void {
  // Read package.json
  const pkg: PackageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
  const version = pkg.version;

  // Read current version.ts
  const currentContent = fs.readFileSync(VERSION_TS, 'utf-8');

  // Extract current KROLIK_VERSION
  const match = currentContent.match(/KROLIK_VERSION\s*=\s*['"]([^'"]+)['"]/);
  const currentVersion = match?.[1];

  if (currentVersion === version) {
    console.log(`✓ Version already in sync: ${version}`);
    return;
  }

  // Update version.ts
  const newContent = currentContent.replace(
    /KROLIK_VERSION\s*=\s*['"][^'"]+['"]/,
    `KROLIK_VERSION = '${version}'`,
  );

  fs.writeFileSync(VERSION_TS, newContent, 'utf-8');
  console.log(`✓ Synced version: ${currentVersion} → ${version}`);
}

main();
