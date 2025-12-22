/**
 * @module commands/fix/refactorings
 * @description Smart refactoring patterns for complexity reduction
 *
 * Implements automatic transformations:
 * 1. If-chain → Lookup map (for string comparisons)
 * 2. Switch → Object map
 * 3. Long function → Extract sections
 * 4. Repeated conditions → Guard clauses
 */

import {
  Project,
  SourceFile,
  SyntaxKind,
  Node,
  IfStatement,
  SwitchStatement,
  FunctionDeclaration,
  Block,
} from "ts-morph";

// ============================================================================
// IF-CHAIN TO MAP CONVERSION
// ============================================================================

export interface IfChainInfo {
  startLine: number;
  endLine: number;
  conditions: Array<{
    check: string; // e.g., "trimmed.includes('valid')"
    result: string; // e.g., "'validateInput'"
    checkType: "includes" | "startsWith" | "endsWith" | "equals" | "other";
    searchValue?: string; // extracted value being searched
  }>;
  defaultResult?: string;
  variableName: string; // The variable being checked
}

const MAX_LENGTH = 3;

/**
 * Detect if-chain patterns that return based on string checks
 *
 * Pattern:
 *   if (str.includes('x')) return 'a';
 *   if (str.includes('y')) return 'b';
 *   return 'default';
 *
 * Can convert to:
 *   const map = { x: 'a', y: 'b' };
 *   for (const [key, val] of Object.entries(map)) {
 *     if (str.includes(key)) return val;
 *   }
 *   return 'default';
 */
