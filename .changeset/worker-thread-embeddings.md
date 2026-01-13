---
"@anatolykoptev/krolik-cli": minor
---

feat(memory): add worker thread architecture for non-blocking embeddings

### New Features

- **Worker Thread Pool**: Model loading now happens in isolated worker thread, preventing MCP server blocking
- **Preload at Startup**: `preloadEmbeddingPool()` fires model loading immediately when MCP server starts
- **Graceful Fallback**: BM25 search works instantly while model loads in background
- **Idle Timeout**: Worker releases after 5 minutes of inactivity (~23MB memory savings)
- **Hybrid Search**: Automatic mode selection between BM25-only and hybrid (BM25 + semantic)

### Performance Improvements

- MCP server responds instantly during model initialization
- First semantic search no longer blocks for 2-3 seconds
- Memory efficient: worker only active when needed

### Technical Details

- New `embedding-worker.ts` for isolated model loading
- New `embedding-pool.ts` for worker lifecycle management
- Updated `embeddings.ts` to use worker pool
- Separate tsup bundle for worker thread
- Added `sharp` and `protobufjs` to pnpm.onlyBuiltDependencies
