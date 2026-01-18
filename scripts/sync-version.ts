#!/usr/bin/env tsx
/**
 * @module scripts/sync-version
 * @description Syncs version from package.json to src/version.ts and marketplace plugins
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
const MARKETPLACE_JSON = path.join(ROOT, 'marketplace/.claude-plugin/marketplace.json');
const PLUGIN_JSON = path.join(ROOT, 'marketplace/plugins/krolik/.claude-plugin/plugin.json');

interface PackageJson {
  version: string;
}

interface MarketplaceJson {
  plugins: Array<{ version?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface PluginJson {
  version?: string;
  [key: string]: unknown;
}

function syncVersionTs(version: string): void {
  const currentContent = fs.readFileSync(VERSION_TS, 'utf-8');
  const match = currentContent.match(/KROLIK_VERSION\s*=\s*['"]([^'"]+)['"]/);
  const currentVersion = match?.[1];

  if (currentVersion === version) {
    console.log(`✓ version.ts already in sync: ${version}`);
    return;
  }

  const newContent = currentContent.replace(
    /KROLIK_VERSION\s*=\s*['"][^'"]+['"]/,
    `KROLIK_VERSION = '${version}'`,
  );

  fs.writeFileSync(VERSION_TS, newContent, 'utf-8');
  console.log(`✓ version.ts: ${currentVersion} → ${version}`);
}

function syncMarketplaceJson(version: string): void {
  if (!fs.existsSync(MARKETPLACE_JSON)) {
    console.log(`⊘ marketplace.json not found, skipping`);
    return;
  }

  const marketplace: MarketplaceJson = JSON.parse(fs.readFileSync(MARKETPLACE_JSON, 'utf-8'));
  let updated = false;

  marketplace.plugins = marketplace.plugins.map((plugin) => {
    if (plugin.version !== version) {
      updated = true;
      return { ...plugin, version };
    }
    return plugin;
  });

  if (updated) {
    fs.writeFileSync(MARKETPLACE_JSON, `${JSON.stringify(marketplace, null, 2)}\n`, 'utf-8');
    console.log(`✓ marketplace.json: plugins updated to ${version}`);
  } else {
    console.log(`✓ marketplace.json already in sync: ${version}`);
  }
}

function syncPluginJson(version: string): void {
  if (!fs.existsSync(PLUGIN_JSON)) {
    console.log(`⊘ plugin.json not found, skipping`);
    return;
  }

  const plugin: PluginJson = JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf-8'));

  if (plugin.version === version) {
    console.log(`✓ plugin.json already in sync: ${version}`);
    return;
  }

  const oldVersion = plugin.version;
  plugin.version = version;
  fs.writeFileSync(PLUGIN_JSON, `${JSON.stringify(plugin, null, 2)}\n`, 'utf-8');
  console.log(`✓ plugin.json: ${oldVersion} → ${version}`);
}

function main(): void {
  const pkg: PackageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
  const version = pkg.version;

  console.log(`Syncing version: ${version}\n`);

  syncVersionTs(version);
  syncMarketplaceJson(version);
  syncPluginJson(version);

  console.log('\nDone!');
}

main();
