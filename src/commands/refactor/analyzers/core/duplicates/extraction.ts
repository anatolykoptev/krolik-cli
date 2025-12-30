/**
 * @module commands/refactor/analyzers/core/duplicates/extraction
 * @description AST-based function extraction using ts-morph
 */

import { type SourceFile, SyntaxKind } from '../../../../../lib/@ast';
import type { FunctionSignature } from '../../../core/types';
import { hashBody, normalizeBody } from './normalization';

/**
 * Extract function signatures from a TypeScript file using ts-morph
 */
export function extractFunctions(sourceFile: SourceFile, filePath: string): FunctionSignature[] {
  const functions: FunctionSignature[] = [];

  // Get all function declarations
  for (const func of sourceFile.getFunctions()) {
    const name = func.getName();
    if (!name) continue;

    const bodyText = func.getBody()?.getText() ?? '';
    const normalizedBodyText = normalizeBody(bodyText);
    const tokens = new Set(normalizedBodyText.split(/\s+/).filter((t) => t.length > 0));

    functions.push({
      name,
      file: filePath,
      line: func.getStartLineNumber(),
      params: func.getParameters().map((p) => p.getType().getText()),
      returnType: func.getReturnType().getText(),
      exported: func.isExported(),
      bodyHash: hashBody(normalizedBodyText),
      normalizedBody: normalizedBodyText,
      tokens,
    });
  }

  // Get exported arrow functions from variable declarations
  for (const varStatement of sourceFile.getVariableStatements()) {
    if (!varStatement.isExported()) continue;

    for (const decl of varStatement.getDeclarations()) {
      const init = decl.getInitializer();
      if (!init) continue;

      // Check if it's an arrow function or function expression
      const initText = init.getText();
      if (!initText.includes('=>') && !initText.startsWith('function')) continue;

      const name = decl.getName();
      const normalizedBodyText = normalizeBody(initText);
      const tokens = new Set(normalizedBodyText.split(/\s+/).filter((t) => t.length > 0));

      // Extract parameters from arrow functions
      let params: string[] = [];
      if (init.getKind() === SyntaxKind.ArrowFunction) {
        const arrowFunc = init.asKind(SyntaxKind.ArrowFunction);
        if (arrowFunc) {
          params = arrowFunc.getParameters().map((p) => p.getType().getText());
        }
      }

      functions.push({
        name,
        file: filePath,
        line: decl.getStartLineNumber(),
        params,
        returnType: decl.getType().getText(),
        exported: true,
        bodyHash: hashBody(normalizedBodyText),
        normalizedBody: normalizedBodyText,
        tokens,
      });
    }
  }

  return functions;
}