export function detectIfChain(
  content: string,
  startLine: number,
): IfChainInfo | null {
  const lines = content.split("\n");
  const conditions: IfChainInfo["conditions"] = [];
  let variableName = "";
  let endLine = startLine;
  let defaultResult: string | undefined;

  // Pattern for if (variable.method('value')) return 'result';
  const ifPattern =
    /if\s*\(\s*(\w+)\.(\w+)\(['"]([^'"]+)['"]\)\s*\)\s*return\s+['"]([^'"]+)['"];?/;
  const returnPattern = /^\s*return\s+['"]([^'"]+)['"];?\s*$/;

  for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i] || "";
    const trimmed = line.trim();

    // Check for if-return pattern
    const ifMatch = trimmed.match(ifPattern);
    if (ifMatch) {
      const [, varName, method, searchVal, result] = ifMatch;
      if (!variableName) {
        variableName = varName || "";
      } else if (varName !== variableName) {
        // Different variable - chain broken
        break;
      }

      const checkType =
        method === "includes"
          ? "includes"
          : method === "startsWith"
            ? "startsWith"
            : method === "endsWith"
              ? "endsWith"
              : method === "equals" || method === "==="
                ? "equals"
                : "other";

      conditions.push({
        check: `${varName}.${method}('${searchVal}')`,
        result: `'${result}'`,
        checkType,
        searchValue: searchVal,
      });
      endLine = i + 1;
      continue;
    }

    // Check for default return
    const returnMatch = trimmed.match(returnPattern);
    if (returnMatch && conditions.length > 0) {
      defaultResult = `'${returnMatch[1]}'`;
      endLine = i + 1;
      break;
    }

    // Empty line or comment - continue
    if (trimmed === "" || trimmed.startsWith("//")) {
      continue;
    }

    // Other code - chain ends
    if (conditions.length > 0) {
      break;
    }
  }

  // Need at least 3 conditions for worthwhile conversion
  if (conditions.length < MAX_LENGTH) {
    return null;
  }

  // Check if all conditions use the same method
  const methods = new Set(conditions.map((c) => c.checkType));
  if (methods.size > 1 || methods.has("other")) {
    return null; // Mixed methods - can't easily convert
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
 * Generate lookup map code from if-chain
 */
export function generateLookupMap(chain: IfChainInfo): string {
  const method = chain.conditions[0]?.checkType || "includes";
  const entries = chain.conditions
    .filter((c) => c.searchValue)
    .map((c) => `  '${c.searchValue}': ${c.result}`)
    .join(",\n");

  const mapName = `${chain.variableName}Map`;

  let code = `const ${mapName}: Record<string, string> = {\n${entries}\n};\n\n`;

  if (method === "includes") {
    code += `for (const [key, value] of Object.entries(${mapName})) {\n`;
    code += `  if (${chain.variableName}.includes(key)) return value;\n`;
    code += `}\n`;
  } else if (method === "startsWith") {
    code += `for (const [key, value] of Object.entries(${mapName})) {\n`;
    code += `  if (${chain.variableName}.startsWith(key)) return value;\n`;
    code += `}\n`;
  } else if (method === "equals") {
    code += `if (${mapName}[${chain.variableName}]) return ${mapName}[${chain.variableName}];\n`;
  }

  if (chain.defaultResult) {
    code += `return ${chain.defaultResult};`;
  }

  return code;
}

// ============================================================================
// SWITCH TO MAP CONVERSION
// ============================================================================

export interface SwitchInfo {
  startLine: number;
  endLine: number;
  expression: string;
  cases: Array<{
    value: string;
    result: string;
  }>;
  defaultResult?: string;
}

/**
 * Detect switch statements that just return values
 */
export function detectSimpleSwitch(
  content: string,
  startLine: number,
): SwitchInfo | null {
  const lines = content.split("\n");
  const cases: SwitchInfo["cases"] = [];
  let expression = "";
  let endLine = startLine;
  let defaultResult: string | undefined;
  let inSwitch = false;
  let braceCount = 0;

  // Pattern for switch (expr) {
  const switchPattern = /switch\s*\(\s*([^)]+)\s*\)\s*\{?/;
  // Pattern for case 'value': return 'result';
  const casePattern =
    /case\s+['"]?([^'":\s]+)['"]?\s*:\s*(?:return\s+)?(['"]?[^;'"]+['"]?);?/;
  const defaultPattern = /default\s*:\s*(?:return\s+)?(['"]?[^;'"]+['"]?);?/;

  for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i] || "";
    const trimmed = line.trim();

    if (!inSwitch) {
      const switchMatch = trimmed.match(switchPattern);
      if (switchMatch) {
        expression = switchMatch[1] || "";
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
          value: caseMatch[1] || "",
          result: caseMatch[2] || "",
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
  if (cases.length < MAX_LENGTH) {
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

/**
 * Generate object map from switch
 */
export function generateSwitchMap(sw: SwitchInfo): string {
  const entries = sw.cases.map((c) => `  ${c.value}: ${c.result}`).join(",\n");

  const mapName = `resultMap`;

  let code = `const ${mapName}: Record<string, typeof ${sw.cases[0]?.result}> = {\n${entries}\n};\n\n`;
  code += `return ${mapName}[${sw.expression}]`;

  if (sw.defaultResult) {
    code += ` ?? ${sw.defaultResult}`;
  }

  code += ";";

  return code;
}

// ============================================================================
// SECTION EXTRACTION
// ============================================================================

export interface CodeSection {
  name: string;
  startLine: number;
  endLine: number;
  content: string;
  purpose: string;
}

/**
 * Detect logical sections in a long function
 * Looks for comment markers, blank line separations, and logical groupings
 */
export function detectSections(
  content: string,
  funcStartLine: number,
  funcEndLine: number,
): CodeSection[] {
  const lines = content.split("\n").slice(funcStartLine - 1, funcEndLine);
  const sections: CodeSection[] = [];
  let currentSection: Partial<CodeSection> | null = null;
  let sectionLines: string[] = [];

  // Patterns that indicate section boundaries
  const sectionCommentPattern = /^\s*\/\/\s*[-=]+\s*(.+?)\s*[-=]*\s*$/; // // === Section Name ===
  const simpleCommentPattern = /^\s*\/\/\s*([A-Z][A-Za-z\s]+)\s*$/; // // Section Name

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || "";
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
        currentSection.content = sectionLines.join("\n");
        sections.push(currentSection as CodeSection);
      }

      // Start new section
      currentSection = {
        name:
          sectionMatch[1]?.trim().toLowerCase().replace(/\s+/g, "_") ||
          `section_${i}`,
        startLine: globalLine,
        purpose: sectionMatch[1]?.trim() || "Unknown",
      };
      sectionLines = [];
      continue;
    }

    sectionLines.push(line);
  }

  // Save last section
  if (currentSection && sectionLines.length <= 2) return;

  currentSection.endLine = funcEndLine;
  currentSection.content = sectionLines.join("\n");
  sections.push(currentSection as CodeSection);

  // Only return if we found meaningful sections
  return sections.filter((s) => s.content.split("\n").length >= MAX_LENGTH);
}

/**
 * Generate extracted function from section
 */
export function generateExtractedFunction(
  section: CodeSection,
  params: string[],
  returnType: string = "string[]",
): string {
  const funcName = `format${section.name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("")}`;
  const paramList = params.join(", ");

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

// ============================================================================
// GUARD CLAUSE CONVERSION
// ============================================================================

/**
 * Detect if blocks that wrap most of function body and can be converted to guard
 *
 * Pattern:
 *   function foo() {
 *     if (condition) {
 *       // lots of code
 *     }
 *   }
 *
 * Convert to:
 *   function foo() {
 *     if (!condition) return;
 *     // lots of code
 *   }
 */
export function detectGuardOpportunity(
  content: string,
  funcStartLine: number,
): {
  condition: string;
  invertedCondition: string;
  blockStart: number;
  blockEnd: number;
} | null {
  const lines = content.split("\n");
  let funcStart = -1;
  let braceCount = 0;
  let ifLine = -1;
  let ifCondition = "";

  // Find function start and first significant if
  for (let i = funcStartLine - 1; i < lines.length; i++) {
    const line = lines[i] || "";
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
          ifCondition = ifMatch[1] || "";
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

/**
 * Invert a boolean condition
 */
function invertCondition(condition: string): string {
  // Already negated
  if (condition.startsWith("!") && !condition.startsWith("!=")) {
    return condition.slice(1).trim();
  }

  // Comparison operators
  const comparisons: [RegExp, string][] = [
    [/===/, "!=="],
    [/!==/, "==="],
    [/==/, "!="],
    [/!=/, "=="],
    [/>=/, "<"],
    [/<=/, ">"],
    [/>(?!=)/, "<="],
    [/<(?!=)/, ">="],
  ];

  for (const [pattern, replacement] of comparisons) {
    if (pattern.test(condition)) {
      return condition.replace(pattern, replacement);
    }
  }

  // Logical operators
  if (condition.includes("&&") || condition.includes("||")) {
    return `!(${condition})`;
  }

  // Simple negation
  return `!${condition}`;
}

// ============================================================================
// APPLY REFACTORINGS
// ============================================================================

export interface RefactoringResult {
  type:
    | "if-chain-to-map"
    | "switch-to-map"
    | "extract-section"
    | "guard-clause";
  originalCode: string;
  newCode: string;
  startLine: number;
  endLine: number;
  description: string;
}

/**
 * Find all applicable refactorings in a function
 */
export function findRefactorings(
  content: string,
  funcStartLine: number,
  funcEndLine: number,
): RefactoringResult[] {
  const results: RefactoringResult[] = [];
  const lines = content.split("\n");

  // 1. Check for if-chains
  for (let i = funcStartLine; i < funcEndLine; i++) {
    const chain = detectIfChain(content, i);
    if (chain && chain.conditions.length >= MAX_LENGTH) {
      const originalCode = lines
        .slice(chain.startLine - 1, chain.endLine)
        .join("\n");
      results.push({
        type: "if-chain-to-map",
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
    if (sw && sw.cases.length >= MAX_LENGTH) {
      const originalCode = lines.slice(sw.startLine - 1, sw.endLine).join("\n");
      results.push({
        type: "switch-to-map",
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
        type: "extract-section",
        originalCode: section.content,
        newCode: generateExtractedFunction(section, [
          "data: AiContextData",
          "lines: string[]",
        ]),
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
      type: "guard-clause",
      originalCode: `if (${guard.condition}) {`,
      newCode: `if (${guard.invertedCondition}) return;\n`,
      startLine: guard.blockStart,
      endLine: guard.blockEnd,
      description: `Convert wrapping if to guard clause`,
    });
  }

  return results;
}
