/**
 * @module commands/codegen/generators/base
 * @description Base class for docs-aware code generators
 */

import { docsEnhancer, type IDocsEnhancer } from '../services/docs-enhancer';
import { type DocHints, emptyHints } from '../services/types';
import type { GeneratedFile, Generator, GeneratorMetadata, GeneratorOptions } from '../types';

/**
 * Base class for generators that support docs enhancement
 */
export abstract class BaseGenerator implements Generator {
  abstract readonly metadata: GeneratorMetadata;

  protected readonly enhancer: IDocsEnhancer;

  constructor(enhancer?: IDocsEnhancer) {
    this.enhancer = enhancer ?? docsEnhancer;
  }

  /**
   * Generate files with docs enhancement by default
   */
  generate(options: GeneratorOptions): GeneratedFile[] {
    // Docs enhancement is the default behavior
    // Use --no-docs to disable
    const hints = options.noDocs
      ? emptyHints()
      : this.enhancer.getHints(this.metadata.id, { name: options.name });

    return this.generateWithHints(options, hints);
  }

  /**
   * Subclasses implement this to generate files with optional hints
   */
  protected abstract generateWithHints(options: GeneratorOptions, hints: DocHints): GeneratedFile[];
}
