import { type IfStatement, SyntaxKind } from 'ts-morph';
import { withSourceFile } from '@/lib';
import {
  type ConditionInfo,
  findDefaultReturn,
  invertCondition,
  parseIfStatement,
} from './parsers';
import type { CodeSection, IfChainInfo, RefactoringResult, SwitchInfo } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_CHAIN_LENGTH = 3;

// ============================================================================
// IF-CHAIN DETECTION
// ============================================================================

/**
 * Detect if-chain pattern in code
 */
export function detectIfChain(content: string, startLine: number): IfChainInfo | null {
  try {
    return detectIfChainAST(content, startLine);
  } catch {
    return detectIfChainRegex(content, startLine);
  }
}

/**
 * AST-based if-chain detection
 */
function detectIfChainAST(content: string, startLine: number): IfChainInfo | null {
  return withSourceFile(content, 'temp.ts', (sourceFile) => {
    const conditions: ConditionInfo[] = [];
    let variableName = '';
    let endLine = startLine;

    // Find relevant if statements
    const ifStatements = sourceFile
      .getDescendantsOfKind(SyntaxKind.IfStatement)
      .filter((stmt: IfStatement) => stmt.getStartLineNumber() >= startLine);

    // Process each if statement
    for (const ifStmt of ifStatements) {
      const result = processIfStatement(ifStmt, variableName, conditions.length, endLine);

      if (result.shouldBreak) break;
      if (result.shouldContinue) continue;

      if (result.condition) {
        conditions.push(result.condition);
        variableName = result.variableName || variableName;
        endLine = result.endLine;
      }
    }

    // Find default return
    const returnStatements = sourceFile.getDescendantsOfKind(SyntaxKind.ReturnStatement);
    const defaultReturn = findDefaultReturn(returnStatements, endLine);

    let defaultResult: string | undefined;
    if (defaultReturn) {
      defaultResult = defaultReturn.result;
      endLine = defaultReturn.newEndLine;
    }

    // Validate chain
    return validateAndBuildChain(conditions, startLine, endLine, defaultResult, variableName);
  });
}

/**
 * Process a single if statement in the chain
 */
function processIfStatement(
  ifStmt: IfStatement,
  currentVarName: string,
  conditionCount: number,
  currentEndLine: number,
): {
  shouldBreak: boolean;
  shouldContinue: boolean;
  condition: ConditionInfo | null;
  variableName: string | null;
  endLine: number;
} {
  const ifLine = ifStmt.getStartLineNumber();

  // Check for gap in sequence
  if (conditionCount > 0 && ifLine > currentEndLine + 1) {
    return {
      shouldBreak: true,
      shouldContinue: false,
      condition: null,
      variableName: null,
      endLine: currentEndLine,
    };
  }

  // Parse the if statement
  const parsed = parseIfStatement(ifStmt, currentVarName);

  if (!parsed.condition) {
    // Variable mismatch breaks the chain
    if (parsed.variableName && currentVarName && parsed.variableName !== currentVarName) {
      return {
        shouldBreak: true,
        shouldContinue: false,
        condition: null,
        variableName: null,
        endLine: currentEndLine,
      };
    }
    return {
      shouldBreak: false,
      shouldContinue: true,
      condition: null,
      variableName: null,
      endLine: currentEndLine,
    };
  }

  return {
    shouldBreak: false,
    shouldContinue: false,
    condition: parsed.condition,
    variableName: parsed.variableName,
    endLine: parsed.endLine,
  };
}

/**
 * Validate chain and build result
 */
function validateAndBuildChain(
  conditions: ConditionInfo[],
  startLine: number,
  endLine: number,
  defaultResult: string | undefined,
  variableName: string,
): IfChainInfo | null {
  // Need at least MIN_CHAIN_LENGTH conditions
  if (conditions.length < MIN_CHAIN_LENGTH) {
    return null;
  }

  // Check if all conditions use the same method
  const methods = new Set(conditions.map((c) => c.checkType));
  if (methods.size > 1 || methods.has('other')) {
    return null;
  }

  return {
    startLine,
    endLine,
    conditions,
    defaultResult,
    variableName,
  };
}

