# Version Management Module - Component Architecture

> C4 Model Component Diagram and Design Documentation for krolik-cli Version Management

## Table of Contents

1. [Context Overview](#context-overview)
2. [Component Diagram](#component-diagram)
3. [Module Boundaries and Interfaces](#module-boundaries-and-interfaces)
4. [Data Flow](#data-flow)
5. [Integration Points](#integration-points)
6. [API Specifications](#api-specifications)
7. [Design Decisions](#design-decisions)
8. [Implementation Guide](#implementation-guide)

---

## Context Overview

### Purpose

The Version Management Module automates semantic versioning workflows for krolik-cli, integrating with:
- package.json version field
- Git tags for release tracking
- CHANGELOG.md generation and updates
- CI/CD pipeline triggers
- npm/pnpm publishing workflows

### Architecture Principles

Following krolik-cli standards:
- **SRP**: Single Responsibility Principle (one purpose per file, max 200 lines)
- **Pure Functions**: Prefer pure functions, explicit dependency injection
- **Result Types**: Use Result<T, E> for error handling
- **Path Configurability**: Config/args driven, never hardcoded paths
- **Explicit Exports**: Named exports only

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Version Management System                           │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          CLI Layer                                     │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │  src/cli/commands/version.ts                                      │ │  │
│  │  │  - Command registration and argument parsing                      │ │  │
│  │  │  - User interaction and confirmation prompts                      │ │  │
│  │  │  - Output formatting (AI-friendly XML / Human-readable)          │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      Command Orchestrator                              │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │  src/commands/version/orchestrator.ts                             │ │  │
│  │  │  - Workflow coordination (bump, tag, changelog, publish)          │ │  │
│  │  │  - Transaction management (rollback on failure)                   │ │  │
│  │  │  - Pre/post hooks execution                                       │ │  │
│  │  │  - Validation orchestration                                       │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│              ┌─────────────────────┼─────────────────────┐                  │
│              ▼                     ▼                     ▼                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│  │  Version Core    │  │  Git Tag Manager │  │ Changelog Manager│         │
│  │  ──────────────  │  │  ──────────────  │  │ ────────────────  │         │
│  │  version/        │  │  version/        │  │  version/         │         │
│  │  core.ts         │  │  git-tag.ts      │  │  changelog.ts     │         │
│  │                  │  │                  │  │                   │         │
│  │  - Bump version  │  │  - Create tags   │  │  - Generate       │         │
│  │  - Parse semver  │  │  - List tags     │  │  - Update         │         │
│  │  - Validate      │  │  - Delete tags   │  │  - Parse          │         │
│  │  - Prerelease    │  │  - Verify tags   │  │  - Format         │         │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘         │
│           │                      │                      │                   │
│           └──────────────────────┼──────────────────────┘                   │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      Adapters Layer                                    │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │  │
│  │  │ Package Adapter │  │   Git Adapter   │  │  CI/CD Adapter       │  │  │
│  │  │ ─────────────── │  │   ───────────   │  │  ──────────────       │  │  │
│  │  │ version/        │  │   version/      │  │  version/            │  │  │
│  │  │ adapters/       │  │   adapters/     │  │  adapters/           │  │  │
│  │  │ package.ts      │  │   git.ts        │  │  ci.ts               │  │  │
│  │  │                 │  │                 │  │                      │  │  │
│  │  │ - Read pkg.json │  │  - Tag ops      │  │  - Trigger pipeline  │  │  │
│  │  │ - Write version │  │  - Branch check │  │  - Set env vars      │  │  │
│  │  │ - Validate pkg  │  │  - Commit check │  │  - Output artifacts  │  │  │
│  │  └─────────────────┘  └─────────────────┘  └──────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Shared Libraries (lib/)                             │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │  │
│  │  │ core/fs  │  │   @git   │  │core/shell│  │core/logger│ │core/time│ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      External Systems                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │  │
│  │  │ package.json │  │   Git Repo   │  │ CHANGELOG.md │  │  CI/CD    │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └───────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Module Boundaries and Interfaces

### 1. CLI Layer

**Location**: `src/cli/commands/version.ts`

**Responsibilities**:
- Parse CLI arguments (bump type, prerelease identifier, etc.)
- Display interactive prompts for confirmation
- Format output (XML for AI, text for humans)
- Handle user cancellation

**Public Interface**:
```typescript
export function registerVersionCommand(program: Command): void;
```

**Dependencies**:
- `commander` - CLI framework
- `src/commands/version/orchestrator` - Business logic
- `src/lib/core/logger` - Logging utilities

---

### 2. Command Orchestrator

**Location**: `src/commands/version/orchestrator.ts`

**Responsibilities**:
- Coordinate version bump workflow
- Execute pre/post hooks
- Manage transaction state (backup/rollback)
- Validate preconditions (clean git, correct branch)
- Error recovery and cleanup

**Public Interface**:
```typescript
export interface VersionOptions {
  bump: 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease';
  preid?: string; // prerelease identifier (alpha, beta, rc)
  tag?: boolean; // create git tag
  push?: boolean; // push tag to remote
  changelog?: boolean; // update CHANGELOG.md
  commit?: boolean; // commit changes
  dryRun?: boolean; // preview changes
  force?: boolean; // skip validations
  cwd?: string; // working directory
}

export interface VersionResult {
  oldVersion: string;
  newVersion: string;
  tag?: string;
  changelogPath?: string;
  committed: boolean;
  pushed: boolean;
}

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export async function executeVersionWorkflow(
  options: VersionOptions
): Promise<Result<VersionResult>>;
```

**Transaction Flow**:
```typescript
// Internal workflow
1. Validate preconditions
2. Create backup (git stash + backup branch)
3. Execute workflow steps:
   - Bump version in package.json
   - Update CHANGELOG.md
   - Commit changes
   - Create git tag
   - Push to remote
4. On success: cleanup backup
5. On failure: rollback to backup state
```

---

### 3. Version Core

**Location**: `src/commands/version/core.ts`

**Responsibilities**:
- Semantic version parsing and manipulation
- Version bump calculation
- Prerelease version handling
- Version validation

**Public Interface**:
```typescript
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string[];
  build?: string[];
}

export function parseVersion(version: string): Result<SemVer>;

export function bumpVersion(
  current: SemVer,
  bump: VersionOptions['bump'],
  preid?: string
): SemVer;

export function formatVersion(semver: SemVer): string;

export function compareVersions(a: SemVer, b: SemVer): -1 | 0 | 1;

export function validateVersion(version: string): boolean;
```

**Example**:
```typescript
// Parse
const version = parseVersion('1.2.3-alpha.1+build.123');
// { major: 1, minor: 2, patch: 3, prerelease: ['alpha', '1'], build: ['build', '123'] }

// Bump
bumpVersion({ major: 1, minor: 2, patch: 3 }, 'minor');
// { major: 1, minor: 3, patch: 0 }

bumpVersion({ major: 1, minor: 2, patch: 3 }, 'prerelease', 'beta');
// { major: 1, minor: 2, patch: 4, prerelease: ['beta', '0'] }
```

---

### 4. Git Tag Manager

**Location**: `src/commands/version/git-tag.ts`

**Responsibilities**:
- Create annotated git tags
- List existing tags
- Delete tags (local/remote)
- Verify tag existence
- Push tags to remote

**Public Interface**:
```typescript
export interface GitTag {
  name: string;
  commit: string;
  message?: string;
  date?: string;
}

export interface TagOptions {
  name: string; // e.g., "v1.2.3"
  message?: string;
  annotated?: boolean;
  cwd?: string;
}

export async function createTag(options: TagOptions): Promise<Result<GitTag>>;

export async function deleteTag(
  tag: string,
  remote?: boolean,
  cwd?: string
): Promise<Result<void>>;

export async function listTags(cwd?: string): Promise<Result<GitTag[]>>;

export async function tagExists(tag: string, cwd?: string): Promise<boolean>;

export async function pushTag(
  tag: string,
  remote?: string,
  cwd?: string
): Promise<Result<void>>;

export async function getLatestTag(cwd?: string): Promise<Result<GitTag | null>>;
```

---

### 5. Changelog Manager

**Location**: `src/commands/version/changelog.ts`

**Responsibilities**:
- Parse existing CHANGELOG.md
- Generate new changelog entries
- Update changelog with new version
- Format changelog sections (Added, Changed, Fixed, etc.)
- Extract commits between versions

**Public Interface**:
```typescript
export interface ChangelogEntry {
  version: string;
  date: string;
  sections: {
    added?: string[];
    changed?: string[];
    deprecated?: string[];
    removed?: string[];
    fixed?: string[];
    security?: string[];
  };
  rawCommits?: string[];
}

export interface ChangelogOptions {
  version: string;
  date?: string; // defaults to today
  previousVersion?: string;
  includeCommits?: boolean;
  cwd?: string;
}

export async function parseChangelog(
  path: string
): Promise<Result<ChangelogEntry[]>>;

export async function generateChangelogEntry(
  options: ChangelogOptions
): Promise<Result<ChangelogEntry>>;

export async function updateChangelog(
  path: string,
  entry: ChangelogEntry
): Promise<Result<void>>;

export function formatChangelogEntry(entry: ChangelogEntry): string;

// Extract commits between two git refs
export async function getCommitsSince(
  since: string,
  until?: string,
  cwd?: string
): Promise<Result<string[]>>;
```

**Changelog Format** (Keep a Changelog):
```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2025-12-24

### Added
- New version management command
- Changelog auto-generation

### Changed
- Updated dependency versions

### Fixed
- Bug in git tag creation

## [1.1.0] - 2025-12-20
...
```

---

### 6. Package Adapter

**Location**: `src/commands/version/adapters/package.ts`

**Responsibilities**:
- Read package.json safely
- Update version field atomically
- Preserve formatting and comments
- Validate package.json structure
- Support monorepo scenarios (workspace packages)

**Public Interface**:
```typescript
export interface PackageJson {
  name: string;
  version: string;
  [key: string]: unknown;
}

export async function readPackageJson(
  cwd?: string
): Promise<Result<PackageJson>>;

export async function writePackageVersion(
  version: string,
  cwd?: string
): Promise<Result<void>>;

export async function getPackageVersion(
  cwd?: string
): Promise<Result<string>>;

export async function validatePackageJson(
  cwd?: string
): Promise<Result<boolean>>;

// For monorepo support
export async function findWorkspacePackages(
  cwd?: string
): Promise<Result<string[]>>;
```

**Implementation Notes**:
- Use `fs.readFile` + JSON.parse for reading
- Preserve indentation (detect 2 vs 4 spaces vs tabs)
- Atomic write: write to temp file, then rename
- Validate required fields (name, version)

---

### 7. Git Adapter

**Location**: `src/commands/version/adapters/git.ts`

**Responsibilities**:
- Wrap lib/@git operations with version-specific logic
- Validate git repository state
- Check for uncommitted changes
- Verify branch permissions
- Create version commits

**Public Interface**:
```typescript
export interface GitValidation {
  isRepo: boolean;
  hasUncommitted: boolean;
  currentBranch: string;
  isMainBranch: boolean;
  hasRemote: boolean;
}

export async function validateGitState(
  cwd?: string
): Promise<Result<GitValidation>>;

export async function createVersionCommit(
  version: string,
  files: string[],
  cwd?: string
): Promise<Result<string>>; // returns commit hash

export async function pushCommitAndTag(
  tag: string,
  remote?: string,
  cwd?: string
): Promise<Result<void>>;
```

---

### 8. CI/CD Adapter

**Location**: `src/commands/version/adapters/ci.ts`

**Responsibilities**:
- Detect CI environment (GitHub Actions, GitLab CI, etc.)
- Set CI environment variables
- Trigger pipeline events
- Generate release artifacts metadata

**Public Interface**:
```typescript
export interface CIEnvironment {
  name: 'github-actions' | 'gitlab-ci' | 'circleci' | 'jenkins' | 'none';
  isPR: boolean;
  branch: string;
  commit: string;
}

export function detectCI(): CIEnvironment;

export function setCIOutput(key: string, value: string): void;

export function setCIEnv(key: string, value: string): void;

// GitHub Actions specific
export function setGitHubOutput(outputs: Record<string, string>): void;

// Generate release notes for CI
export function generateReleaseMetadata(version: string, changelog: ChangelogEntry): {
  version: string;
  tag: string;
  notes: string;
  date: string;
};
```

**GitHub Actions Integration**:
```yaml
# Example workflow file
name: Release

on:
  workflow_dispatch:
    inputs:
      bump:
        description: 'Version bump type'
        required: true
        type: choice
        options:
          - patch
          - minor
          - major

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: pnpm install
      - name: Run version
        id: version
        run: |
          pnpm krolik version ${{ github.event.inputs.bump }} --tag --push --changelog
      - name: Publish to npm
        run: pnpm publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Data Flow

### Version Bump Flow (Happy Path)

```
┌─────────────────┐
│  User executes  │
│  krolik version │
│  minor --tag    │
└────────┬────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  1. CLI Layer (version.ts)                                     │
│     - Parse args: { bump: 'minor', tag: true }                 │
│     - Validate args                                            │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  2. Orchestrator (orchestrator.ts)                             │
│     - Create context with options                              │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  3. Pre-validation Phase                                       │
│     ┌──────────────────────────────────────────────────────┐   │
│     │ Git Adapter:                                         │   │
│     │  - Check is git repo ✓                              │   │
│     │  - Check no uncommitted changes ✓                   │   │
│     │  - Check on main/master branch ✓                    │   │
│     └──────────────────────────────────────────────────────┘   │
│     ┌──────────────────────────────────────────────────────┐   │
│     │ Package Adapter:                                     │   │
│     │  - Read package.json ✓                              │   │
│     │  - Validate structure ✓                             │   │
│     │  - Get current version: "1.2.3"                     │   │
│     └──────────────────────────────────────────────────────┘   │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  4. Backup Phase                                               │
│     - Git stash changes (if any)                               │
│     - Create backup branch: backup/version-1702854123          │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  5. Version Calculation                                        │
│     ┌──────────────────────────────────────────────────────┐   │
│     │ Version Core:                                        │   │
│     │  - Parse current: { major: 1, minor: 2, patch: 3 }  │   │
│     │  - Bump minor: { major: 1, minor: 3, patch: 0 }     │   │
│     │  - Format: "1.3.0"                                   │   │
│     └──────────────────────────────────────────────────────┘   │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  6. Package Update Phase                                       │
│     ┌──────────────────────────────────────────────────────┐   │
│     │ Package Adapter:                                     │   │
│     │  - Write version "1.3.0" to package.json            │   │
│     │  - Verify write success                             │   │
│     └──────────────────────────────────────────────────────┘   │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  7. Changelog Update Phase (if --changelog)                   │
│     ┌──────────────────────────────────────────────────────┐   │
│     │ Changelog Manager:                                   │   │
│     │  - Get commits since last tag                        │   │
│     │  - Generate changelog entry for 1.3.0                │   │
│     │  - Update CHANGELOG.md                               │   │
│     └──────────────────────────────────────────────────────┘   │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  8. Git Commit Phase (if --commit)                            │
│     ┌──────────────────────────────────────────────────────┐   │
│     │ Git Adapter:                                         │   │
│     │  - Stage: package.json, CHANGELOG.md                 │   │
│     │  - Commit: "chore: release v1.3.0"                   │   │
│     │  - Get commit hash: abc1234                          │   │
│     └──────────────────────────────────────────────────────┘   │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  9. Git Tag Phase (if --tag)                                  │
│     ┌──────────────────────────────────────────────────────┐   │
│     │ Git Tag Manager:                                     │   │
│     │  - Create annotated tag: v1.3.0                      │   │
│     │  - Message: "Release version 1.3.0"                  │   │
│     └──────────────────────────────────────────────────────┘   │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  10. Push Phase (if --push)                                   │
│     ┌──────────────────────────────────────────────────────┐   │
│     │ Git Adapter:                                         │   │
│     │  - Push commit to origin/main                        │   │
│     │  - Push tag v1.3.0 to origin                         │   │
│     └──────────────────────────────────────────────────────┘   │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  11. Cleanup Phase                                             │
│     - Delete backup branch                                     │
│     - Drop stash                                               │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  12. Output Result                                             │
│     {                                                          │
│       success: true,                                           │
│       data: {                                                  │
│         oldVersion: "1.2.3",                                   │
│         newVersion: "1.3.0",                                   │
│         tag: "v1.3.0",                                         │
│         changelogPath: "CHANGELOG.md",                         │
│         committed: true,                                       │
│         pushed: true                                           │
│       }                                                        │
│     }                                                          │
└────────────────────────────────────────────────────────────────┘
```

### Error Flow (Rollback)

```
┌────────────────────────────────────────────────────────────────┐
│  Error occurs at any phase                                     │
│  (e.g., git push fails due to network)                         │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  Orchestrator catches error                                    │
│  - Log error details                                           │
│  - Start rollback procedure                                    │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  Rollback Phase                                                │
│  1. Delete created tag (if exists)                             │
│  2. Reset to backup branch                                     │
│  3. Restore package.json                                       │
│  4. Restore CHANGELOG.md                                       │
│  5. Apply stashed changes                                      │
└────────┬───────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  Return error result                                           │
│  {                                                             │
│    success: false,                                             │
│    error: {                                                    │
│      message: "Failed to push to remote",                      │
│      phase: "push",                                            │
│      rolledBack: true                                          │
│    }                                                           │
│  }                                                             │
└────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### 1. package.json Integration

**Read Path**:
```typescript
// src/commands/version/adapters/package.ts
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function readPackageJson(cwd = process.cwd()): Promise<Result<PackageJson>> {
  try {
    const pkgPath = resolve(cwd, 'package.json');
    const content = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as PackageJson;

    if (!pkg.version) {
      return {
        success: false,
        error: new Error('package.json missing version field')
      };
    }

    return { success: true, data: pkg };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}
```

**Write Path**:
```typescript
export async function writePackageVersion(
  version: string,
  cwd = process.cwd()
): Promise<Result<void>> {
  try {
    const pkgPath = resolve(cwd, 'package.json');

    // Read current content to preserve formatting
    const content = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as PackageJson;

    // Detect indentation
    const indent = detectIndent(content);

    // Update version
    pkg.version = version;

    // Write atomically (temp file + rename)
    const newContent = JSON.stringify(pkg, null, indent) + '\n';
    const tempPath = `${pkgPath}.tmp`;

    await writeFile(tempPath, newContent, 'utf-8');
    await rename(tempPath, pkgPath);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

function detectIndent(content: string): string {
  const match = content.match(/^(\s+)/m);
  return match ? match[1] : '  '; // default to 2 spaces
}
```

---

### 2. Git Tags Integration

**Create Tag**:
```typescript
// src/commands/version/git-tag.ts
import { tryExec } from '@/lib/core/shell';

export async function createTag(options: TagOptions): Promise<Result<GitTag>> {
  const { name, message, annotated = true, cwd } = options;

  // Check tag doesn't exist
  if (await tagExists(name, cwd)) {
    return {
      success: false,
      error: new Error(`Tag ${name} already exists`)
    };
  }

  // Create tag
  const tagCmd = annotated
    ? `git tag -a ${name} -m "${message || `Release ${name}`}"`
    : `git tag ${name}`;

  const result = tryExec(tagCmd, { cwd });

  if (!result.success) {
    return {
      success: false,
      error: new Error(`Failed to create tag: ${result.error}`)
    };
  }

  // Get tag info
  const infoCmd = `git show ${name} --format="%H%n%an%n%ai" --no-patch`;
  const infoResult = tryExec(infoCmd, { cwd });

  if (!infoResult.success) {
    return {
      success: true,
      data: { name, commit: '', message }
    };
  }

  const [commit, author, date] = infoResult.output.split('\n');

  return {
    success: true,
    data: {
      name,
      commit: commit || '',
      message,
      date
    }
  };
}
```

**List Tags**:
```typescript
export async function listTags(cwd?: string): Promise<Result<GitTag[]>> {
  const cmd = 'git tag --list --format=%(refname:short)|%(objectname:short)|%(creatordate:short)';
  const result = tryExec(cmd, { cwd });

  if (!result.success) {
    return { success: false, error: new Error('Failed to list tags') };
  }

  const tags = result.output
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [name, commit, date] = line.split('|');
      return {
        name: name || '',
        commit: commit || '',
        date: date || ''
      };
    });

  return { success: true, data: tags };
}
```

**Push Tag**:
```typescript
export async function pushTag(
  tag: string,
  remote = 'origin',
  cwd?: string
): Promise<Result<void>> {
  const cmd = `git push ${remote} ${tag}`;
  const result = tryExec(cmd, { cwd });

  if (!result.success) {
    return {
      success: false,
      error: new Error(`Failed to push tag ${tag}: ${result.error}`)
    };
  }

  return { success: true, data: undefined };
}
```

---

### 3. CHANGELOG.md Integration

**Parse Existing Changelog**:
```typescript
// src/commands/version/changelog.ts
export async function parseChangelog(path: string): Promise<Result<ChangelogEntry[]>> {
  try {
    const content = await readFile(path, 'utf-8');
    const entries: ChangelogEntry[] = [];

    // Regex to match version headers: ## [1.2.3] - 2025-12-24
    const versionRegex = /^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})$/gm;

    let match: RegExpExecArray | null;
    const positions: Array<{ version: string; date: string; start: number }> = [];

    while ((match = versionRegex.exec(content)) !== null) {
      positions.push({
        version: match[1] || '',
        date: match[2] || '',
        start: match.index
      });
    }

    // Parse each version section
    for (let i = 0; i < positions.length; i++) {
      const current = positions[i];
      const next = positions[i + 1];

      if (!current) continue;

      const sectionEnd = next ? next.start : content.length;
      const sectionContent = content.slice(current.start, sectionEnd);

      entries.push(parseSection(current.version, current.date, sectionContent));
    }

    return { success: true, data: entries };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

function parseSection(version: string, date: string, content: string): ChangelogEntry {
  const sections: ChangelogEntry['sections'] = {};

  // Parse ### Added, ### Changed, etc.
  const categoryRegex = /^### (Added|Changed|Deprecated|Removed|Fixed|Security)$/gm;
  const categories = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'] as const;

  for (const category of categories) {
    const regex = new RegExp(`### ${category}\\n([\\s\\S]*?)(?=###|$)`, 'i');
    const match = content.match(regex);

    if (match && match[1]) {
      const items = match[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().replace(/^-\s*/, ''));

      if (items.length > 0) {
        sections[category.toLowerCase() as keyof typeof sections] = items;
      }
    }
  }

  return { version, date, sections };
}
```

**Generate New Entry**:
```typescript
export async function generateChangelogEntry(
  options: ChangelogOptions
): Promise<Result<ChangelogEntry>> {
  const { version, date = formatDate(new Date()), previousVersion, cwd } = options;

  try {
    // Get commits since previous version
    const commits = previousVersion
      ? await getCommitsSince(previousVersion, 'HEAD', cwd)
      : { success: true, data: [] };

    if (!commits.success) {
      return commits;
    }

    // Categorize commits by conventional commit format
    const sections = categorizeCommits(commits.data);

    return {
      success: true,
      data: {
        version,
        date,
        sections,
        rawCommits: commits.data
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

function categorizeCommits(commits: string[]): ChangelogEntry['sections'] {
  const sections: ChangelogEntry['sections'] = {
    added: [],
    changed: [],
    fixed: [],
    deprecated: [],
    removed: [],
    security: []
  };

  for (const commit of commits) {
    // Parse conventional commit: feat: add feature
    const match = commit.match(/^([a-z]+)(\(.+\))?:\s*(.+)$/);

    if (!match) {
      sections.changed?.push(commit);
      continue;
    }

    const [, type, , message] = match;

    switch (type) {
      case 'feat':
        sections.added?.push(message || '');
        break;
      case 'fix':
        sections.fixed?.push(message || '');
        break;
      case 'refactor':
      case 'perf':
        sections.changed?.push(message || '');
        break;
      case 'docs':
        // Skip docs from changelog
        break;
      default:
        sections.changed?.push(message || '');
    }
  }

  return sections;
}
```

**Update Changelog**:
```typescript
export async function updateChangelog(
  path: string,
  entry: ChangelogEntry
): Promise<Result<void>> {
  try {
    // Read existing changelog
    let content = '';
    try {
      content = await readFile(path, 'utf-8');
    } catch {
      // Create new changelog if doesn't exist
      content = createChangelogTemplate();
    }

    // Format new entry
    const newEntry = formatChangelogEntry(entry);

    // Insert after ## [Unreleased] section
    const unreleasedIndex = content.indexOf('## [Unreleased]');

    if (unreleasedIndex === -1) {
      // No unreleased section, add at top
      content = content.replace(
        /^(# Changelog.*?\n\n)/s,
        `$1## [Unreleased]\n\n${newEntry}\n`
      );
    } else {
      // Insert after unreleased section
      const afterUnreleased = content.indexOf('\n## ', unreleasedIndex + 1);
      const insertPos = afterUnreleased === -1 ? content.length : afterUnreleased;

      content =
        content.slice(0, insertPos) +
        '\n' + newEntry + '\n' +
        content.slice(insertPos);
    }

    await writeFile(path, content, 'utf-8');
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

export function formatChangelogEntry(entry: ChangelogEntry): string {
  const lines: string[] = [];

  lines.push(`## [${entry.version}] - ${entry.date}`);
  lines.push('');

  const order: Array<keyof ChangelogEntry['sections']> = [
    'added',
    'changed',
    'deprecated',
    'removed',
    'fixed',
    'security'
  ];

  for (const category of order) {
    const items = entry.sections[category];
    if (!items || items.length === 0) continue;

    const title = category.charAt(0).toUpperCase() + category.slice(1);
    lines.push(`### ${title}`);

    for (const item of items) {
      lines.push(`- ${item}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

function createChangelogTemplate(): string {
  return `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

`;
}
```

---

### 4. CI/CD Pipeline Integration

**Detect CI Environment**:
```typescript
// src/commands/version/adapters/ci.ts
export function detectCI(): CIEnvironment {
  const env = process.env;

  // GitHub Actions
  if (env.GITHUB_ACTIONS === 'true') {
    return {
      name: 'github-actions',
      isPR: env.GITHUB_EVENT_NAME === 'pull_request',
      branch: env.GITHUB_REF_NAME || '',
      commit: env.GITHUB_SHA || ''
    };
  }

  // GitLab CI
  if (env.GITLAB_CI === 'true') {
    return {
      name: 'gitlab-ci',
      isPR: env.CI_MERGE_REQUEST_ID !== undefined,
      branch: env.CI_COMMIT_BRANCH || '',
      commit: env.CI_COMMIT_SHA || ''
    };
  }

  // CircleCI
  if (env.CIRCLECI === 'true') {
    return {
      name: 'circleci',
      isPR: env.CIRCLE_PULL_REQUEST !== undefined,
      branch: env.CIRCLE_BRANCH || '',
      commit: env.CIRCLE_SHA1 || ''
    };
  }

  return {
    name: 'none',
    isPR: false,
    branch: '',
    commit: ''
  };
}
```

**GitHub Actions Output**:
```typescript
export function setGitHubOutput(outputs: Record<string, string>): void {
  const outputFile = process.env.GITHUB_OUTPUT;

  if (!outputFile) {
    console.warn('Not in GitHub Actions environment');
    return;
  }

  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);

  fs.appendFileSync(outputFile, lines.join('\n') + '\n');
}

// Usage in orchestrator:
if (detectCI().name === 'github-actions') {
  setGitHubOutput({
    version: result.newVersion,
    tag: result.tag || '',
    changelog_path: result.changelogPath || ''
  });
}
```

**Release Metadata**:
```typescript
export function generateReleaseMetadata(
  version: string,
  changelog: ChangelogEntry
): {
  version: string;
  tag: string;
  notes: string;
  date: string;
} {
  return {
    version,
    tag: `v${version}`,
    notes: formatChangelogEntry(changelog),
    date: changelog.date
  };
}
```

**Example GitHub Actions Workflow**:
```yaml
# .github/workflows/release.yml
name: Release

on:
  workflow_dispatch:
    inputs:
      bump:
        description: 'Version bump type'
        required: true
        type: choice
        options:
          - patch
          - minor
          - major
          - prepatch
          - preminor
          - premajor
      prerelease:
        description: 'Prerelease identifier (alpha, beta, rc)'
        required: false
        type: string

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Need full history for changelog

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Run version
        id: version
        run: |
          PREID="${{ github.event.inputs.prerelease }}"
          if [ -n "$PREID" ]; then
            pnpm krolik version ${{ github.event.inputs.bump }} --preid "$PREID" --tag --push --changelog --commit
          else
            pnpm krolik version ${{ github.event.inputs.bump }} --tag --push --changelog --commit
          fi

      - name: Build
        run: pnpm build

      - name: Publish to npm
        run: pnpm publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ steps.version.outputs.tag }}
          release_name: Release ${{ steps.version.outputs.version }}
          body_path: CHANGELOG.md
          draft: false
          prerelease: ${{ contains(steps.version.outputs.version, '-') }}
```

---

## API Specifications

### CLI Command Interface

```bash
# Basic usage
krolik version <bump>

# With options
krolik version <bump> [options]

# Bump types
krolik version patch      # 1.2.3 → 1.2.4
krolik version minor      # 1.2.3 → 1.3.0
krolik version major      # 1.2.3 → 2.0.0

# Prerelease
krolik version prepatch --preid beta   # 1.2.3 → 1.2.4-beta.0
krolik version preminor --preid alpha  # 1.2.3 → 1.3.0-alpha.0
krolik version prerelease --preid rc   # 1.2.4-beta.0 → 1.2.4-rc.0

# Options
--tag              Create git tag (default: true)
--no-tag           Skip git tag creation
--push             Push commit and tag to remote (default: false)
--changelog        Update CHANGELOG.md (default: true)
--no-changelog     Skip changelog update
--commit           Commit changes (default: true)
--no-commit        Skip git commit
--preid <id>       Prerelease identifier (alpha, beta, rc)
--dry-run          Preview changes without applying
--force            Skip validation checks
--cwd <path>       Working directory (default: process.cwd())

# Output format
--json             Output as JSON
--xml              Output as AI-friendly XML (default for MCP)
-q, --quiet        Minimal output
-v, --verbose      Detailed output

# Examples
krolik version patch --tag --push
krolik version minor --dry-run
krolik version prerelease --preid rc --no-push
krolik version major --force --cwd /path/to/project
```

### MCP Tool Interface

```typescript
// MCP tool: krolik_version
{
  "name": "krolik_version",
  "description": "Bump package version, update changelog, create git tags",
  "parameters": {
    "bump": {
      "type": "string",
      "enum": ["major", "minor", "patch", "premajor", "preminor", "prepatch", "prerelease"],
      "description": "Version bump type",
      "required": true
    },
    "preid": {
      "type": "string",
      "description": "Prerelease identifier (alpha, beta, rc)",
      "required": false
    },
    "tag": {
      "type": "boolean",
      "description": "Create git tag (default: true)",
      "required": false
    },
    "push": {
      "type": "boolean",
      "description": "Push to remote (default: false)",
      "required": false
    },
    "changelog": {
      "type": "boolean",
      "description": "Update CHANGELOG.md (default: true)",
      "required": false
    },
    "commit": {
      "type": "boolean",
      "description": "Commit changes (default: true)",
      "required": false
    },
    "dryRun": {
      "type": "boolean",
      "description": "Preview without applying",
      "required": false
    }
  }
}
```

---

## Design Decisions

### 1. Semantic Versioning Strategy

**Decision**: Use strict semver 2.0.0 specification

**Rationale**:
- Industry standard for npm packages
- Clear communication of breaking changes
- Automated dependency management compatibility
- Enables range-based dependency resolution

**Implementation**:
- Major: Breaking changes
- Minor: New features (backward compatible)
- Patch: Bug fixes (backward compatible)
- Prerelease: alpha, beta, rc identifiers

---

### 2. Transaction Safety

**Decision**: Implement backup/rollback mechanism for all version operations

**Rationale**:
- Prevent partial state (e.g., version bumped but tag creation fails)
- Allow safe recovery from network failures
- Build user confidence in automation

**Implementation**:
```typescript
1. Create backup before any mutations
   - Git stash for uncommitted changes
   - Create backup branch with timestamp

2. Execute workflow steps sequentially

3. On failure:
   - Delete created tags
   - Reset to backup branch
   - Restore stashed changes
   - Return detailed error

4. On success:
   - Cleanup backup branch
   - Drop stash
   - Return success result
```

---

### 3. Changelog Format

**Decision**: Use "Keep a Changelog" format with conventional commits

**Rationale**:
- Human-readable and machine-parseable
- Industry standard (keepachangelog.com)
- Integrates with conventional commit messages
- Supports categorization (Added, Changed, Fixed, etc.)

**Categories**:
- Added: New features
- Changed: Modifications to existing features
- Deprecated: Soon-to-be removed features
- Removed: Deleted features
- Fixed: Bug fixes
- Security: Security patches

---

### 4. Git Tag Format

**Decision**: Use `v` prefix and annotated tags

**Rationale**:
- `v` prefix is npm/GitHub convention
- Annotated tags include metadata (author, date, message)
- Enables better release tracking
- Required for GitHub release automation

**Format**: `v<major>.<minor>.<patch>[-<prerelease>]`

Examples:
- `v1.2.3`
- `v2.0.0-alpha.1`
- `v1.3.0-beta.2`

---

### 5. Validation Strategy

**Decision**: Implement multi-layer validation with --force override

**Layers**:
1. **Git validation**:
   - Must be in git repository
   - Must be on main/master branch (configurable)
   - Must have no uncommitted changes
   - Must have remote configured (if --push)

2. **Package validation**:
   - package.json must exist
   - Must have valid version field
   - Must have valid semver format

3. **Version validation**:
   - New version must be higher than current
   - Prerelease identifiers must be valid

**Override**: `--force` flag skips all validations (use with caution)

---

### 6. CI/CD Integration Approach

**Decision**: Environment detection with explicit outputs

**Rationale**:
- Support multiple CI platforms
- Provide structured outputs for downstream jobs
- Enable GitHub Actions release automation
- Allow manual triggering with workflow_dispatch

**Supported Platforms**:
- GitHub Actions (primary)
- GitLab CI
- CircleCI
- Jenkins
- Manual (local)

---

### 7. Monorepo Support (Future)

**Decision**: Design with monorepo support in mind, implement later

**Considerations**:
- Detect workspace packages (pnpm, yarn, npm workspaces)
- Option to version all packages together vs. independent
- Changelog per package vs. root changelog
- Git tags per package: `@scope/package@1.2.3`

**Phase 1 (Current)**: Single package support
**Phase 2**: Monorepo with independent versioning
**Phase 3**: Changesets integration

---

## Implementation Guide

### File Structure

```
krolik-cli/
├── src/
│   ├── cli/
│   │   └── commands/
│   │       └── version.ts              # CLI registration
│   │
│   ├── commands/
│   │   └── version/
│   │       ├── orchestrator.ts          # Main workflow coordinator
│   │       ├── core.ts                  # Semver logic
│   │       ├── git-tag.ts               # Git tag operations
│   │       ├── changelog.ts             # Changelog operations
│   │       │
│   │       ├── adapters/
│   │       │   ├── package.ts           # package.json adapter
│   │       │   ├── git.ts               # Git adapter
│   │       │   └── ci.ts                # CI/CD adapter
│   │       │
│   │       ├── validators/
│   │       │   ├── git-validator.ts     # Git state validation
│   │       │   ├── package-validator.ts # Package validation
│   │       │   └── version-validator.ts # Version validation
│   │       │
│   │       └── types.ts                 # Type definitions
│   │
│   ├── mcp/
│   │   └── handlers/
│   │       └── version.ts               # MCP tool handler
│   │
│   └── types/
│       └── commands/
│           └── version.ts               # Public type exports
│
└── tests/
    └── commands/
        └── version/
            ├── core.test.ts
            ├── git-tag.test.ts
            ├── changelog.test.ts
            └── orchestrator.test.ts
```

### Implementation Phases

**Phase 1: Core Functionality** (Week 1)
- [ ] Semver parsing and bumping (core.ts)
- [ ] Package.json read/write (adapters/package.ts)
- [ ] Basic CLI command (cli/commands/version.ts)
- [ ] Unit tests for core logic

**Phase 2: Git Integration** (Week 2)
- [ ] Git tag creation and management (git-tag.ts)
- [ ] Git state validation (validators/git-validator.ts)
- [ ] Git adapter wrapper (adapters/git.ts)
- [ ] Backup/rollback mechanism

**Phase 3: Changelog** (Week 3)
- [ ] Changelog parsing (changelog.ts)
- [ ] Changelog generation from commits
- [ ] Conventional commit parsing
- [ ] Changelog update logic

**Phase 4: Orchestration** (Week 4)
- [ ] Workflow coordinator (orchestrator.ts)
- [ ] Transaction management
- [ ] Error handling and rollback
- [ ] Integration tests

**Phase 5: CI/CD** (Week 5)
- [ ] CI environment detection (adapters/ci.ts)
- [ ] GitHub Actions integration
- [ ] Output formatting for CI
- [ ] Example workflows

**Phase 6: MCP Tool** (Week 6)
- [ ] MCP handler (mcp/handlers/version.ts)
- [ ] AI-friendly XML output
- [ ] MCP tool registration
- [ ] Documentation

---

### Example Usage Scenarios

**Scenario 1: Patch Release**
```bash
# Developer workflow
git checkout main
git pull origin main
pnpm krolik version patch --tag --push --changelog

# What happens:
# 1. Validates git state (clean, on main)
# 2. Bumps 1.2.3 → 1.2.4 in package.json
# 3. Generates changelog from commits since v1.2.3
# 4. Commits: "chore: release v1.2.4"
# 5. Creates tag: v1.2.4
# 6. Pushes commit + tag to origin
```

**Scenario 2: Prerelease**
```bash
# Create beta release
pnpm krolik version preminor --preid beta --tag

# 1.2.3 → 1.3.0-beta.0
# Creates tag v1.3.0-beta.0 locally (doesn't push)
```

**Scenario 3: CI/CD Automated Release**
```yaml
# GitHub Actions workflow
- name: Release
  run: pnpm krolik version ${{ inputs.bump }} --tag --push --changelog

# CI detects environment and outputs:
# version=1.3.0
# tag=v1.3.0
# changelog_path=CHANGELOG.md
```

**Scenario 4: Dry Run**
```bash
# Preview changes
pnpm krolik version minor --dry-run

# Output:
# Current version: 1.2.3
# New version: 1.3.0
# Tag: v1.3.0
# Files to modify:
#   - package.json
#   - CHANGELOG.md
# No changes applied (dry run)
```

---

### Testing Strategy

**Unit Tests**:
- `core.test.ts`: Semver parsing, bumping, formatting
- `git-tag.test.ts`: Tag creation, listing, deletion
- `changelog.test.ts`: Parsing, generation, formatting
- `adapters/*.test.ts`: Package, git, CI adapter logic

**Integration Tests**:
- `orchestrator.test.ts`: Full workflow with mocked file system
- End-to-end scenarios with temporary git repositories

**E2E Tests**:
- Real git repository setup
- Actual package.json manipulation
- Changelog generation from commits

---

### Error Handling

**Error Categories**:
1. **Validation Errors** (user recoverable):
   - Not in git repo
   - Uncommitted changes
   - Invalid version format
   - Response: Clear message + suggestion

2. **System Errors** (transient):
   - Network failure during push
   - File system permission errors
   - Response: Rollback + retry suggestion

3. **Logic Errors** (bugs):
   - Unexpected state
   - Invalid semver calculation
   - Response: Rollback + bug report link

**Error Response Format**:
```typescript
{
  success: false,
  error: {
    code: 'GIT_UNCOMMITTED_CHANGES',
    message: 'Cannot version with uncommitted changes',
    suggestion: 'Commit or stash your changes first',
    phase: 'validation',
    rolledBack: false
  }
}
```

---

## Appendix: Type Definitions

```typescript
// src/commands/version/types.ts

/**
 * Semantic version structure
 */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string[];
  build?: string[];
}

/**
 * Version bump types
 */
export type BumpType =
  | 'major'
  | 'minor'
  | 'patch'
  | 'premajor'
  | 'preminor'
  | 'prepatch'
  | 'prerelease';

/**
 * Version command options
 */
export interface VersionOptions {
  bump: BumpType;
  preid?: string;
  tag?: boolean;
  push?: boolean;
  changelog?: boolean;
  commit?: boolean;
  dryRun?: boolean;
  force?: boolean;
  cwd?: string;
  remote?: string;
}

/**
 * Version operation result
 */
export interface VersionResult {
  oldVersion: string;
  newVersion: string;
  tag?: string;
  changelogPath?: string;
  committed: boolean;
  pushed: boolean;
}

/**
 * Git tag information
 */
export interface GitTag {
  name: string;
  commit: string;
  message?: string;
  date?: string;
}

/**
 * Changelog entry structure
 */
export interface ChangelogEntry {
  version: string;
  date: string;
  sections: {
    added?: string[];
    changed?: string[];
    deprecated?: string[];
    removed?: string[];
    fixed?: string[];
    security?: string[];
  };
  rawCommits?: string[];
}

/**
 * Package.json structure
 */
export interface PackageJson {
  name: string;
  version: string;
  [key: string]: unknown;
}

/**
 * CI environment detection
 */
export interface CIEnvironment {
  name: 'github-actions' | 'gitlab-ci' | 'circleci' | 'jenkins' | 'none';
  isPR: boolean;
  branch: string;
  commit: string;
}

/**
 * Git state validation result
 */
export interface GitValidation {
  isRepo: boolean;
  hasUncommitted: boolean;
  currentBranch: string;
  isMainBranch: boolean;
  hasRemote: boolean;
}

/**
 * Result type for error handling
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Validation error with recovery suggestions
 */
export interface ValidationError extends Error {
  code: string;
  suggestion?: string;
  phase: 'validation' | 'execution' | 'rollback';
  rolledBack: boolean;
}
```

---

## Summary

This architecture provides a robust, extensible version management system for krolik-cli with:

1. **Clean Separation of Concerns**: CLI, orchestration, core logic, and adapters
2. **Transaction Safety**: Backup/rollback mechanism prevents partial states
3. **Multiple Integration Points**: package.json, Git tags, CHANGELOG.md, CI/CD
4. **Flexible Workflow**: Support for various release scenarios (patch, prerelease, etc.)
5. **CI/CD Ready**: Built-in GitHub Actions integration with extensible adapter pattern
6. **Future-Proof**: Designed for monorepo support and changesets integration

The modular design follows krolik-cli's SRP principles, with each component under 200 lines and focused on a single responsibility. The Result type pattern ensures explicit error handling, and the adapter pattern allows easy extension to new package managers or CI platforms.
