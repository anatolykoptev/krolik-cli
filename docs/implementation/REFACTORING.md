# MCP Tools Architecture Refactoring

## Summary

Refactored the MCP tools architecture to use a **self-registering pattern**, reducing the effort to add a new tool from modifying 3 places to just 1.

## Problem

Previously, adding a new MCP tool required modifying 3 places in `src/mcp/tools/index.ts`:

```typescript
// 1. Export the tool
export { myTool } from './my-tool';

// 2. Import the tool
import { myTool } from './my-tool';

// 3. Add to ALL_TOOLS array
export const ALL_TOOLS = [myTool, otherTool, ...];
```

This was error-prone and created unnecessary coupling.

## Solution

Implemented a **self-registering pattern** using a central registry:

### New Architecture

1. **`registry.ts`** - Central registry with `registerTool()` function
2. **Each tool file** - Calls `registerTool(myTool)` on import
3. **`index.ts`** - Just imports all tool files to trigger registration

### Example: Adding a New Tool

**Before (3 modifications):**
```typescript
// tools/index.ts
export { myTool } from './my-tool';        // ← modify
import { myTool } from './my-tool';        // ← modify
export const ALL_TOOLS = [myTool, ...];    // ← modify
```

**After (1 modification):**
```typescript
// tools/index.ts
import './my-tool';  // ← Only this!
```

## Files Changed

### Created

- `/src/mcp/tools/registry.ts` - Central tool registry
- `/src/mcp/tools/ARCHITECTURE.md` - Architecture documentation

### Modified

- `/src/mcp/tools/index.ts` - Simplified to just import statements
- `/src/mcp/tools/status.ts` - Added `registerTool(statusTool)`
- `/src/mcp/tools/context.ts` - Added `registerTool(contextTool)`
- `/src/mcp/tools/schema.ts` - Added `registerTool(schemaTool)`
- `/src/mcp/tools/routes.ts` - Added `registerTool(routesTool)`
- `/src/mcp/tools/review.ts` - Added `registerTool(reviewTool)`
- `/src/mcp/tools/issue.ts` - Added `registerTool(issueTool)`
- `/src/mcp/tools/audit.ts` - Added `registerTool(auditTool)`
- `/src/mcp/tools/fix.ts` - Added `registerTool(fixTool)`
- `/src/mcp/tools/refactor.ts` - Added `registerTool(refactorTool)`

## Benefits

1. **Less boilerplate** - Only 1 line to add instead of 3
2. **Type-safe** - Registry validates unique tool names
3. **Explicit** - Each tool explicitly registers itself
4. **Maintainable** - Clear separation of concerns
5. **Backward compatible** - `ALL_TOOLS` still exported

## Verification

All 9 tools are correctly registered and working:

```bash
pnpm run build
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/bin/cli.js mcp
```

Returns all 9 tools:
- krolik_status
- krolik_context
- krolik_schema
- krolik_routes
- krolik_review
- krolik_issue
- krolik_audit
- krolik_fix
- krolik_refactor

## Implementation Details

### Registry Pattern

```typescript
// registry.ts
const toolRegistry: MCPToolDefinition[] = [];

export function registerTool(tool: MCPToolDefinition): void {
  if (toolRegistry.some((t) => t.name === tool.name)) {
    throw new Error(`Tool "${tool.name}" is already registered`);
  }
  toolRegistry.push(tool);
}

export function getAllTools(): readonly MCPToolDefinition[] {
  return [...toolRegistry];
}
```

### Tool Registration

```typescript
// Any tool file (e.g., status.ts)
import { registerTool } from './registry';

export const statusTool: MCPToolDefinition = {
  name: 'krolik_status',
  // ... definition
};

registerTool(statusTool);  // Self-register on import
```

### Index File

```typescript
// index.ts
import './status';
import './context';
// ... all tool imports

export { getAllTools, getToolDefinitions, /* ... */ } from './registry';
export const ALL_TOOLS = getAllTools();  // Backward compatibility
```

## Next Steps

When adding a new tool in the future:

1. Create `tools/my-tool.ts` with `registerTool(myTool)` call
2. Add `import './my-tool';` to `tools/index.ts`
3. Done!

No need to modify arrays, exports, or anything else.