/**
 * Regex-based fallback for if-chain detection
 */
function detectIfChainRegex(content: string, startLine: number): IfChainInfo | null {
  const lines = content.split('\n');
  const conditions: ConditionInfo[] = [];
  let variableName = '';
  let endLine = startLine;

  // Pattern: if (var.method('value')) return 'result';
  const ifPattern =
    /if\s*\(\s*(\w+)\.(includes|startsWith|endsWith)\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)\s*(?:return\s+)?['"]([^'"]+)['"]/;

  for (let i = startLine - 1; i < lines.length && i < startLine + 50; i++) {
    const line = lines[i] || '';
    const match = line.match(ifPattern);

    if (match) {
      const [, varName, method, searchValue, result] = match;
      if (!varName || !method || !searchValue || !result) continue;

      // Check variable consistency
      if (!variableName) {
        variableName = varName;
      } else if (varName !== variableName) {
        break;
      }

      conditions.push({
        check: `${varName}.${method}('${searchValue}')`,
        result: `'${result}'`,
        checkType: method as ConditionInfo['checkType'],
        searchValue,
      });
      endLine = i + 1;
    } else if (conditions.length > 0 && !line.trim().startsWith('if')) {
      // Check for default return
      const returnMatch = line.match(/return\s+['"]([^'"]+)['"]/);
      if (returnMatch) {
        return validateAndBuildChain(
          conditions,
          startLine,
          i + 1,
          `'${returnMatch[1]}'`,
          variableName,
        );
      }
      break;
    }
  }

  return validateAndBuildChain(conditions, startLine, endLine, undefined, variableName);
}

export function generateLookupMap(chain: IfChainInfo): string {
  const method = chain.conditions[0]?.checkType || 'includes';
  const entries = chain.conditions
    .filter((c) => c.searchValue)
    .map((c) => `  '${c.searchValue}': ${c.result}`)
    .join(',\n');

  const mapName = `${chain.variableName}Map`;

  let code = `const ${mapName}: Record<string, string> = {\n${entries}\n};\n\n`;

  if (method === 'includes') {
    code += `for (const [key, value] of Object.entries(${mapName})) {\n`;
    code += `  if (${chain.variableName}.includes(key)) return value;\n`;
    code += `}\n`;
  } else if (method === 'startsWith') {
    code += `for (const [key, value] of Object.entries(${mapName})) {\n`;
    code += `  if (${chain.variableName}.startsWith(key)) return value;\n`;
    code += `}\n`;
  } else if (method === 'equals') {
    code += `if (${mapName}[${chain.variableName}]) return ${mapName}[${chain.variableName}];\n`;
  }

  if (chain.defaultResult) {
    code += `return ${chain.defaultResult};`;
  }

  return code;
}

