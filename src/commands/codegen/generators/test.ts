/**
 * @module commands/codegen/generators/test
 * @description Test file generator with docs enhancement and source analysis
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeSourceFile } from '../services/source-analyzer';
import type { DocHints } from '../services/types';
import {
  type ClassTestInfo,
  type FunctionTestInfo,
  functionBasedTestTemplate,
  testTemplate,
  toPascalCase,
} from '../templates';
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
 * Convert a param with optional type to test info format
 */
function convertParam(p: {
  name: string;
  type?: string;
  isOptional: boolean;
  hasDefault: boolean;
}): { name: string; type?: string; isOptional: boolean; hasDefault: boolean } {
  const result: { name: string; type?: string; isOptional: boolean; hasDefault: boolean } = {
    name: p.name,
    isOptional: p.isOptional,
    hasDefault: p.hasDefault,
  };
  if (p.type !== undefined) {
    result.type = p.type;
  }
  return result;
}

/**
 * Convert source analyzer exports to test template format
 */
function convertToTestInfo(analysisExports: ReturnType<typeof analyzeSourceFile>['exports']): {
  functions: FunctionTestInfo[];
  classes: ClassTestInfo[];
} {
  const functions: FunctionTestInfo[] = [];
  const classes: ClassTestInfo[] = [];

  for (const exp of analysisExports) {
    if (exp.kind === 'function') {
      const funcInfo: FunctionTestInfo = {
        name: exp.name,
        params: exp.params.map(convertParam),
        isAsync: exp.isAsync,
      };
      if (exp.returnType !== undefined) {
        funcInfo.returnType = exp.returnType;
      }
      functions.push(funcInfo);
    } else if (exp.kind === 'class') {
      classes.push({
        name: exp.name,
        methods: (exp.methods ?? []).map((m) => {
          const methodInfo: ClassTestInfo['methods'][0] = {
            name: m.name,
            params: m.params.map(convertParam),
            isAsync: m.isAsync,
            isStatic: m.isStatic,
          };
          if (m.returnType !== undefined) {
            methodInfo.returnType = m.returnType;
          }
          return methodInfo;
        }),
      });
    }
  }

  return { functions, classes };
}

/**
 * Test file generator
 */
class TestGeneratorClass extends BaseGenerator {
  readonly metadata: GeneratorMetadata = {
    id: 'test',
    name: 'Test File',
    description: 'Generate test file for a component or module with function-specific tests',
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

    // Try to analyze the source file for function-specific tests
    const fullPath = path.isAbsolute(file) ? file : path.join(projectRoot, file);
    const analysis = analyzeSourceFile(fullPath);

    // Use function-based tests if analysis succeeded and found exports
    if (analysis.success && analysis.exports.length > 0 && !isReact) {
      const { functions, classes } = convertToTestInfo(analysis.exports);

      // Only use function-based template if we have functions or classes
      if (functions.length > 0 || classes.length > 0) {
        const content = functionBasedTestTemplate(componentName, relativePath, functions, classes);

        return [
          {
            path: testPath,
            content,
            action: 'create',
            docsEnhanced: {
              library: 'vitest',
              topics: ['function-analysis', 'auto-generated'],
              snippetsCount: functions.length + classes.length,
            },
          },
        ];
      }
    }

    // Fallback to original template-based generation
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
