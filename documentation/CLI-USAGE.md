# Krolik CLI Usage Guide

## Local Usage (Within the `krolik-cli` project)

After building the project with `pnpm build`, you can now use the CLI in three ways:

### 1. Using the `pnpm krolik` script (Recommended)
```bash
pnpm krolik status --fast 2>&1 | head -20
pnpm krolik context --feature auth
pnpm krolik audit
```

### 2. Direct node execution
```bash
node dist/bin/cli.js status --fast
```

### 3. Development mode (with auto-reload)
```bash
pnpm dev status --fast
```

## Global Installation

To use `krolik` as a global command from anywhere on your system:

```bash
# Install globally
cd krolik-cli
pnpm install -g .

# Now you can use it anywhere
krolik status --fast
krolik context --feature auth
krolik --help
```

## Publishing to npm

Once published to npm, users can install it globally:

```bash
# Install from npm
pnpm install -g @anatolykoptev/krolik-cli

# Use anywhere
krolik status --fast
krolik audit
```

## Project-Specific Usage

You can also install krolik in other projects as a dev dependency:

```bash
# In your project
pnpm add -D @anatolykoptev/krolik-cli

# Use with pnpm
pnpm krolik status --fast

# Or use with npx
npx krolik status --fast
```

## Build Requirements

⚠️ **Important**: You must build the project first before using the CLI:

```bash
pnpm build
```

This generates the `dist/bin/cli.js` file with the shebang (`#!/usr/bin/env node`) that makes it executable.