export function detectSimpleSwitch(content: string, startLine: number): SwitchInfo | null {
  const lines = content.split('\n');
  const cases: SwitchInfo['cases'] = [];
  let expression = '';
  let endLine = startLine;
  let defaultResult: string | undefined;
  let inSwitch = false;
  let braceCount = 0;

  // Pattern for switch (expr) {
  const switchPattern = /switch\s*\(\s*([^)]+)\s*\)\s*\{?/;
  // Pattern for case 'value': return 'result';
  const casePattern = /case\s+['"]?([^'":\s]+)['"]?\s*:\s*(?:return\s+)?(['"]?[^;'"]+['"]?);?/;
  const defaultPattern = /default\s*:\s*(?:return\s+)?(['"]?[^;'"]+['"]?);?/;

  for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i] || '';
    const trimmed = line.trim();

    if (!inSwitch) {
      const switchMatch = trimmed.match(switchPattern);
      if (switchMatch) {
        expression = switchMatch[1] || '';
        inSwitch = true;
        braceCount = (trimmed.match(/\{/g) || []).length;
        continue;
      }
    }

    if (inSwitch) {
      braceCount += (trimmed.match(/\{/g) || []).length;
      braceCount -= (trimmed.match(/\}/g) || []).length;

      const caseMatch = trimmed.match(casePattern);
      if (caseMatch) {
        cases.push({
          value: caseMatch[1] || '',
          result: caseMatch[2] || '',
        });
        continue;
      }

      const defaultMatch = trimmed.match(defaultPattern);
      if (defaultMatch) {
        defaultResult = defaultMatch[1];
        continue;
      }

      if (braceCount === 0) {
        endLine = i + 1;
        break;
      }
    }
  }

  // Need at least 3 cases
  if (cases.length < MIN_CHAIN_LENGTH) {
    return null;
  }

  return {
    startLine,
    endLine,
    expression,
    cases,
    defaultResult,
  };
}

export function generateSwitchMap(sw: SwitchInfo): string {
  const entries = sw.cases.map((c) => `  ${c.value}: ${c.result}`).join(',\n');

  const mapName = `resultMap`;

  let code = `const ${mapName}: Record<string, typeof ${sw.cases[0]?.result}> = {\n${entries}\n};\n\n`;
  code += `return ${mapName}[${sw.expression}]`;

  if (sw.defaultResult) {
    code += ` ?? ${sw.defaultResult}`;
  }

  code += ';';

  return code;
}

export function detectSections(
  content: string,
  funcStartLine: number,
  funcEndLine: number,
): CodeSection[] {
  const lines = content.split('\n').slice(funcStartLine - 1, funcEndLine);
  const sections: CodeSection[] = [];
  let currentSection: Partial<CodeSection> | null = null;
  let sectionLines: string[] = [];

  // Patterns that indicate section boundaries
  const sectionCommentPattern = /^\s*\/\/\s*[-=]+\s*(.+?)\s*[-=]*\s*$/; // // === Section Name ===
  const simpleCommentPattern = /^\s*\/\/\s*([A-Z][A-Za-z\s]+)\s*$/; // // Section Name

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    const trimmed = line.trim();
    const globalLine = funcStartLine + i;

    // Check for section comment
    let sectionMatch = trimmed.match(sectionCommentPattern);
    if (!sectionMatch) {
      sectionMatch = trimmed.match(simpleCommentPattern);
    }

    if (sectionMatch) {
      // Save previous section
      if (currentSection && sectionLines.length > 2) {
        currentSection.endLine = globalLine - 1;
        currentSection.content = sectionLines.join('\n');
        sections.push(currentSection as CodeSection);
      }

      // Start new section
      currentSection = {
        name: sectionMatch[1]?.trim().toLowerCase().replace(/\s+/g, '_') || `section_${i}`,
        startLine: globalLine,
        purpose: sectionMatch[1]?.trim() || 'Unknown',
      };
      sectionLines = [];
      continue;
    }

    sectionLines.push(line);
  }

  // Save last section
  if (!currentSection || sectionLines.length <= 2) {
    return sections.filter((s) => s.content.split('\n').length >= MIN_CHAIN_LENGTH);
  }

  currentSection.endLine = funcEndLine;
  currentSection.content = sectionLines.join('\n');
  sections.push(currentSection as CodeSection);

  // Only return if we found meaningful sections
  return sections.filter((s) => s.content.split('\n').length >= MIN_CHAIN_LENGTH);
}

export function generateExtractedFunction(
  section: CodeSection,
  params: string[],
  returnType: string = 'string[]',
): string {
  const funcName = `format${section.name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')}`;
  const paramList = params.join(', ');

  return `
/**
 * ${section.purpose}
 */
function ${funcName}(${paramList}): ${returnType} {
  const lines: string[] = [];
${section.content}
  return lines;
}
`;
}

