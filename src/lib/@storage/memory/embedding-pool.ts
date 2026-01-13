/**
 * @module lib/@storage/memory/embedding-pool
 * @description Worker Thread Pool for non-blocking embedding operations
 *
 * Architecture:
 * - Model loading happens in worker thread (non-blocking)
 * - Main thread can process other MCP requests during loading
 * - First embedding request waits for worker initialization
 * - Idle timeout releases resources after inactivity
 */

import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

// ============================================================================
// TYPES
// ============================================================================

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

interface PendingRequest {
  resolve: (value: WorkerResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface EmbeddingPoolStatus {
  ready: boolean;
  loading: boolean;
  error: string | null;
  workerActive: boolean;
  lastUsedAt: number | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds per request
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes idle before release

// ============================================================================
// EMBEDDING WORKER POOL
// ============================================================================

export class EmbeddingWorkerPool {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private initPromise: Promise<void> | null = null;
  private ready = false;
  private loading = false;
  private lastError: string | null = null;
  private lastUsedAt: number | null = null;
  private idleTimer: NodeJS.Timeout | null = null;

  private readonly modelId = MODEL_ID;
  private readonly cacheDir: string;
  private readonly workerPath: string;

  constructor() {
    this.cacheDir = path.join(os.homedir(), '.krolik', 'models');

    // Worker path resolution:
    // In production (bundled): import.meta.url is file:///path/to/dist/bin/cli.js
    // In development (tsx): import.meta.url is file:///path/to/src/lib/@storage/memory/embedding-pool.ts
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = path.dirname(currentFile);

    // Find project root by looking for dist/ or src/ in the absolute path
    const distIndex = currentDir.indexOf('/dist/');
    const srcIndex = currentDir.indexOf('/src/');

    let projectRoot: string;

    if (distIndex !== -1) {
      // Production: running from dist/
      projectRoot = currentDir.slice(0, distIndex);
    } else if (srcIndex !== -1) {
      // Development: running via tsx from src/
      projectRoot = currentDir.slice(0, srcIndex);
    } else {
      // Fallback: use parent of current directory (4 levels up from embedding-pool.ts)
      projectRoot = path.resolve(currentDir, '..', '..', '..', '..');
    }

    // Worker is always in dist/lib/@storage/memory/
    this.workerPath = path.join(
      projectRoot,
      'dist',
      'lib',
      '@storage',
      'memory',
      'embedding-worker.js',
    );
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Initialize worker and load model (blocking)
   * Use this when you need embeddings immediately
   */
  async initialize(): Promise<void> {
    if (this.ready) return;

    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.startWorker();
    await this.initPromise;
  }

  /**
   * Start worker initialization in background (non-blocking)
   * Use this at MCP server start for preloading
   */
  initializeAsync(): void {
    if (this.ready || this.initPromise || this.loading) return;

    this.loading = true;
    this.initPromise = this.startWorker();

    // Don't await - let model load in background
    this.initPromise
      .then(() => {
        this.loading = false;
      })
      .catch((error) => {
        this.loading = false;
        this.lastError = error instanceof Error ? error.message : String(error);
      });
  }

  /**
   * Start worker thread and initialize model
   */
  private async startWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker(this.workerPath, {
          workerData: {
            autoInit: true,
            modelId: this.modelId,
            cacheDir: this.cacheDir,
          },
        });

        this.worker.on('message', (response: WorkerResponse) => {
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(response.id);

            if (response.success) {
              pending.resolve(response);
            } else {
              pending.reject(new Error(response.error ?? 'Unknown worker error'));
            }
          }
        });

        this.worker.on('error', (error) => {
          this.lastError = error.message;
          reject(error);

          // Reject all pending requests
          for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(error);
            this.pendingRequests.delete(id);
          }
        });

        this.worker.on('exit', (code) => {
          if (code !== 0) {
            const error = new Error(`Worker exited with code ${code}`);
            for (const [id, pending] of this.pendingRequests) {
              clearTimeout(pending.timeout);
              pending.reject(error);
              this.pendingRequests.delete(id);
            }
          }
          this.worker = null;
          this.ready = false;
          this.initPromise = null;
        });

        // Wait for model initialization
        this.sendMessage('init', { modelId: this.modelId, cacheDir: this.cacheDir })
          .then(() => {
            this.ready = true;
            this.lastError = null;
            this.scheduleIdleRelease();
            resolve();
          })
          .catch((error) => {
            this.lastError = error.message;
            reject(error);
          });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.lastError = err.message;
        reject(err);
      }
    });
  }

  /**
   * Send message to worker with timeout
   */
  private sendMessage(type: string, payload?: unknown): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not started'));
        return;
      }

      const id = ++this.messageId;

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Worker request timeout (${type})`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.worker.postMessage({ id, type, payload });
    });
  }

  /**
   * Schedule worker release after idle timeout
   */
  private scheduleIdleRelease(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      const now = Date.now();
      if (this.lastUsedAt && now - this.lastUsedAt >= IDLE_TIMEOUT_MS) {
        this.release().catch(() => {
          // Ignore release errors
        });
      }
    }, IDLE_TIMEOUT_MS);
  }

  /**
   * Release worker resources
   */
  async release(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (this.worker) {
      try {
        await this.sendMessage('release');
      } catch {
        // Ignore errors during release
      }

      await this.worker.terminate();
      this.worker = null;
    }

    this.ready = false;
    this.initPromise = null;
    this.loading = false;
  }

  // ==========================================================================
  // STATUS
  // ==========================================================================

  /**
   * Check if model is ready for immediate use
   */
  isReady(): boolean {
    return this.ready && this.worker !== null;
  }

  /**
   * Check if model is currently loading
   */
  isLoading(): boolean {
    return this.loading || (this.initPromise !== null && !this.ready);
  }

  /**
   * Get detailed status
   */
  getStatus(): EmbeddingPoolStatus {
    return {
      ready: this.ready,
      loading: this.isLoading(),
      error: this.lastError,
      workerActive: this.worker !== null,
      lastUsedAt: this.lastUsedAt,
    };
  }

  // ==========================================================================
  // EMBEDDING GENERATION
  // ==========================================================================

  /**
   * Generate embedding for single text (non-blocking)
   * Auto-initializes worker if not started
   */
  async generateEmbedding(text: string): Promise<Float32Array> {
    if (!this.ready) {
      await this.initialize();
    }

    this.lastUsedAt = Date.now();
    this.scheduleIdleRelease();

    const response = await this.sendMessage('embed', { text });

    if (!response.embedding) {
      throw new Error('No embedding in response');
    }

    return new Float32Array(response.embedding);
  }

  /**
   * Generate embeddings for multiple texts (non-blocking)
   */
  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    if (!this.ready) {
      await this.initialize();
    }

    this.lastUsedAt = Date.now();
    this.scheduleIdleRelease();

    const response = await this.sendMessage('embed-batch', { texts });

    if (!response.embeddings) {
      throw new Error('No embeddings in response');
    }

    return response.embeddings.map((arr) => new Float32Array(arr));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let poolInstance: EmbeddingWorkerPool | null = null;

/**
 * Get singleton pool instance
 */
export function getEmbeddingPool(): EmbeddingWorkerPool {
  if (!poolInstance) {
    poolInstance = new EmbeddingWorkerPool();
  }
  return poolInstance;
}

/**
 * Preload embedding pool in background (call at MCP server start)
 * Non-blocking - returns immediately while model loads in worker
 */
export function preloadEmbeddingPool(): void {
  getEmbeddingPool().initializeAsync();
}

/**
 * Check if embeddings are ready for immediate use
 */
export function isEmbeddingsReady(): boolean {
  return poolInstance?.isReady() ?? false;
}

/**
 * Check if embeddings are currently loading
 */
export function isEmbeddingsLoading(): boolean {
  return poolInstance?.isLoading() ?? false;
}

/**
 * Get embedding pool status
 */
export function getEmbeddingsStatus(): EmbeddingPoolStatus {
  if (!poolInstance) {
    return {
      ready: false,
      loading: false,
      error: null,
      workerActive: false,
      lastUsedAt: null,
    };
  }
  return poolInstance.getStatus();
}
