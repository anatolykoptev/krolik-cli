/**
 * Compression Strategy Interface
 * Абстрактный интерфейс для всех стратегий сжатия
 */

import type {
  OptimizationConfig,
  OptimizationResult,
  CompressionStatistics,
} from '../core/types';

export interface CompressionStrategy {
  /**
   * Название стратегии
   */
  name: string;

  /**
   * Основной метод сжатия
   */
  compress(
    xml: string,
    config: OptimizationConfig
  ): Promise<OptimizationResult>;

  /**
   * Анализ потенциаля сжатия
   */
  analyze(xml: string): CompressionStatistics;

  /**
   * Оценка ожидаемого результата
   */
  estimateGain(xml: string): number;

  /**
   * Получает оптимизации, отвечающие заданным критериям
   */
  getOptimizations(xml: string): string[];
}

/**
 * Базовый абстрактный класс
 */
export abstract class BaseCompressionStrategy implements CompressionStrategy {
  abstract name: string;

  abstract compress(
    xml: string,
    config: OptimizationConfig
  ): Promise<OptimizationResult>;

  abstract analyze(xml: string): CompressionStatistics;

  /**
   * Оценка ожидаемого особенностей сжатия
   */
  estimateGain(xml: string): number {
    const stats = this.analyze(xml);
    const baseSize = xml.length;
    const estimatedReduction =
      stats.whitespaceOptimized * 2 +
      stats.commentsRemoved * 5 +
      stats.attributesRemoved * 3;

    return (estimatedReduction / baseSize) * 100;
  }

  /**
   * Г
   */
  abstract getOptimizations(xml: string): string[];

  /**
   * Утилита для удаления комментариев
   */
  protected removeComments(xml: string): string {
    return xml.replace(/<!--[\s\S]*?-->/g, '');
  }

  /**
   * Утилита для очистки бесповоротных атрибутов
   */
  protected removeEmptyAttributes(xml: string): string {
    return xml.replace(/\s+\w+=""/g, '');
  }

  /**
   * Утилита для удаления осыпающихся пробелов и переносов
   */
  protected removeWhitespace(xml: string): string {
    return xml.replace(/>(\s+)</g, '><');
  }

  /**
   * Нормализирует атрибуты (единые кавы)
   */
  protected normalizeAttributes(xml: string): string {
    return xml.replace(/="([^"]*)"/g, "='$1'");
  }

  /**
   * Получит количество элементов
   */
  protected countElements(xml: string): number {
    const matches = xml.match(/<[^/>]+>/g);
    return matches ? matches.length : 0;
  }

  /**
   * Получит количество комментариев
   */
  protected countComments(xml: string): number {
    const matches = xml.match(/<!--[\s\S]*?-->/g);
    return matches ? matches.length : 0;
  }

  /**
   * Получит количество чистого текста
   */
  protected countWhitespace(xml: string): number {
    const matches = xml.match(/>(\s+)</g);
    return matches ? matches.reduce((sum, m) => sum + m.length, 0) : 0;
  }
}
