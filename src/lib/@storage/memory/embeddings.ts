/**
 * @module lib/@storage/memory/embeddings
 * @description Local embedding generation using worker threads
 *
 * Architecture:
 * - Model loading happens in worker thread (non-blocking)
 * - Main thread can process other MCP requests during loading
 * - First embedding request waits for worker initialization
 * - Idle timeout releases resources after 5 minutes of inactivity
 *
 * Uses all-MiniLM-L6-v2 model for:
 * - Small size (~23MB)
 * - Fast inference (~50ms per text)
 * - Good quality for short texts
 * - MIT licensed, works offline
 */

import {
  getEmbeddingPool,
  getEmbeddingsStatus,
  isEmbeddingsLoading as poolIsLoading,
  isEmbeddingsReady as poolIsReady,
  preloadEmbeddingPool,
} from './embedding-pool';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Embedding result with metadata
 */
export interface EmbeddingResult {
  /** The embedding vector (384 dimensions for MiniLM) */
  embedding: Float32Array;
  /** Text that was embedded */
  text: string;
  /** Time taken in milliseconds */
  durationMs: number;
}

/**
 * Batch embedding result
 */
export interface BatchEmbeddingResult {
  /** Array of embeddings in same order as input texts */
  embeddings: Float32Array[];
  /** Total time taken in milliseconds */
  durationMs: number;
  /** Number of texts processed */
  count: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Embedding dimension for all-MiniLM-L6-v2 */
export const EMBEDDING_DIMENSION = 384;

/** Maximum text length (truncate longer texts) */
const MAX_TEXT_LENGTH = 512;

// ============================================================================
// STATUS FUNCTIONS
// ============================================================================

/**
 * Check if embeddings are available (model loaded and ready)
 */
export function isEmbeddingsAvailable(): boolean {
  return poolIsReady();
}

/**
 * Check if embeddings are currently loading
 */
export function isEmbeddingsLoading(): boolean {
  return poolIsLoading();
}

/**
 * Get the initialization error (if any)
 */
export function getEmbeddingsError(): Error | null {
  const status = getEmbeddingsStatus();
  return status.error ? new Error(status.error) : null;
}

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

/**
 * Generate embedding for a single text
 *
 * @param text - Text to embed (will be truncated if too long)
 * @returns Embedding result with vector and metadata
 *
 * @example
 * ```typescript
 * const result = await generateEmbedding('How to implement authentication');
 * console.log(result.embedding.length); // 384
 * console.log(result.durationMs); // ~50ms
 * ```
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const startTime = Date.now();
  const pool = getEmbeddingPool();

  // Truncate text if too long
  const truncatedText = text.slice(0, MAX_TEXT_LENGTH);

  const embedding = await pool.generateEmbedding(truncatedText);

  return {
    embedding,
    text: truncatedText,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Generate embeddings for multiple texts
 *
 * @param texts - Array of texts to embed
 * @returns Batch result with embeddings in same order
 *
 * @example
 * ```typescript
 * const result = await generateEmbeddings([
 *   'Authentication with JWT',
 *   'Database schema design',
 *   'API rate limiting',
 * ]);
 * console.log(result.count); // 3
 * console.log(result.embeddings[0].length); // 384
 * ```
 */
export async function generateEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
  const startTime = Date.now();
  const pool = getEmbeddingPool();

  // Truncate all texts
  const truncatedTexts = texts.map((t) => t.slice(0, MAX_TEXT_LENGTH));

  const embeddings = await pool.generateEmbeddings(truncatedTexts);

  return {
    embeddings,
    durationMs: Date.now() - startTime,
    count: texts.length,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Preload the embedding model (optional, for faster first query)
 *
 * Call this during app initialization to download the model
 * in the background, avoiding latency on first use.
 *
 * This is NON-BLOCKING - returns immediately while model loads in worker.
 */
export async function preloadEmbedder(): Promise<void> {
  preloadEmbeddingPool();
}

// Re-export pool functions for direct access
export { preloadEmbeddingPool, getEmbeddingsStatus };
