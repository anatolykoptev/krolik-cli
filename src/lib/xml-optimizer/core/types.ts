/**
 * XML Optimizer - Type Definitions
 * Универсальные типы для работы с XML-оптимизацией
 */

export type OptimizationStrategy = 'minify' | 'compress' | 'brotli';

export interface OptimizationConfig {
  strategy: OptimizationStrategy;
  preserveWhitespace?: boolean;
  removeComments?: boolean;
  removeEmptyAttributes?: boolean;
  normalizeAttributes?: boolean;
  customRules?: Record<string, unknown>;
}

export interface OptimizationResult {
  original: string;
  optimized: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  strategy: OptimizationStrategy;
  executionTime: number;
}

export interface XMLElement {
  name: string;
  attributes?: Record<string, string>;
  text?: string;
  children?: XMLElement[];
  metadata?: {
    depth?: number;
    isComplex?: boolean;
    estimatedSize?: number;
  };
}

export interface CompressionStatistics {
  totalElements: number;
  attributesRemoved: number;
  whitespaceOptimized: number;
  commentsRemoved: number;
  estimatedGain: number;
}

export interface OptimizationStrategy {
  name: OptimizationStrategy;
  compress(xml: string, config: OptimizationConfig): Promise<OptimizationResult>;
  analyze(xml: string): CompressionStatistics;
  estimateGain(xml: string): number;
}
