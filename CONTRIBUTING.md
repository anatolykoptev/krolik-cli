# Contributing to Krolik CLI

Thank you for your interest in contributing to Krolik CLI — an AI-assisted development toolkit with CLI and MCP server for Claude Code integration.

This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Custom CLAUDE.md Sections](#custom-claudemd-sections)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Releasing](#releasing)
- [Code of Conduct](#code-of-conduct)
- [License](#license)

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20.0.0
- **pnpm** >= 10.0.0 (recommended package manager)
- **Git**
- **TypeScript** >= 5.0.0 (peer dependency)

### Initial Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/anatolykoptev/krolik-cli.git
   cd krolik-cli
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Verify the setup:
   ```bash
   pnpm typecheck    # TypeScript type checking
   pnpm lint         # Biome linting
   pnpm test:run     # Run tests
   pnpm build        # Build the project
   ```

5. Link the CLI for local development:
   ```bash
   pnpm link --global
   krolik --version  # Should show your local version
   ```

## Development Workflow

### Branching Strategy

- **main** - Production-ready code, protected branch
- **dev** - Development branch for integration
- **feature/** - Feature branches (e.g., `feature/add-refactor-command`)
- **fix/** - Bug fix branches (e.g., `fix/context-parsing-error`)
- **docs/** - Documentation updates (e.g., `docs/update-contributing`)

### Creating a Branch

```bash
git checkout -b feature/your-feature-name
```

### Development Commands

```bash
# Development with hot reload
pnpm dev

# Type checking (strict mode)
pnpm typecheck

# Linting and formatting
pnpm lint              # Check for issues
pnpm lint:fix          # Auto-fix issues
pnpm format            # Format code
pnpm check:fix         # Lint + format in one command

# Testing
pnpm test              # Run tests in watch mode
pnpm test:run          # Run tests once
pnpm test:coverage     # Generate coverage report

# Building
pnpm build             # Build for production
```

### Commit Messages

We follow conventional commits for clear, semantic versioning-friendly commit history:

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, no logic change)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `chore` - Build process, dependencies, tooling

**Examples:**
```bash
feat(fix): add --backup flag for safe fixes
fix(context): handle missing GitHub issue gracefully
docs(readme): update installation instructions
refactor(mcp): extract handler registration logic
test(status): add coverage for fast mode
```

### Pre-commit Hooks

The project uses Husky + lint-staged to enforce quality before commits:

- **Biome check** - Automatically runs on staged `.ts`, `.tsx` files
- **Biome format** - Automatically runs on staged `.json`, `.md`, `.yml`, `.yaml` files

If checks fail, your commit will be blocked. Fix the issues and try again.

## Code Style

### TypeScript Standards

- **Strict mode enabled** - All strict TypeScript checks are enforced
- **Explicit types** - Always declare return types for functions
- **No `any`** - Use `unknown` or proper types instead
- **Named exports only** - No default exports

```typescript
// Good
export function analyze(files: string[]): AnalysisResult {
  // ...
}

// Bad
export default function analyze(files) {
  // ...
}
```

### Import Order

Organize imports in the following order:

1. Node.js built-in modules (prefixed with `node:`)
2. External dependencies
3. Internal modules (using `@/` alias)
4. Relative imports

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';

import { Command } from 'commander';
import chalk from 'chalk';

import { loadConfig } from '@/config';
import { createLogger } from '@/lib/log';

import { formatOutput } from './output';
import type { StatusOptions } from './types';
```

### Architecture Principles

Follow the Single Responsibility Principle (SRP):

- **One purpose per file** - Keep files focused and under 200 lines
- **Pure functions first** - Prefer pure functions over side effects
- **Explicit dependencies** - Use dependency injection, avoid globals
- **Configurable paths** - Never hardcode file paths

### Biome Configuration

The project uses Biome for linting and formatting. Configuration is in `biome.json`:

- **Line width:** 100 characters
- **Indentation:** Tabs
- **Quotes:** Single quotes
- **Semicolons:** Required
- **Trailing commas:** All

Run Biome checks:
```bash
pnpm check        # Check all issues
pnpm check:fix    # Auto-fix all issues
```

## Custom CLAUDE.md Sections

`src/lib/@docs/sections/` — plugin system for `<!-- krolik:start -->` block.

```typescript
// src/lib/@docs/sections/providers/my-section.ts
import type { SectionProvider } from '../types';
import { SectionPriority } from '../types';

export const mySection: SectionProvider = {
  id: 'my-section',
  name: 'My Section',
  priority: SectionPriority.CUSTOM, // 100=startup, 200=cache, 300=subdocs, 400=tools, 500=custom
  dependencies: ['context-cache'], // optional
  shouldRender: (ctx) => ctx.tools.length > 0, // optional
  render: (ctx) => `### My Section\nctx: projectRoot, tools, subDocs, version, cache`,
};

// Register in providers/index.ts → registerBuiltinSections()
```

Test: `pnpm build && ./dist/bin/cli.js sync`

## Testing

### Framework

The project uses **Vitest** for testing with the following structure:

```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
└── fixtures/       # Test data and mocks
```

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { analyze } from '@/commands/status/analyze';

describe('analyze', () => {
  it('should detect TypeScript errors', () => {
    const result = analyze(['src/test.ts']);
    expect(result.errors).toHaveLength(1);
  });

  it('should handle empty file list', () => {
    const result = analyze([]);
    expect(result.errors).toHaveLength(0);
  });
});
```

### Running Tests

```bash
# Watch mode (recommended during development)
pnpm test

# Single run
pnpm test:run

# With coverage report
pnpm test:coverage
```

### Coverage Requirements

- **New features:** Should include tests
- **Bug fixes:** Should include regression tests

Run `pnpm test:coverage` locally to generate HTML report in `coverage/`.

## Pull Request Process

### Before Submitting

Ensure your changes pass all checks:

```bash
# 1. Type check
pnpm typecheck

# 2. Lint
pnpm lint

# 3. Tests
pnpm test:run

# 4. Build
pnpm build
```

### Submitting a Pull Request

1. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** on GitHub from your fork to `anatolykoptev/krolik-cli:dev`

3. **Fill out the PR template** with:
   - Clear description of changes
   - Related issue(s) if applicable
   - Test plan and verification steps
   - Screenshots/examples if relevant

4. **Wait for CI checks** to pass:
   - Code quality (lint, typecheck, build)
   - Tests (unit + coverage)
   - Release check (on main branch only)

5. **Respond to review feedback** promptly

### PR Guidelines

- **Keep PRs focused** - One feature/fix per PR
- **Keep PRs small** - Easier to review and merge
- **Update documentation** - If your changes affect user-facing features
- **Add tests** - For new features and bug fixes
- **Follow commit conventions** - Use conventional commit format
- **Rebase on dev** - Keep your branch up to date

### Review Process

1. **Automated checks** run on every PR (GitHub Actions)
2. **Maintainer review** - At least one approval required
3. **Feedback addressed** - All review comments resolved
4. **Final approval** - Maintainer merges to `dev`
5. **Release** - Changes included in next release from `main`

### CI/CD Pipeline

The project uses GitHub Actions for continuous integration:

**On every push/PR:**
- Lint check (Biome)
- Type check (TypeScript strict mode)
- Build verification
- Test suite with coverage

**On release:**
- Automated version bump (Changesets)
- Publish to npm via OIDC Trusted Publishers

## Releasing

### Version Management

The project uses [Changesets](https://github.com/changesets/changesets) for version management and changelog generation.

**Creating a changeset:**
```bash
pnpm changeset
# Follow prompts to describe your change
# Select: patch | minor | major
```

Changesets are automatically processed on merge to `main`.

### Publishing to npm

**Automated via Trusted Publishers (recommended):**

1. Push changeset to `main` branch
2. GitHub Actions workflow automatically:
   - Runs `changeset version` to bump version
   - Commits version changes
   - Builds the package
   - Publishes to npm using OIDC (no token needed)
   - Creates GitHub Release

**Manual publish (maintainers only):**
```bash
# 1. Version bump
pnpm changeset version

# 2. Commit version changes
git add -A && git commit -m "chore: release"

# 3. Build
pnpm build

# 4. Publish (requires npm login)
npm publish --access public

# 5. Push to GitHub
git push origin main
```

### npm Trusted Publishers Setup

To enable automated publishing, configure on npm.js:

1. Go to https://www.npmjs.com/package/@anatolykoptev/krolik-cli/access
2. Scroll to "Trusted Publishers" section
3. Click "Link" → "GitHub Actions"
4. Configure:
   - **Repository:** `anatolykoptev/krolik-cli`
   - **Workflow:** `publish.yml`
   - **Environment:** (leave empty)
5. Save

This enables secure, token-less publishing via OIDC.

### Release Checklist

- [ ] All tests passing (`pnpm test:run`)
- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Changeset created with appropriate version bump
- [ ] CHANGELOG.md updated (automatic with changesets)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

### Our Standards

- **Be respectful** - Treat everyone with respect and kindness
- **Be constructive** - Provide helpful, actionable feedback
- **Be collaborative** - Work together towards shared goals
- **Be inclusive** - Welcome diverse perspectives and backgrounds

## License

This project is licensed under **FSL-1.1-Apache-2.0** (Functional Source License).

- **Free for:** Internal use, non-commercial education and research, professional services
- **Not permitted:** Creating competing commercial AI dev toolkits or MCP servers
- **Converts to Apache 2.0:** December 26, 2027

See [LICENSE](./LICENSE) for full terms. For commercial licensing inquiries, open an issue.

---

## Additional Resources

- [README.md](./README.md) - Project overview and usage
- [CLAUDE.md](./CLAUDE.md) - Development rules and architecture
- [GitHub Issues](https://github.com/anatolykoptev/krolik-cli/issues) - Bug reports and feature requests

## Questions?

If you have questions or need help, check existing [Issues](https://github.com/anatolykoptev/krolik-cli/issues) or open a new one.

Thank you for contributing to Krolik CLI!
