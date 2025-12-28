/**
 * Minify Strategy
 * Легковесное сжатие: удаление комментариев и белых спаций
 * Уровень сжатия: 20-30%
 * Скорость: очень сыграютыра (за миллисекунды)
 */

import { BaseCompressionStrategy } from './CompressionStrategy';
import type {
  OptimizationConfig,
  OptimizationResult,
  CompressionStatistics,
} from '../core/types';

export class MinifyStrategy extends BaseCompressionStrategy {
  name = 'minify';

  async compress(
    xml: string,
    config: OptimizationConfig
  ): Promise<OptimizationResult> {
    const originalSize = xml.length;
    let optimized = xml;

    // Основные трансформации
    if (config.removeComments !== false) {
      optimized = this.removeComments(optimized);
    }

    if (config.removeEmptyAttributes !== false) {
      optimized = this.removeEmptyAttributes(optimized);
    }

    if (config.preserveWhitespace !== true) {
      optimized = this.removeWhitespace(optimized);
    }

    if (config.normalizeAttributes !== false) {
      // Не нормализирую атрибуты для minify - грубые трансформации
    }

    // Оптимизация пробелов внутри тэгов
    optimized = optimized.replace(/>\s+/g, '>').replace(/\s+</g, '<');

    // Осталоные сдвоенные пробелы
    optimized = optimized.replace(/\s+/g, ' ');

    const optimizedSize = optimized.length;
    const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100;

    return {
      original: xml,
      optimized,
      originalSize,
      optimizedSize,
      compressionRatio,
      strategy: 'minify',
      executionTime: 0, // Устанавливается в XMLOptimizer
    };
  }

  analyze(xml: string): CompressionStatistics {
    return {
      totalElements: this.countElements(xml),
      attributesRemoved: this.estimateAttributesToRemove(xml),
      whitespaceOptimized: this.countWhitespace(xml),
      commentsRemoved: this.countComments(xml),
      estimatedGain: this.estimateGain(xml),
    };
  }

  getOptimizations(xml: string): string[] {
    const optimizations: string[] = [];

    if (this.countComments(xml) > 0) {
      optimizations.push('Remove comments');
    }

    if (this.countWhitespace(xml) > 100) {
      optimizations.push('Minify whitespace');
    }

    if (this.estimateAttributesToRemove(xml) > 0) {
      optimizations.push('Remove empty attributes');
    }

    return optimizations;
  }

  /**
   * Оценит количество пустых атрибутов
   */
  private estimateAttributesToRemove(xml: string): number {
    const matches = xml.match(/\s+\w+=""/g);
    return matches ? matches.length : 0;
  }
}
