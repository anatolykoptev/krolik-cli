/**
 * @module commands/codegen/generators/test
 * @description Test file generator with docs enhancement
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DocHints } from '../services/types';
import { testTemplate, toPascalCase } from '../templates';
import { testEnhanced } from '../templates/enhanced';
import type { GeneratedFile, GeneratorMetadata, GeneratorOptions } from '../types';
import { BaseGenerator } from './base';

function getComponentName(filePath: string): string {
  const baseName = path.basename(filePath, path.extname(filePath));
  return toPascalCase(baseName);
}

function isReactFile(filePath: string, projectRoot: string): boolean {
  const ext = path.extname(filePath);
  if (ext === '.tsx') return true;
  if (ext !== '.ts' && ext !== '.js' && ext !== '.jsx') return false;

  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);

  try {
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      return (
        /import\s+.*\s+from\s+['"]react['"]/.test(content) || /['"]use client['"]/.test(content)
      );
    }
  } catch {
    // Ignore read errors
  }

  return false;
}

function getTestPath(filePath: string): string {
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);
  const testFileName = `${baseName}.test${ext === '.tsx' ? '.tsx' : '.ts'}`;
  return path.join(dir, testFileName);
}

/**
 * Test file generator
 */
class TestGeneratorClass extends BaseGenerator {
  readonly metadata: GeneratorMetadata = {
    id: 'test',
    name: 'Test File',
    description: 'Generate test file for a component or module',
    example: 'krolik codegen test --file apps/web/src/components/Button.tsx',
  };

  protected generateWithHints(options: GeneratorOptions, hints: DocHints): GeneratedFile[] {
    const { file, projectRoot, path: outputPath } = options;

    if (!file) {
      throw new Error('--file is required for test generator');
    }

    const componentName = getComponentName(file);
    const isReact = isReactFile(file, projectRoot);
    const testPath = outputPath ?? getTestPath(file);

    const testDir = path.dirname(testPath);
    const sourceFile = file.replace(/\.(tsx?|jsx?)$/, '');
    let relativePath = path.relative(testDir, sourceFile);

    if (!relativePath.startsWith('.')) {
      relativePath = `./${relativePath}`;
    }

    const content = hints.enhanced
      ? testEnhanced(componentName, relativePath, isReact, hints)
      : testTemplate(componentName, relativePath, isReact);

    return [
      {
        path: testPath,
        content,
        action: 'create',
        ...(hints.enhanced
          ? {
              docsEnhanced: {
                library: hints.sources[0] ?? 'vitest',
                topics: hints.patterns.map((p) => p.name),
                snippetsCount: hints.snippets.length,
              },
            }
          : {}),
      },
    ];
  }
}

export const testGenerator = new TestGeneratorClass();
