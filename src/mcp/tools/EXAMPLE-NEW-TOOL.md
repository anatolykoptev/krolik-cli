# Example: Adding a New MCP Tool

This example shows how to add a new tool called `krolik_version` that returns version information.

## Step 1: Create the Tool File

Create `src/mcp/tools/version.ts`:

```typescript
/**
 * @module mcp/tools/version
 * @description krolik_version tool - Get version information
 */

import type { MCPToolDefinition } from './types';
import { registerTool } from './registry';
import { PROJECT_PROPERTY } from './shared';
import { withProjectDetection } from './projects';

export const versionTool: MCPToolDefinition = {
  name: 'krolik_version',
  description: 'Get version information for krolik and the project.',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      verbose: {
        type: 'boolean',
        description: 'Include detailed version information',
      },
    },
  },
  handler: (args, workspaceRoot) => {
    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      const krolikVersion = '1.0.0'; // Could read from package.json

      if (args.verbose) {
        return `Krolik CLI v${krolikVersion}\nProject: ${projectPath}\nNode: ${process.version}`;
      }

      return `Krolik CLI v${krolikVersion}`;
    });
  },
};

// Register the tool - this is called when the module is imported
registerTool(versionTool);
```

## Step 2: Add Import to Index

Add ONE line to `src/mcp/tools/index.ts`:

```typescript
// Import all tool files to trigger self-registration
import './status';
import './context';
import './schema';
import './routes';
import './review';
import './issue';
import './audit';
import './fix';
import './refactor';
import './version';  // ← Add this line!
```

## That's It!

Build and test:

```bash
pnpm run build

# Test the new tool
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"krolik_version","arguments":{}}}' | node dist/bin/cli.js mcp
```

## What Happens Under the Hood

1. When `index.ts` imports `'./version'`, the module is loaded
2. The `versionTool` definition is created
3. `registerTool(versionTool)` is called immediately
4. The tool is added to the internal registry
5. When MCP server calls `getAllTools()`, your tool is included

## No Need to Modify

- ✓ No need to add to `ALL_TOOLS` array (doesn't exist anymore)
- ✓ No need to add export statements
- ✓ No need to modify any other files
- ✓ Just create the tool and add one import line!

## Tool Template

Copy this template for new tools:

```typescript
import type { MCPToolDefinition } from './types';
import { registerTool } from './registry';
import { PROJECT_PROPERTY } from './shared';
import { withProjectDetection } from './projects';

export const myTool: MCPToolDefinition = {
  name: 'krolik_my_tool',
  description: 'What your tool does',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      // Add your parameters here
      myParam: {
        type: 'string',
        description: 'Parameter description',
      },
    },
  },
  handler: (args, workspaceRoot) => {
    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      // Your implementation here
      return 'Result as string';
    });
  },
};

registerTool(myTool);
```

## Benefits Demonstrated

| Before | After |
|--------|-------|
| Create file + 3 modifications | Create file + 1 import line |
| Easy to forget one modification | Import is obvious and required |
| Manual array management | Automatic registration |
| No validation | Name uniqueness validated |

The self-registering pattern makes it impossible to forget to register a tool, as long as you import it.
