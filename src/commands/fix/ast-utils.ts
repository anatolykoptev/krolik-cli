/**
 * @module commands/fix/ast-utils
 * @description AST utilities using ts-morph for safe code transformations
 *
 * Uses TypeScript Compiler API (via ts-morph) for:
 * - Function extraction
 * - Nesting reduction (early returns)
 * - File splitting (SRP)
 */

import {
  Project,
  SourceFile,
  SyntaxKind,
  Node,
  IfStatement,
  Block,
} from "ts-morph";
import * as path from "node:path";
import { createProject } from "./strategies/shared";

const MAX_LENGTH = 3;

// ============================================================================
// SOURCE FILE HELPERS
// ============================================================================

/**
 * Create a source file from content
 */
export function createSourceFile(
  project: Project,
  filePath: string,
  content: string,
): SourceFile {
  return project.createSourceFile(filePath, content, { overwrite: true });
}

// ============================================================================
// FUNCTION EXTRACTION
// ============================================================================

export interface ExtractFunctionOptions {
  startLine: number;
  endLine: number;
  functionName: string;
  isAsync?: boolean;
}

export interface ExtractFunctionResult {
  success: boolean;
  newContent?: string;
  error?: string;
  extractedFunction?: string;
}

/**
 * Extract a block of code into a new function
 *
 * Analyzes:
 * - Variables used (become parameters)
 * - Variables modified (become return values)
 * - Async context
 */
