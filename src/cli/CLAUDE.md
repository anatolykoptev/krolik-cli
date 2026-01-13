# CLI Module

## Adding New Commands

### 1. Simple Command (no subcommands)

```typescript
// src/cli/commands/mycommand.ts
import type { Command } from 'commander';
import { addProjectOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext, handleProjectOption } from './helpers';

export function registerMyCommand(program: Command): void {
  const cmd = program.command('mycommand').description('What it does');

  addProjectOption(cmd);  // Always add --project
  cmd.option('--my-flag', 'Description');

  cmd.action(async (options: CommandOptions) => {
    const { runMyCommand } = await import('../../commands/mycommand');
    handleProjectOption(options);
    const ctx = await createContext(program, options);
    await runMyCommand(ctx);
  });
}
```

### 2. Register in program.ts

```typescript
import { registerMyCommand } from './commands/mycommand';
// ...
registerMyCommand(program);
```

### 3. Create Runner

```typescript
// src/commands/mycommand/index.ts
import type { CommandContext } from '../../cli/types';

export async function runMyCommand(ctx: CommandContext): Promise<void> {
  const { config, logger, options } = ctx;
  // Implementation
}
```

---

## Builders (reusable options)

| Builder                       | Adds                         | Use When               |
| ----------------------------- | ---------------------------- | ---------------------- |
| `addProjectOption(cmd)`       | `-p, --project`              | **Always**             |
| `addPathOption(cmd)`          | `--path`                     | Targeting subdirectory |
| `addCommonOptions(cmd)`       | `--project + --path`         | Both needed            |
| `addOutputLevelOptions(cmd)`  | `-c, --compact / -f, --full` | Variable output        |
| `addDryRunOption(cmd)`        | `--dry-run`                  | Destructive actions    |
| `addForceOption(cmd)`         | `--force`                    | Skip confirmations     |
| `addModeSwitch(cmd, modes)`   | `--quick / --deep`           | Analysis modes         |

---

## Parsers (option processing)

```typescript
import { parseMode, parseOutputLevel, resolveOutputFormat } from '../parsers';

// In action handler:
const mode = parseMode(options, ['quick', 'deep'], 'default');
const outputLevel = parseOutputLevel(options);
const format = resolveOutputFormat(program.opts(), options);
```

---

## Types

| Type             | Use                                             |
| ---------------- | ----------------------------------------------- |
| `CommandOptions` | Generic options object                          |
| `CommandContext` | Passed to runner (config, logger, options)      |
| `OutputFormat`   | `'json' \| 'text' \| 'ai'`                      |
| `OutputLevel`    | `'summary' \| 'compact' \| 'default' \| 'full'` |

---

## Checklist

- [ ] Command file in `src/cli/commands/`
- [ ] Runner in `src/commands/<name>/index.ts`
- [ ] Register in `program.ts`
- [ ] Add `--project` via `addProjectOption()`
- [ ] Call `handleProjectOption(options)` before `createContext`
- [ ] Dynamic import runner to avoid circular deps
- [ ] Add MCP tool if needed (`src/mcp/tools/`)
