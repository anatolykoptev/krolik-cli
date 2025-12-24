# MCP Tools Architecture

## Self-Registering Pattern

This directory uses a **self-registering pattern** to minimize boilerplate when adding new tools.

### Adding a New Tool

Adding a new MCP tool requires only **2 steps**:

#### 1. Create the tool file

Create `src/mcp/tools/my-tool.ts`:

```typescript
import type { MCPToolDefinition } from './types';
import { registerTool } from './registry';

export const myTool: MCPToolDefinition = {
  name: 'krolik_my_tool',
  description: 'What this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      myArg: {
        type: 'string',
        description: 'What this argument does',
      },
    },
  },
  handler: (args, projectRoot) => {
    // Your tool logic here
    return 'Result as string';
  },
};

// Register the tool (called on import)
registerTool(myTool);
```

#### 2. Add one import line

Add to `src/mcp/tools/index.ts`:

```typescript
import './my-tool';
```

That's it! No other files need modification.

## Architecture Benefits

### Before (3 places to modify)

```typescript
// tools/index.ts
export { myTool } from './my-tool';        // 1. Export line
import { myTool } from './my-tool';        // 2. Import line
export const ALL_TOOLS = [myTool, ...];    // 3. Array entry
```

### After (1 place to modify)

```typescript
// tools/index.ts
import './my-tool';  // Only this!
```

The tool self-registers when imported.

## How It Works

### Registry Pattern

The `registry.ts` module maintains a central list of all tools:

```typescript
// Internal registry
const toolRegistry: MCPToolDefinition[] = [];

// Called by each tool file on import
export function registerTool(tool: MCPToolDefinition): void {
  toolRegistry.push(tool);
}

// Used by MCP server
export function getAllTools(): readonly MCPToolDefinition[] {
  return [...toolRegistry];
}
```

### Tool Registration Flow

1. `index.ts` imports all tool files (`import './status'`)
2. Each tool file defines its `MCPToolDefinition`
3. Each tool file calls `registerTool(myTool)` at module level
4. Registry collects all tools into `toolRegistry` array
5. MCP server calls `getAllTools()` to get registered tools

### Key Files

| File | Purpose |
|------|---------|
| `registry.ts` | Central registry with `registerTool()` function |
| `types.ts` | TypeScript types for tools |
| `index.ts` | Imports all tools to trigger registration |
| `status.ts`, `context.ts`, etc. | Individual tool definitions |

### Backward Compatibility

The `ALL_TOOLS` constant is still exported for backward compatibility:

```typescript
// tools/index.ts
export const ALL_TOOLS = getAllTools();
```

This ensures existing code using `ALL_TOOLS` continues to work.

## Validation

The registry validates that tool names are unique:

```typescript
export function registerTool(tool: MCPToolDefinition): void {
  if (toolRegistry.some((t) => t.name === tool.name)) {
    throw new Error(`Tool "${tool.name}" is already registered`);
  }
  toolRegistry.push(tool);
}
```

Attempting to register a duplicate tool name will fail at startup.

## Testing

Test the MCP server with all registered tools:

```bash
# Build
pnpm run build

# Test MCP server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/bin/cli.js mcp
```

This will return all registered tools in the MCP protocol format.