export function extractFunction(
  content: string,
  filePath: string,
  options: ExtractFunctionOptions,
): ExtractFunctionResult {
  try {
    // Create project for future AST-based improvements
    const project = createProject();
    createSourceFile(project, filePath, content);

    const lines = content.split("\n");
    const extractedLines = lines.slice(options.startLine - 1, options.endLine);
    const extractedCode = extractedLines.join("\n");

    // Find variables used in the block
    const usedVars = findUsedVariables(extractedCode);
    const declaredVars = findDeclaredVariables(extractedCode);

    // Parameters are used but not declared in the block
    const params = usedVars.filter((v) => !declaredVars.includes(v));

    // Find what's returned/assigned
    const modifiedVars = findModifiedVariables(extractedCode, declaredVars);

    // Build the new function
    const paramList = params.length > 0 ? params.join(", ") : "";
    const asyncKeyword = options.isAsync ? "async " : "";

    // Determine return statement
    let returnStatement = "";
    if (modifiedVars.length === 1) {
      returnStatement = `\n  return ${modifiedVars[0]};`;
    } else if (modifiedVars.length > 1) {
      returnStatement = `\n  return { ${modifiedVars.join(", ")} };`;
    }

    const indentedCode = extractedLines
      .map((line) => "  " + line.trimStart())
      .join("\n");

    const newFunction = `${asyncKeyword}function ${options.functionName}(${paramList}) {\n${indentedCode}${returnStatement}\n}`;

    // Create the function call
    let functionCall: string;
    const awaitKeyword = options.isAsync ? "await " : "";

    if (modifiedVars.length === 0) {
      functionCall = `${awaitKeyword}${options.functionName}(${paramList});`;
    } else if (modifiedVars.length === 1) {
      functionCall = `const ${modifiedVars[0]} = ${awaitKeyword}${options.functionName}(${paramList});`;
    } else {
      functionCall = `const { ${modifiedVars.join(", ")} } = ${awaitKeyword}${options.functionName}(${paramList});`;
    }

    // Replace the extracted lines with function call
    const newLines = [
      ...lines.slice(0, options.startLine - 1),
      "  " + functionCall, // Indent to match context
      ...lines.slice(options.endLine),
    ];

    // Insert the new function at the end of file (before last line if it's empty)
    const insertIndex = newLines.length - 1;
    newLines.splice(insertIndex, 0, "", newFunction);

    return {
      success: true,
      newContent: newLines.join("\n"),
      extractedFunction: newFunction,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// NESTING REDUCTION (EARLY RETURNS)
// ============================================================================

export interface ReduceNestingResult {
  success: boolean;
  newContent?: string;
  changesCount?: number;
  error?: string;
}

/**
 * Reduce nesting by converting if-else to early returns
 *
 * Transforms:
 *   if (condition) {
 *     // lots of code
 *   }
 *
 * To:
 *   if (!condition) return;
 *   // lots of code
 */
export function reduceNesting(
  content: string,
  filePath: string,
  targetLine?: number,
): ReduceNestingResult {
  try {
    const project = createProject();
    const sourceFile = createSourceFile(project, filePath, content);

    let changesCount = 0;

    // Find all functions
    const functions = [
      ...sourceFile.getFunctions(),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
    ];

    for (const func of functions) {
      const body = getBody(func);
      if (!body) continue;

      // Skip if we're targeting a specific line and this function isn't there
      if (targetLine !== undefined) {
        const startLine = func.getStartLineNumber();
        const endLine = func.getEndLineNumber();
        if (targetLine < startLine || targetLine > endLine) continue;
      }

      const statements = body.getStatements();

      // Look for if statements that can be inverted
      for (let i = statements.length - 1; i >= 0; i--) {
        const stmt = statements[i];
        if (!stmt || !Node.isIfStatement(stmt)) continue;

        const ifStmt = stmt as IfStatement;
        const thenBlock = ifStmt.getThenStatement();
        const elseBlock = ifStmt.getElseStatement();

        // Pattern 1: if with no else, where the if is wrapping most of the function
        if (!elseBlock && Node.isBlock(thenBlock)) {
          const thenStatements = thenBlock.getStatements();

          // Only transform if there's significant code inside
          if (thenStatements.length >= MAX_LENGTH) {
            const condition = ifStmt.getExpression().getText();
            const invertedCondition = invertCondition(condition);

            // Get the inner code
            const innerCode = thenStatements.map((s) => s.getText()).join("\n");

            // Replace with early return + inner code
            ifStmt.replaceWithText(
              `if (${invertedCondition}) return;\n\n${innerCode}`,
            );
            changesCount++;
          }
        }

        // Pattern 2: if-else where else is just return
        if (elseBlock && Node.isBlock(elseBlock)) {
          const elseStatements = elseBlock.getStatements();
          if (
            elseStatements.length === 1 &&
            elseStatements[0]?.getText().startsWith("return")
          ) {
            const condition = ifStmt.getExpression().getText();
            const invertedCondition = invertCondition(condition);
            const returnStmt = elseStatements[0].getText();

            // Get then block code
            const thenCode = Node.isBlock(thenBlock)
              ? thenBlock
                  .getStatements()
                  .map((s) => s.getText())
                  .join("\n")
              : thenBlock.getText();

            // Replace with early return + then code
            ifStmt.replaceWithText(
              `if (${invertedCondition}) ${returnStmt}\n\n${thenCode}`,
            );
            changesCount++;
          }
        }
      }

      // Pattern 3: for/while loops with guard if at start
      changesCount += reduceLoopNesting(body);

      // Pattern 4: nested ifs that can be combined with &&
      changesCount += combineNestedIfs(body);
    }

    if (changesCount === 0) {
      return { success: false, error: "No patterns found to reduce nesting" };
    }

    return {
      success: true,
      newContent: sourceFile.getFullText(),
      changesCount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Combine nested ifs into single if with &&
 *
 * Transforms:
 *   if (a) {
 *     if (b) {
 *       // code
 *     }
 *   }
 *
 * To:
 *   if (a && b) {
 *     // code
 *   }
 */
function combineNestedIfs(body: Block): number {
  let changes = 0;
  const statements = body.getStatements();

  for (const stmt of statements) {
    if (!Node.isIfStatement(stmt)) continue;

    const outerIf = stmt as IfStatement;
    const outerThen = outerIf.getThenStatement();
    const outerElse = outerIf.getElseStatement();

    // Must have no else clause
    if (outerElse) continue;
    if (!Node.isBlock(outerThen)) continue;

    const innerStatements = outerThen.getStatements();
    // Must have exactly one statement which is an if
    if (innerStatements.length !== 1) continue;

    const innerStmt = innerStatements[0];
    if (!innerStmt || !Node.isIfStatement(innerStmt)) continue;

    const innerIf = innerStmt as IfStatement;
    const innerElse = innerIf.getElseStatement();

    // Inner if must also have no else
    if (innerElse) continue;

    const outerCond = outerIf.getExpression().getText();
    const innerCond = innerIf.getExpression().getText();
    const innerBody = innerIf.getThenStatement().getText();

    // Combine conditions with &&
    const combinedCond = `(${outerCond}) && (${innerCond})`;
    outerIf.replaceWithText(`if (${combinedCond}) ${innerBody}`);
    changes++;
  }

  return changes;
}

/**
 * Reduce nesting in loops by converting guard ifs to early continue
 *
 * Transforms:
 *   for (x of arr) {
 *     if (condition) {
 *       // lots of code
 *     }
 *   }
 *
 * To:
 *   for (x of arr) {
 *     if (!condition) continue;
 *     // lots of code
 *   }
 */
function reduceLoopNesting(body: Block): number {
  let changes = 0;

  // Find for and while statements
  const loops = [
    ...body.getDescendantsOfKind(SyntaxKind.ForStatement),
    ...body.getDescendantsOfKind(SyntaxKind.ForOfStatement),
    ...body.getDescendantsOfKind(SyntaxKind.ForInStatement),
    ...body.getDescendantsOfKind(SyntaxKind.WhileStatement),
  ];

  for (const loop of loops) {
    const loopBody = loop.getStatement();
    if (!Node.isBlock(loopBody)) continue;

    const statements = loopBody.getStatements();
    if (statements.length !== 1) continue;

    const firstStmt = statements[0];
    if (!firstStmt || !Node.isIfStatement(firstStmt)) continue;

    const ifStmt = firstStmt as IfStatement;
    const thenBlock = ifStmt.getThenStatement();
    const elseBlock = ifStmt.getElseStatement();

    // Only if there's no else and then has multiple statements
    if (elseBlock || !Node.isBlock(thenBlock)) continue;

    const thenStatements = thenBlock.getStatements();
    if (thenStatements.length < 2) continue;

    const condition = ifStmt.getExpression().getText();
    const invertedCondition = invertCondition(condition);
    const innerCode = thenStatements.map((s) => s.getText()).join("\n");

    // Replace with early continue + inner code
    ifStmt.replaceWithText(
      `if (${invertedCondition}) continue;\n\n${innerCode}`,
    );
    changes++;
  }

  return changes;
}

// ============================================================================
// FILE SPLITTING (SRP)
// ============================================================================

export interface SplitFileResult {
  success: boolean;
  files?: Array<{ path: string; content: string }>;
  error?: string;
}

export interface SplitConfig {
  /** Group exports by type (functions, types, constants) */
  byType?: boolean;
  /** Group exports by prefix (handle*, create*, etc) */
  byPrefix?: boolean;
  /** Custom grouping function */
  groupFn?: (name: string, node: Node) => string;
}

/**
 * Split a file with too many exports into multiple files
 */
export function splitFile(
  content: string,
  filePath: string,
  config: SplitConfig = { byType: true },
): SplitFileResult {
  try {
    const project = createProject();
    const sourceFile = createSourceFile(project, filePath, content);

    const groups = new Map<string, string[]>();
    const groupContents = new Map<string, string[]>();
    const imports = new Set<string>();

    // Collect imports
    for (const imp of sourceFile.getImportDeclarations()) {
      imports.add(imp.getText());
    }

    // Group exported items
    const exportedDeclarations = sourceFile.getExportedDeclarations();

    for (const [name, declarations] of exportedDeclarations) {
      if (declarations.length === 0) continue;
      const decl = declarations[0];
      if (!decl) continue;

      let groupName = "utils";

      if (config.groupFn) {
        groupName = config.groupFn(name, decl);
      } else if (config.byType) {
        groupName = getGroupByType(decl);
      } else if (config.byPrefix) {
        groupName = getGroupByPrefix(name);
      }

      if (!groups.has(groupName)) {
        groups.set(groupName, []);
        groupContents.set(groupName, []);
      }

      groups.get(groupName)!.push(name);

      // Get the full declaration text with export
      const parent = decl.getParent();
      let declText = "";

      if (Node.isVariableDeclaration(decl)) {
        const varStmt = decl.getFirstAncestorByKind(
          SyntaxKind.VariableStatement,
        );
        if (varStmt) {
          declText = varStmt.getText();
        }
      } else {
        declText = parent?.getText() || decl.getText();
      }

      // Ensure it has export
      if (!declText.startsWith("export")) {
        declText = "export " + declText;
      }

      groupContents.get(groupName)!.push(declText);
    }

    // Don't split if only 1-2 groups
    if (groups.size < 2) {
      return { success: false, error: "File cannot be meaningfully split" };
    }

    // Generate files
    const baseName = path.basename(filePath, path.extname(filePath));
    const dir = path.dirname(filePath);
    const files: Array<{ path: string; content: string }> = [];

    const importsText = Array.from(imports).join("\n");
    const reExports: string[] = [];

    for (const [groupName, contents] of groupContents) {
      const newFileName =
        groupName === "index" ? "index.ts" : `${baseName}.${groupName}.ts`;
      const newFilePath = path.join(dir, newFileName);

      const fileContent = `${importsText}\n\n${contents.join("\n\n")}\n`;
      files.push({ path: newFilePath, content: fileContent });

      if (groupName !== "index") {
        reExports.push(`export * from './${baseName}.${groupName}';`);
      }
    }

    // Create index file with re-exports
    const indexPath = path.join(dir, "index.ts");
    const indexContent = `/**\n * @module ${baseName}\n * Re-exports from split modules\n */\n\n${reExports.join("\n")}\n`;
    files.push({ path: indexPath, content: indexContent });

    return { success: true, files };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// AST-BASED VARIABLE ANALYSIS
// ============================================================================

/**
 * Find all identifiers used in code (AST-based)
 *
 * Uses ts-morph to find actual Identifier nodes, excluding:
 * - Property names in member expressions (obj.property)
 * - Type annotations
 * - Import/export specifiers
 */
function findUsedVariables(code: string): string[] {
  const vars = new Set<string>();

  try {
    const project = createProject();
    const sourceFile = project.createSourceFile("temp.ts", code, {
      overwrite: true,
    });

    const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);

    for (const id of identifiers) {
      const name = id.getText();

      // Skip keywords and globals
      if (isKeyword(name) || isGlobal(name)) continue;

      // Skip property access (obj.property - skip "property")
      const parent = id.getParent();
      if (
        parent &&
        Node.isPropertyAccessExpression(parent) &&
        parent.getName() === name &&
        parent.getExpression() !== id
      ) {
        continue;
      }

      // Skip type references
      if (parent && Node.isTypeReference(parent)) continue;

      // Skip import/export specifiers
      if (
        parent &&
        (Node.isImportSpecifier(parent) || Node.isExportSpecifier(parent))
      ) {
        continue;
      }

      vars.add(name);
    }
  } catch {
    // Fallback to regex for invalid code
    return findUsedVariablesRegex(code);
  }

  return Array.from(vars);
}

/**
 * Regex fallback for findUsedVariables (for invalid/partial code)
 */
function findUsedVariablesRegex(code: string): string[] {
  const vars = new Set<string>();
  const identifierPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;

  let match;
  while ((match = identifierPattern.exec(code)) !== null) {
    const name = match[1];
    if (name && !isKeyword(name) && !isGlobal(name)) {
      vars.add(name);
    }
  }

  return Array.from(vars);
}

/**
 * Find variables declared in code (AST-based)
 *
 * Finds:
 * - const/let/var declarations
 * - Destructuring patterns
 * - Function parameters
 */
function findDeclaredVariables(code: string): string[] {
  const vars: string[] = [];

  try {
    const project = createProject();
    const sourceFile = project.createSourceFile("temp.ts", code, {
      overwrite: true,
    });

    // Variable declarations
    const varDeclarations = sourceFile.getDescendantsOfKind(
      SyntaxKind.VariableDeclaration,
    );
    for (const decl of varDeclarations) {
      const nameNode = decl.getNameNode();

      if (Node.isIdentifier(nameNode)) {
        vars.push(nameNode.getText());
      } else if (Node.isObjectBindingPattern(nameNode)) {
        // Destructuring: const { a, b } = obj
        for (const element of nameNode.getElements()) {
          const name = element.getNameNode();
          if (Node.isIdentifier(name)) {
            vars.push(name.getText());
          }
        }
      } else if (Node.isArrayBindingPattern(nameNode)) {
        // Array destructuring: const [a, b] = arr
        for (const element of nameNode.getElements()) {
          if (Node.isBindingElement(element)) {
            const name = element.getNameNode();
            if (Node.isIdentifier(name)) {
              vars.push(name.getText());
            }
          }
        }
      }
    }

    // Function parameters
    const functions = [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
    ];

    for (const func of functions) {
      for (const param of func.getParameters()) {
        const nameNode = param.getNameNode();
        if (Node.isIdentifier(nameNode)) {
          vars.push(nameNode.getText());
        }
      }
    }
  } catch {
    // Fallback to regex
    return findDeclaredVariablesRegex(code);
  }

  return vars;
}

/**
 * Regex fallback for findDeclaredVariables
 */
function findDeclaredVariablesRegex(code: string): string[] {
  const vars: string[] = [];
  const patterns = [
    /(?:const|let|var)\s+(\w+)/g,
    /(?:const|let|var)\s+\{([^}]+)\}/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      if (match[1]) {
        const names = match[1]
          .split(",")
          .map((n) => n.trim().split(":")[0]?.trim());
        vars.push(...(names.filter(Boolean) as string[]));
      }
    }
  }

  return vars;
}

/**
 * Find variables that are modified/assigned (AST-based)
 */
function findModifiedVariables(code: string, declaredVars: string[]): string[] {
  const modified = new Set<string>();
  const declaredSet = new Set(declaredVars);

  try {
    const project = createProject();
    const sourceFile = project.createSourceFile("temp.ts", code, {
      overwrite: true,
    });

    // Binary expressions with assignment
    const binaryExpressions = sourceFile.getDescendantsOfKind(
      SyntaxKind.BinaryExpression,
    );

    for (const expr of binaryExpressions) {
      const operator = expr.getOperatorToken().getText();

      // Assignment operators
      if (["=", "+=", "-=", "*=", "/=", "%=", "&&=", "||=", "??="].includes(operator)) {
        const left = expr.getLeft();
        if (Node.isIdentifier(left)) {
          const name = left.getText();
          if (declaredSet.has(name)) {
            modified.add(name);
          }
        }
      }
    }

    // Prefix/postfix increment/decrement
    const prefixUnary = sourceFile.getDescendantsOfKind(
      SyntaxKind.PrefixUnaryExpression,
    );
    const postfixUnary = sourceFile.getDescendantsOfKind(
      SyntaxKind.PostfixUnaryExpression,
    );

    for (const expr of [...prefixUnary, ...postfixUnary]) {
      const operand = expr.getOperand();
      if (Node.isIdentifier(operand)) {
        const name = operand.getText();
        if (declaredSet.has(name)) {
          modified.add(name);
        }
      }
    }
  } catch {
    // Fallback to regex
    for (const v of declaredVars) {
      const assignPattern = new RegExp(`\\b${v}\\s*=(?!=)`, "g");
      if (assignPattern.test(code)) {
        modified.add(v);
      }
    }
  }

  return Array.from(modified);
}

// ============================================================================
// CONDITION MANIPULATION
// ============================================================================

/**
 * Invert a condition for early return (AST-based when possible)
 */
function invertCondition(condition: string): string {
  try {
    const project = createProject();
    const sourceFile = project.createSourceFile(
      "temp.ts",
      `const x = ${condition};`,
      { overwrite: true },
    );

    const varDecl = sourceFile.getVariableDeclarations()[0];
    const init = varDecl?.getInitializer();

    if (!init) {
      return `!(${condition})`;
    }

    // Handle prefix unary (!)
    if (Node.isPrefixUnaryExpression(init)) {
      const operator = init.getOperatorToken();
      if (operator === SyntaxKind.ExclamationToken) {
        return init.getOperand().getText();
      }
    }

    // Handle binary expressions
    if (Node.isBinaryExpression(init)) {
      const operator = init.getOperatorToken().getText();
      const left = init.getLeft().getText();
      const right = init.getRight().getText();

      const inversions: Record<string, string> = {
        "===": "!==",
        "!==": "===",
        "==": "!=",
        "!=": "==",
        ">=": "<",
        "<=": ">",
        ">": "<=",
        "<": ">=",
        "&&": "||",
        "||": "&&",
      };

      if (inversions[operator]) {
        // For && and ||, need to invert both sides (De Morgan's law)
        if (operator === "&&" || operator === "||") {
          return `!(${condition})`;
        }
        return `${left} ${inversions[operator]} ${right}`;
      }
    }

    // Handle parenthesized expression
    if (Node.isParenthesizedExpression(init)) {
      return `!(${condition})`;
    }

    return `!(${condition})`;
  } catch {
    // Fallback to simple string manipulation
    if (condition.startsWith("!") && !condition.startsWith("!=")) {
      return condition.slice(1);
    }

    if (condition.includes("===")) return condition.replace("===", "!==");
    if (condition.includes("!==")) return condition.replace("!==", "===");
    if (condition.includes("==")) return condition.replace("==", "!=");
    if (condition.includes("!=")) return condition.replace("!=", "==");
    if (condition.includes(">=")) return condition.replace(">=", "<");
    if (condition.includes("<=")) return condition.replace("<=", ">");
    if (condition.includes(">")) return condition.replace(">", "<=");
    if (condition.includes("<")) return condition.replace("<", ">=");

    return `!(${condition})`;
  }
}

/**
 * Get function body
 */
function getBody(func: Node): Block | undefined {
  if (
    Node.isFunctionDeclaration(func) ||
    Node.isMethodDeclaration(func) ||
    Node.isFunctionExpression(func)
  ) {
    return func.getBody() as Block | undefined;
  }
  if (Node.isArrowFunction(func)) {
    const body = func.getBody();
    return Node.isBlock(body) ? body : undefined;
  }
  return undefined;
}

/**
 * Group by type (functions, types, constants)
 */
function getGroupByType(node: Node): string {
  if (Node.isTypeAliasDeclaration(node) || Node.isInterfaceDeclaration(node)) {
    return "types";
  }
  if (Node.isFunctionDeclaration(node)) {
    return "functions";
  }
  if (Node.isVariableDeclaration(node)) {
    const init = node.getInitializer();
    if (
      init &&
      (Node.isArrowFunction(init) || Node.isFunctionExpression(init))
    ) {
      return "functions";
    }
    // Check if it's all caps (constant)
    const name = node.getName();
    if (name === name.toUpperCase()) {
      return "constants";
    }
  }
  if (Node.isClassDeclaration(node)) {
    return "classes";
  }
  return "utils";
}

/**
 * Group by prefix
 */
function getGroupByPrefix(name: string): string {
  const prefixes = [
    "handle",
    "create",
    "get",
    "set",
    "is",
    "has",
    "format",
    "parse",
    "validate",
  ];

  for (const prefix of prefixes) {
    if (name.toLowerCase().startsWith(prefix)) {
      return prefix + "s"; // handlers, creators, getters, etc.
    }
  }

  return "utils";
}

/**
 * Check if identifier is a JS keyword
 */
function isKeyword(name: string): boolean {
  const keywords = new Set([
    "break",
    "case",
    "catch",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "finally",
    "for",
    "function",
    "if",
    "in",
    "instanceof",
    "new",
    "return",
    "switch",
    "this",
    "throw",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "class",
    "const",
    "enum",
    "export",
    "extends",
    "import",
    "super",
    "implements",
    "interface",
    "let",
    "package",
    "private",
    "protected",
    "public",
    "static",
    "yield",
    "await",
    "async",
    "true",
    "false",
    "null",
    "undefined",
  ]);
  return keywords.has(name);
}

/**
 * Check if identifier is a global
 */
function isGlobal(name: string): boolean {
  const globals = new Set([
    "console",
    "Math",
    "Date",
    "JSON",
    "Array",
    "Object",
    "String",
    "Number",
    "Boolean",
    "Error",
    "Promise",
    "Map",
    "Set",
    "RegExp",
    "Symbol",
    "Buffer",
    "process",
    "require",
    "module",
    "exports",
    "__dirname",
    "__filename",
    "window",
    "document",
    "global",
    "setTimeout",
    "setInterval",
    "clearTimeout",
    "clearInterval",
    "fetch",
    "URL",
    "URLSearchParams",
  ]);
  return globals.has(name);
}
