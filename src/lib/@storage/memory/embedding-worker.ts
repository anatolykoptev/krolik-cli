/**
 * @module lib/@storage/memory/embedding-worker
 * @description Worker thread for isolated embedding model loading
 *
 * Isolates @xenova/transformers from main thread to prevent blocking MCP server.
 * Model loading and inference happen in this worker, keeping main thread responsive.
 */

import { parentPort, workerData } from 'node:worker_threads';

// ============================================================================
// TYPES
// ============================================================================

interface WorkerMessage {
  id: number;
  type: 'init' | 'embed' | 'embed-batch' | 'status' | 'release';
  payload?: unknown;
}

interface InitPayload {
  modelId: string;
  cacheDir: string;
}

interface EmbedPayload {
  text: string;
}

interface EmbedBatchPayload {
  texts: string[];
}

interface WorkerResponse {
  id: number;
  success: boolean;
  embedding?: number[];
  embeddings?: number[][];
  status?: {
    ready: boolean;
    loading: boolean;
    error: string | null;
  };
  error?: string;
  durationMs?: number;
}

/** Embedder pipeline from @xenova/transformers */
interface Embedder {
  (
    text: string,
    options: { pooling: 'none' | 'mean' | 'cls'; normalize: boolean },
  ): Promise<{ data: Float32Array }>;
  dispose?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_TEXT_LENGTH = 512;
const INIT_TIMEOUT_MS = 60000; // 60 seconds for model download

// ============================================================================
// STATE
// ============================================================================

let embedder: Embedder | null = null;
let initPromise: Promise<void> | null = null;
let initError: Error | null = null;
let isInitializing = false;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize embedding model with timeout
 */
async function initializeModel(payload: InitPayload): Promise<void> {
  if (embedder) return;
  if (initError) throw initError;

  if (initPromise) {
    await initPromise;
    return;
  }

  // Prevent race condition
  if (isInitializing) {
    await new Promise<void>((resolve) => {
      const check = () => {
        if (embedder || initError) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
    if (initError) throw initError;
    return;
  }

  isInitializing = true;

  initPromise = (async () => {
    try {
      // Dynamic import
      const { pipeline } = await import('@xenova/transformers');

      // Load with timeout
      const loadPromise = pipeline('feature-extraction', payload.modelId, {
        cache_dir: payload.cacheDir,
        quantized: true,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Model load timeout')), INIT_TIMEOUT_MS);
      });

      embedder = await Promise.race([loadPromise, timeoutPromise]);
    } catch (error) {
      initError = error instanceof Error ? error : new Error(String(error));
      throw initError;
    } finally {
      isInitializing = false;
    }
  })();

  await initPromise;
}

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

/**
 * Generate embedding for single text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!embedder) throw new Error('Model not initialized');

  const truncated = text.slice(0, MAX_TEXT_LENGTH);
  const output = await embedder(truncated, {
    pooling: 'mean',
    normalize: true,
  });

  // Convert to regular array for transfer
  return Array.from(output.data as Float32Array);
}

/**
 * Generate embeddings for multiple texts
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!embedder) throw new Error('Model not initialized');

  const results: number[][] = [];

  for (const text of texts) {
    const truncated = text.slice(0, MAX_TEXT_LENGTH);
    const output = await embedder(truncated, {
      pooling: 'mean',
      normalize: true,
    });
    results.push(Array.from(output.data as Float32Array));
  }

  return results;
}

/**
 * Release model resources
 */
function releaseModel(): void {
  if (embedder && typeof embedder.dispose === 'function') {
    embedder.dispose();
  }
  embedder = null;
  initPromise = null;
  // Keep initError - if there was an error, it stays
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

parentPort?.on('message', async (message: WorkerMessage) => {
  const { id, type, payload } = message;
  const startTime = Date.now();

  try {
    switch (type) {
      case 'init': {
        await initializeModel(payload as InitPayload);
        const response: WorkerResponse = {
          id,
          success: true,
          durationMs: Date.now() - startTime,
        };
        parentPort?.postMessage(response);
        break;
      }

      case 'embed': {
        const { text } = payload as EmbedPayload;
        const embedding = await generateEmbedding(text);
        const response: WorkerResponse = {
          id,
          success: true,
          embedding,
          durationMs: Date.now() - startTime,
        };
        parentPort?.postMessage(response);
        break;
      }

      case 'embed-batch': {
        const { texts } = payload as EmbedBatchPayload;
        const embeddings = await generateEmbeddings(texts);
        const response: WorkerResponse = {
          id,
          success: true,
          embeddings,
          durationMs: Date.now() - startTime,
        };
        parentPort?.postMessage(response);
        break;
      }

      case 'status': {
        const response: WorkerResponse = {
          id,
          success: true,
          status: {
            ready: embedder !== null,
            loading: isInitializing,
            error: initError?.message ?? null,
          },
        };
        parentPort?.postMessage(response);
        break;
      }

      case 'release': {
        releaseModel();
        const response: WorkerResponse = {
          id,
          success: true,
        };
        parentPort?.postMessage(response);
        break;
      }

      default: {
        const response: WorkerResponse = {
          id,
          success: false,
          error: `Unknown message type: ${type}`,
        };
        parentPort?.postMessage(response);
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const response: WorkerResponse = {
      id,
      success: false,
      error: err.message,
    };
    parentPort?.postMessage(response);
  }
});

// ============================================================================
// AUTO-INIT ON STARTUP
// ============================================================================

if (workerData?.autoInit && workerData?.modelId && workerData?.cacheDir) {
  initializeModel({
    modelId: workerData.modelId,
    cacheDir: workerData.cacheDir,
  }).catch(() => {
    // Error will be returned on first request
  });
}
