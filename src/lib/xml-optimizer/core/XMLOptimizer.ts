/**
 * XML Optimizer - Core Engine
 * Переиспользуемый модуль для динамической оптимизации XML с поддержкой расширяемых стратегий
 */

import type { OptimizationConfig, OptimizationResult, XMLElement } from './types';
import type { CompressionStrategy } from './strategies/CompressionStrategy';

export class XMLOptimizer {
  private strategies: Map<string, CompressionStrategy> = new Map();
  private cache: Map<string, OptimizationResult> = new Map();
  private enableCache: boolean = true;
  private maxCacheSize: number = 100;

  constructor(enableCache: boolean = true) {
    this.enableCache = enableCache;
  }

  /**
   * Регистрирует новую стратегию сжатия
   */
  registerStrategy(name: string, strategy: CompressionStrategy): void {
    this.strategies.set(name, strategy);
  }

  /**
   * Получает зарегистрированную стратегию
   */
  getStrategy(name: string): CompressionStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Получает все доступные стратегии
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Оптимизирует XML вывод согласно выбранной стратегии
   */
  async optimize(
    xml: string,
    config: OptimizationConfig
  ): Promise<OptimizationResult> {
    const cacheKey = this.generateCacheKey(xml, config);

    // Проверяю кеш
    if (this.enableCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const strategy = this.strategies.get(config.strategy);
    if (!strategy) {
      throw new Error(
        `Strategy "${config.strategy}" not found. Available: ${this.getAvailableStrategies().join(', ')}`
      );
    }

    const startTime = performance.now();
    const result = await strategy.compress(xml, config);
    result.executionTime = performance.now() - startTime;

    // Кеширую результат
    if (this.enableCache) {
      if (this.cache.size >= this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Массовая оптимизация нескольких стратегий
   */
  async optimizeMultiple(
    xml: string,
    strategies: OptimizationConfig[]
  ): Promise<OptimizationResult[]> {
    return Promise.all(
      strategies.map((config) => this.optimize(xml, config))
    );
  }

  /**
   * Получает наилучшую рекомендацию стратегии
   */
  async getBestStrategy(xml: string): Promise<OptimizationResult> {
    const results = await this.optimizeMultiple(
      xml,
      Array.from(this.strategies.keys()).map((strategy) => ({
        strategy: strategy as 'minify' | 'compress' | 'brotli',
        removeComments: true,
        removeEmptyAttributes: true,
        normalizeAttributes: true,
      }))
    );

    return results.reduce((best, current) =>
      current.compressionRatio > best.compressionRatio ? current : best
    );
  }

  /**
   * Очищает кеш
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Получает статистику кеша
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
    };
  }

  /**
   * Построит арборесценцию элементов XML
   */
  parseXML(xml: string): XMLElement | null {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      if (doc.getElementsByTagName('parsererror').length > 0) {
        console.error('XML parsing error');
        return null;
      }

      return this.domToElement(doc.documentElement);
    } catch (error) {
      console.error('Failed to parse XML:', error);
      return null;
    }
  }

  /**
   * Преобразует DOM-элемент в наш формат
   */
  private domToElement(node: Element): XMLElement {
    const element: XMLElement = {
      name: node.tagName.toLowerCase(),
      attributes: {},
      children: [],
      metadata: {
        depth: 0,
        isComplex: false,
        estimatedSize: 0,
      },
    };

    // Накопирую атрибуты
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i];
      element.attributes![attr.name] = attr.value;
    }

    // Накопирую дочерние элементы
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (child.nodeType === Node.ELEMENT_NODE) {
        element.children!.push(this.domToElement(child as Element));
      } else if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim();
        if (text) {
          element.text = text;
        }
      }
    }

    return element;
  }

  /**
   * Генерирует ключ кеша
   */
  private generateCacheKey(
    xml: string,
    config: OptimizationConfig
  ): string {
    const hash = this.simpleHash(
      xml + JSON.stringify(config)
    );
    return `${config.strategy}:${hash}`;
  }

  /**
   * Простой хеш-функция
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
