#!/usr/bin/env tsx
/**
 * @module scripts/smart-changeset
 * @description Auto-generate changeset with smart version bump detection
 *
 * Analyzes commits since last release to determine bump type:
 * - BREAKING CHANGE or feat!: → major (X.0.0)
 * - feat: → minor (0.X.0)
 * - fix:, perf:, refactor: → patch (0.0.X)
 *
 * Usage:
 *   pnpm changeset:smart
 *   tsx scripts/smart-changeset.ts
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHANGESET_DIR = path.join(ROOT, '.changeset');

type BumpType = 'major' | 'minor' | 'patch';

interface CommitAnalysis {
  bumpType: BumpType;
  features: string[];
  fixes: string[];
  other: string[];
  breaking: string[];
}

/**
 * Get commits since last release tag
 */
function getCommitsSinceLastRelease(): string[] {
  try {
    // Find last release tag (v* pattern)
    const lastTag = execSync('git describe --tags --abbrev=0 --match "v*" 2>/dev/null', {
      encoding: 'utf-8',
      cwd: ROOT,
    }).trim();

    // Get commits since that tag
    const commits = execSync(`git log ${lastTag}..HEAD --oneline`, {
      encoding: 'utf-8',
      cwd: ROOT,
    });

    return commits
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
  } catch {
    // No tags found, get last 20 commits
    const commits = execSync('git log -20 --oneline', {
      encoding: 'utf-8',
      cwd: ROOT,
    });

    return commits
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
  }
}

/**
 * Analyze commits to determine bump type
 */
function analyzeCommits(commits: string[]): CommitAnalysis {
  const analysis: CommitAnalysis = {
    bumpType: 'patch',
    features: [],
    fixes: [],
    other: [],
    breaking: [],
  };

  for (const commit of commits) {
    const message = commit.replace(/^[a-f0-9]+\s+/, ''); // Remove hash

    // Check for breaking changes
    if (message.includes('BREAKING CHANGE') || message.match(/^[a-z]+!:/i)) {
      analysis.breaking.push(message);
      analysis.bumpType = 'major';
      continue;
    }

    // Check commit type
    if (message.match(/^feat(\(.+\))?:/i)) {
      analysis.features.push(message);
      if (analysis.bumpType !== 'major') {
        analysis.bumpType = 'minor';
      }
    } else if (message.match(/^(fix|perf)(\(.+\))?:/i)) {
      analysis.fixes.push(message);
    } else {
      analysis.other.push(message);
    }
  }

  return analysis;
}

/**
 * Generate changeset summary from analysis
 */
function generateSummary(analysis: CommitAnalysis): string {
  const lines: string[] = [];

  if (analysis.breaking.length > 0) {
    lines.push('### Breaking Changes');
    for (const msg of analysis.breaking.slice(0, 5)) {
      lines.push(`- ${msg}`);
    }
    lines.push('');
  }

  if (analysis.features.length > 0) {
    lines.push('### Features');
    for (const msg of analysis.features.slice(0, 10)) {
      lines.push(`- ${msg}`);
    }
    lines.push('');
  }

  if (analysis.fixes.length > 0) {
    lines.push('### Fixes');
    for (const msg of analysis.fixes.slice(0, 10)) {
      lines.push(`- ${msg}`);
    }
    lines.push('');
  }

  // Add summary stats
  const total = analysis.features.length + analysis.fixes.length + analysis.other.length;
  if (analysis.other.length > 0 && total > 15) {
    lines.push(`*+${analysis.other.length} other changes*`);
  }

  return lines.join('\n').trim() || 'Maintenance release';
}

/**
 * Generate random changeset filename
 */
function generateChangesetFilename(): string {
  const adjectives = [
    'brave',
    'calm',
    'dark',
    'eager',
    'fair',
    'glad',
    'happy',
    'idle',
    'jolly',
    'keen',
  ];
  const nouns = ['apple', 'bird', 'cloud', 'door', 'eagle', 'fire', 'grape', 'hill', 'ice', 'jade'];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adj}-${noun}-${Date.now().toString(36).slice(-4)}`;
}

/**
 * Create changeset file
 */
function createChangeset(analysis: CommitAnalysis): string {
  const filename = generateChangesetFilename();
  const summary = generateSummary(analysis);

  const content = `---
"@anatolykoptev/krolik-cli": ${analysis.bumpType}
---

${summary}
`;

  const filepath = path.join(CHANGESET_DIR, `${filename}.md`);
  fs.writeFileSync(filepath, content, 'utf-8');

  return filepath;
}

/**
 * Show recent memories before release
 */
function showRecentMemories(): void {
  try {
    const result = execSync('krolik mem recent --limit 3 2>/dev/null || true', {
      encoding: 'utf-8',
      cwd: ROOT,
    }).trim();

    if (result && result.length > 0) {
      console.log('🧠 Recent memories (check before release):');
      console.log(result);
      console.log('');
    }
  } catch {
    // Ignore if krolik not available
  }
}

/**
 * Main function
 */
function main(): void {
  console.log('🔍 Analyzing commits since last release...\n');

  // Check recent memories before release
  showRecentMemories();

  const commits = getCommitsSinceLastRelease();

  if (commits.length === 0) {
    console.log('No commits found since last release.');
    return;
  }

  console.log(`Found ${commits.length} commit(s):\n`);

  const analysis = analyzeCommits(commits);

  // Print analysis
  console.log('📊 Analysis:');
  console.log(`  Breaking changes: ${analysis.breaking.length}`);
  console.log(`  Features (feat:): ${analysis.features.length}`);
  console.log(`  Fixes (fix/perf): ${analysis.fixes.length}`);
  console.log(`  Other: ${analysis.other.length}`);
  console.log('');
  console.log(`📦 Recommended bump: ${analysis.bumpType.toUpperCase()}`);
  console.log('');

  // Create changeset
  const filepath = createChangeset(analysis);
  const relativePath = path.relative(ROOT, filepath);

  console.log(`✅ Created changeset: ${relativePath}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review the changeset file');
  console.log('  2. Run: pnpm changeset:version');
  console.log('  3. Run: pnpm changeset:publish');
}

main();
