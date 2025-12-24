/**
 * @module commands/fix/ast-utils/extract-function
 * @description Extract code blocks into separate functions
 *
 * Analyzes:
 * - Variables used (become parameters)
 * - Variables modified (become return values)
 * - Async context
 */

import {
  findUsedVariables,
  findDeclaredVariables,
  findModifiedVariables,
} from '../../../lib/@ast';
import type { ExtractFunctionOptions, ExtractFunctionResult } from './types';

/**
 * Extract a block of code into a new function
 *
 * @param content - Source file content
 * @param filePath - File path (for AST parsing)
 * @param options - Extraction options
 */
export function extractFunction(
  content: string,
  filePath: string,
  options: ExtractFunctionOptions,
): ExtractFunctionResult {
  try {
    // Create project for AST analysis
    const { astPool } = require('../core/ast-pool');
    const [, cleanup] = astPool.createSourceFile(content, filePath);

    try {
      const lines = content.split('\n');
    const extractedLines = lines.slice(options.startLine - 1, options.endLine);
    const extractedCode = extractedLines.join('\n');

    // Analyze variables
    const usedVars = findUsedVariables(extractedCode);
    const declaredVars = findDeclaredVariables(extractedCode);
    const modifiedVars = findModifiedVariables(extractedCode, declaredVars);

    // Parameters are used but not declared in the block
    const params = usedVars.filter(v => !declaredVars.includes(v));

    // Build function signature
    const paramList = params.length > 0 ? params.join(', ') : '';
    const asyncKeyword = options.isAsync ? 'async ' : '';

    // Determine return statement
    let returnStatement = '';
    if (modifiedVars.length === 1) {
      returnStatement = `\n  return ${modifiedVars[0]};`;
    } else if (modifiedVars.length > 1) {
      returnStatement = `\n  return { ${modifiedVars.join(', ')} };`;
    }

    // Build function body with proper indentation
    const indentedCode = extractedLines
      .map(line => '  ' + line.trimStart())
      .join('\n');

    const newFunction = `${asyncKeyword}function ${options.functionName}(${paramList}) {\n${indentedCode}${returnStatement}\n}`;

    // Create function call
    const awaitKeyword = options.isAsync ? 'await ' : '';
    let functionCall: string;

    if (modifiedVars.length === 0) {
      functionCall = `${awaitKeyword}${options.functionName}(${paramList});`;
    } else if (modifiedVars.length === 1) {
      functionCall = `const ${modifiedVars[0]} = ${awaitKeyword}${options.functionName}(${paramList});`;
    } else {
      functionCall = `const { ${modifiedVars.join(', ')} } = ${awaitKeyword}${options.functionName}(${paramList});`;
    }

    // Replace extracted lines with function call
    const newLines = [
      ...lines.slice(0, options.startLine - 1),
      '  ' + functionCall,
      ...lines.slice(options.endLine),
    ];

      // Insert new function at end of file
      const insertIndex = newLines.length - 1;
      newLines.splice(insertIndex, 0, '', newFunction);

      return {
        success: true,
        newContent: newLines.join('\n'),
        extractedFunction: newFunction,
      };
    } finally {
      cleanup();
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