export function detectGuardOpportunity(
  content: string,
  funcStartLine: number,
): {
  condition: string;
  invertedCondition: string;
  blockStart: number;
  blockEnd: number;
} | null {
  const lines = content.split('\n');
  let funcStart = -1;
  let braceCount = 0;
  let ifLine = -1;
  let ifCondition = '';

  // Find function start and first significant if
  for (let i = funcStartLine - 1; i < lines.length; i++) {
    const line = lines[i] || '';
    const trimmed = line.trim();

    // Track braces
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    if (funcStart === -1 && openBraces > 0) {
      funcStart = i;
      braceCount = openBraces - closeBraces;
      continue;
    }

    if (funcStart !== -1) {
      braceCount += openBraces - closeBraces;

      // Look for if at depth 1
      if (braceCount === 1 && ifLine === -1) {
        const ifMatch = trimmed.match(/^if\s*\(\s*(.+)\s*\)\s*\{?$/);
        if (ifMatch) {
          ifLine = i + 1;
          ifCondition = ifMatch[1] || '';
        }
      }

      // Function ends
      if (braceCount === 0) {
        break;
      }
    }
  }

  if (ifLine === -1 || !ifCondition) {
    return null;
  }

  // Invert the condition
  const invertedCondition = invertCondition(ifCondition);

  return {
    condition: ifCondition,
    invertedCondition,
    blockStart: ifLine,
    blockEnd: funcStartLine + lines.length - 1,
  };
}

export function findRefactorings(
  content: string,
  funcStartLine: number,
  funcEndLine: number,
): RefactoringResult[] {
  const results: RefactoringResult[] = [];
  const lines = content.split('\n');

  // 1. Check for if-chains
  for (let i = funcStartLine; i < funcEndLine; i++) {
    const chain = detectIfChain(content, i);
    if (chain && chain.conditions.length >= MIN_CHAIN_LENGTH) {
      const originalCode = lines.slice(chain.startLine - 1, chain.endLine).join('\n');
      results.push({
        type: 'if-chain-to-map',
        originalCode,
        newCode: generateLookupMap(chain),
        startLine: chain.startLine,
        endLine: chain.endLine,
        description: `Convert ${chain.conditions.length} if-statements to lookup map`,
      });
      // Skip processed lines
      i = chain.endLine;
    }
  }

  // 2. Check for simple switches
  for (let i = funcStartLine; i < funcEndLine; i++) {
    const sw = detectSimpleSwitch(content, i);
    if (sw && sw.cases.length >= MIN_CHAIN_LENGTH) {
      const originalCode = lines.slice(sw.startLine - 1, sw.endLine).join('\n');
      results.push({
        type: 'switch-to-map',
        originalCode,
        newCode: generateSwitchMap(sw),
        startLine: sw.startLine,
        endLine: sw.endLine,
        description: `Convert ${sw.cases.length}-case switch to object map`,
      });
      i = sw.endLine;
    }
  }

  // 3. Check for extractable sections
  const sections = detectSections(content, funcStartLine, funcEndLine);
  if (sections.length >= 2) {
    for (const section of sections) {
      results.push({
        type: 'extract-section',
        originalCode: section.content,
        newCode: generateExtractedFunction(section, ['data: AiContextData', 'lines: string[]']),
        startLine: section.startLine,
        endLine: section.endLine,
        description: `Extract "${section.purpose}" to separate function`,
      });
    }
  }

  // 4. Check for guard clause opportunity
  const guard = detectGuardOpportunity(content, funcStartLine);
  if (guard) {
    results.push({
      type: 'guard-clause',
      originalCode: `if (${guard.condition}) {`,
      newCode: `if (${guard.invertedCondition}) return;\n`,
      startLine: guard.blockStart,
      endLine: guard.blockEnd,
      description: `Convert wrapping if to guard clause`,
    });
  }

  return results;
}
