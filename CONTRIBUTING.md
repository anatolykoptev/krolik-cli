# Contributing to Krolik

## Development Setup

```bash
# Clone the repository
git clone https://github.com/anatolykoptev/krolik-cli.git
cd krolik-cli

# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## Project Structure

```
src/
├── bin/           # CLI entry point
├── commands/      # CLI commands (context, fix, refactor, etc.)
├── lib/           # Shared utilities organized in @-modules
├── mcp/           # MCP server for Claude Code integration
└── types/         # TypeScript type definitions
```

## Pre-commit Checks

All commits run:
1. `pnpm typecheck` — TypeScript type checking
2. `pnpm test` — All tests must pass
3. `biome check` — Linting and formatting

## Release Process

### ⚠️ Important: Trusted Publisher Only

**Releases are published ONLY via GitHub Actions using npm Trusted Publisher.**

Manual `npm publish` is **not allowed** and will fail without OTP.

### How to Release

1. **Update version in package.json**:
   ```bash
   npm version patch  # or minor, major
   ```

2. **Commit and push**:
   ```bash
   git push
   ```

3. **Create GitHub Release**:
   ```bash
   gh release create v0.x.x --generate-notes
   ```

4. **GitHub Actions automatically**:
   - Builds the package
   - Publishes to npm with provenance
   - Signs with Sigstore

### Why Trusted Publisher?

- **No secrets to leak** — Uses OIDC tokens instead of long-lived npm tokens
- **Provenance** — Every package is cryptographically signed
- **Audit trail** — Links npm package to exact GitHub commit
- **2FA not required** — GitHub Actions handles authentication

### Workflow Configuration

The publish workflow (`.github/workflows/publish.yml`) triggers on:
- GitHub Release published
- Manual dispatch

```yaml
permissions:
  contents: read
  id-token: write  # Required for OIDC
```

## Code Style

- Use `biome` for formatting and linting
- Follow existing patterns in the codebase
- Add JSDoc comments for public APIs
- Keep functions small and focused

## Testing

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test -- fix       # Run tests matching "fix"
```

## Questions?

Open an issue on GitHub.
