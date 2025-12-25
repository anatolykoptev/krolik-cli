/**
 * @module commands/context/parsers/components-swc
 * @description SWC AST-based React component parser
 *
 * Replaces regex-based parser with accurate AST analysis:
 * - Precise JSX element detection
 * - Form field extraction from JSX attributes
 * - Hook detection from CallExpression
 * - No false positives from strings/comments
 *
 * Uses centralized SWC infrastructure from @/lib/@swc
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CallExpression, Identifier, JSXAttrValue, Module, Node } from '@swc/core';
import { getNodeType, parseFile, visitNodeWithCallbacks } from '@/lib/@swc';
import type { ComponentInfo } from './types';

const MAX_IMPORTS = 10;
const MAX_HOOKS = 5;
const MAX_FIELDS = 10;
const BUILT_IN_HOOKS = ['useCallback', 'useEffect', 'useMemo', 'useState', 'useRef'];

/**
 * Parse React component files to extract metadata using SWC AST
 */
export function parseComponents(componentsDir: string, patterns: string[]): ComponentInfo[] {
  const results: ComponentInfo[] = [];

  if (!fs.existsSync(componentsDir)) return results;

  function scanDir(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Recurse into non-hidden directories
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scanDir(fullPath);
        continue;
      }

      // Skip non-tsx files
      if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;

      // Skip files not matching patterns
      if (!matchesPatterns(entry.name, patterns)) continue;

      const info = analyzeComponentSwc(fullPath);
      if (info) results.push(info);
    }
  }

  scanDir(componentsDir);
  return results;
}

/**
 * Analyze a single component file using SWC AST
 */
function analyzeComponentSwc(filePath: string): ComponentInfo | null {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const fileName = path.basename(filePath);
  const componentName = fileName.replace(/\.tsx?$/, '');

  try {
    const { ast } = parseFile(filePath, content);

    // Extract metadata using AST
    const isClient = detectClientComponent(ast, content);
    const purpose = extractPurpose(content);
    const features = extractFeatures(content);
    const imports = extractImportsFromAst(ast);
    const hooks = extractHooksFromAst(ast);
    const fields = extractFormFieldsFromAst(ast);
    const state = detectStateManagementFromAst(ast, content);
    const errorHandling = detectErrorHandlingFromAst(ast, content);

    const result: ComponentInfo = {
      name: componentName,
      file: fileName,
      type: isClient ? 'client' : 'server',
      imports: imports.slice(0, MAX_IMPORTS),
      hooks: hooks.slice(0, MAX_HOOKS),
    };

    if (purpose) result.purpose = purpose;
    if (state) result.state = state;
    if (fields.length > 0) result.fields = fields.slice(0, MAX_FIELDS);
    if (errorHandling) result.errorHandling = errorHandling;
    if (features.length > 0) result.features = features;

    return result;
  } catch {
    // Parse error - skip this file
    return null;
  }
}

/**
 * Detect 'use client' directive
 */
function detectClientComponent(ast: Module, content: string): boolean {
  // Check if first statement is a directive
  if (ast.body.length === 0) return false;

  const firstStmt = ast.body[0];
  if (!firstStmt) return false;

  const nodeType = getNodeType(firstStmt);

  // ExpressionStatement with StringLiteral value
  if (nodeType === 'ExpressionStatement') {
    const expr = (firstStmt as { expression?: Node }).expression;
    if (expr && getNodeType(expr) === 'StringLiteral') {
      const literal = expr as { value?: string };
      if (literal.value === 'use client') {
        return true;
      }
    }
  }

  // Check for directive at the very start of the file (before any imports/code)
  const lines = content.trim().split('\n');
  const firstNonEmptyLine = lines.find((line) => line.trim() !== '')?.trim();
  return (
    firstNonEmptyLine === "'use client';" ||
    firstNonEmptyLine === '"use client";' ||
    firstNonEmptyLine === "'use client'" ||
    firstNonEmptyLine === '"use client"'
  );
}

/**
 * Extract imports from AST (exclude react/next)
 */
function extractImportsFromAst(ast: Module): string[] {
  const imports: string[] = [];

  visitNodeWithCallbacks(ast, {
    onImportDeclaration: (node) => {
      const importDecl = node as {
        source?: { value?: string };
        specifiers?: Array<{ local?: { value?: string }; type?: string }>;
      };

      const source = importDecl.source?.value ?? '';

      // Skip react and next imports
      if (source.includes('react') || source.includes('next')) {
        return;
      }

      // Extract named imports
      if (importDecl.specifiers) {
        for (const spec of importDecl.specifiers) {
          // ImportSpecifier has local.value
          if (spec.type === 'ImportSpecifier' || spec.type === 'ImportDefaultSpecifier') {
            const name = spec.local?.value;
            if (name) {
              imports.push(name);
            }
          }
        }
      }
    },
  });

  return [...new Set(imports)];
}

/**
 * Extract custom hooks from AST
 */
function extractHooksFromAst(ast: Module): string[] {
  const hooks = new Set<string>();

  visitNodeWithCallbacks(ast, {
    onCallExpression: (node) => {
      const call = node as CallExpression;
      const callee = call.callee;

      // Check if callee is an Identifier starting with 'use'
      if (getNodeType(callee) === 'Identifier') {
        const id = callee as Identifier;
        const name = id.value;

        if (name.startsWith('use') && !BUILT_IN_HOOKS.includes(name)) {
          hooks.add(name);
        }
      }
    },
  });

  return Array.from(hooks);
}

/**
 * Extract form fields from AST (JSX attributes + function calls)
 */
function extractFormFieldsFromAst(ast: Module): string[] {
  const fields = new Set<string>();

  // JSX form elements to look for
  const FORM_ELEMENTS = [
    'Input',
    'Select',
    'DatePicker',
    'Textarea',
    'FormField',
    'input',
    'select',
    'textarea',
  ];

  visitNodeWithCallbacks(ast, {
    // Extract from JSX elements
    onJSXOpeningElement: (node) => {
      const opening = node as {
        name?: Node;
        attributes?: Node[];
      };

      if (!opening.name) return;

      // Get element name
      const nameNode = opening.name;
      let elementName = '';

      if (getNodeType(nameNode) === 'Identifier') {
        elementName = (nameNode as Identifier).value;
      } else if (getNodeType(nameNode) === 'JSXMemberExpression') {
        // Handle <Form.Field>
        const memberExpr = nameNode as { property?: { value?: string } };
        elementName = memberExpr.property?.value ?? '';
      }

      // Check if it's a form element or Controller
      const isFormElement = FORM_ELEMENTS.includes(elementName);
      const isController = elementName === 'Controller';

      if (!isFormElement && !isController) return;

      // Extract name/id attributes
      if (opening.attributes) {
        for (const attr of opening.attributes) {
          if (getNodeType(attr) !== 'JSXAttribute') continue;

          const jsxAttr = attr as {
            name?: { value?: string };
            value?: JSXAttrValue;
          };

          const attrName = jsxAttr.name?.value;

          // For form elements, extract name/id
          // For Controller, extract name
          if (
            (isFormElement && (attrName === 'name' || attrName === 'id')) ||
            (isController && attrName === 'name')
          ) {
            // Extract string value
            if (jsxAttr.value) {
              const fieldName = extractJsxAttrValue(jsxAttr.value);
              if (fieldName && fieldName.length > 1) {
                fields.add(fieldName);
              }
            }
          }
        }
      }
    },

    // Extract from register("fieldName") calls
    onCallExpression: (node) => {
      const call = node as CallExpression;
      const callee = call.callee;

      // Check for register() calls
      if (getNodeType(callee) === 'Identifier') {
        const id = callee as Identifier;
        if (id.value === 'register') {
          // Get first argument
          if (call.arguments.length > 0) {
            const firstArg = call.arguments[0];
            if (firstArg && getNodeType(firstArg.expression) === 'StringLiteral') {
              const literal = firstArg.expression as { value?: string };
              const fieldName = literal.value;
              if (fieldName && fieldName.length > 1) {
                fields.add(fieldName);
              }
            }
          }
        }
      }
    },
  });

  return Array.from(fields);
}

/**
 * Extract value from JSX attribute
 */
function extractJsxAttrValue(value: JSXAttrValue): string | null {
  // StringLiteral value
  if (getNodeType(value) === 'StringLiteral') {
    return (value as { value?: string }).value ?? null;
  }

  // JSXExpressionContainer with StringLiteral
  if (getNodeType(value) === 'JSXExpressionContainer') {
    const container = value as { expression?: Node };
    if (container.expression && getNodeType(container.expression) === 'StringLiteral') {
      return (container.expression as { value?: string }).value ?? null;
    }
  }

  return null;
}

/**
 * Detect state management pattern from AST
 */
function detectStateManagementFromAst(ast: Module, content: string): string | undefined {
  let hasUseForm = false;
  let hasUseState = false;
  let hasUseReducer = false;
  let hasZustandCreate = false;

  visitNodeWithCallbacks(ast, {
    onCallExpression: (node) => {
      const call = node as CallExpression;
      const callee = call.callee;

      if (getNodeType(callee) === 'Identifier') {
        const id = callee as Identifier;
        const name = id.value;

        if (name === 'useForm') hasUseForm = true;
        if (name === 'useState') hasUseState = true;
        if (name === 'useReducer') hasUseReducer = true;
        if (name === 'create') hasZustandCreate = true;
      }
    },
  });

  // Check for react-hook-form import
  if (hasUseForm || content.includes('react-hook-form')) {
    return 'react-hook-form';
  }

  if (hasUseState) {
    return 'useState';
  }

  if (hasUseReducer) {
    return 'useReducer';
  }

  // Check for zustand
  if (hasZustandCreate || content.includes('zustand')) {
    return 'zustand';
  }

  return undefined;
}

/**
 * Detect error handling patterns from AST
 */
function detectErrorHandlingFromAst(ast: Module, content: string): string | undefined {
  const patterns: string[] = [];

  let hasTryCatch = false;
  let hasOnError = false;
  let hasToastError = false;
  let hasSetError = false;
  let hasErrorBoundary = false;

  visitNodeWithCallbacks(ast, {
    // Detect try-catch
    onNode: (node) => {
      if (getNodeType(node) === 'TryStatement') {
        hasTryCatch = true;
      }
    },

    // Detect toast.error, setError calls
    onCallExpression: (node) => {
      const call = node as CallExpression;
      const callee = call.callee;

      // toast.error, console.error, etc.
      if (getNodeType(callee) === 'MemberExpression') {
        const member = callee as {
          object?: Node;
          property?: Node;
        };

        if (member.property && getNodeType(member.property) === 'Identifier') {
          const prop = member.property as Identifier;

          if (member.object && getNodeType(member.object) === 'Identifier') {
            const obj = member.object as Identifier;

            if (obj.value === 'toast' && prop.value === 'error') {
              hasToastError = true;
            }
          }
        }
      }

      // setError calls
      if (getNodeType(callee) === 'Identifier') {
        const id = callee as Identifier;
        if (id.value === 'setError') {
          hasSetError = true;
        }
      }
    },

    // Detect onError in JSX
    onJSXAttribute: (node) => {
      const attr = node as { name?: { value?: string } };
      if (attr.name?.value === 'onError') {
        hasOnError = true;
      }
    },

    // Detect ErrorBoundary component
    onJSXOpeningElement: (node) => {
      const opening = node as { name?: Node };
      if (opening.name && getNodeType(opening.name) === 'Identifier') {
        const id = opening.name as Identifier;
        if (id.value === 'ErrorBoundary') {
          hasErrorBoundary = true;
        }
      }
    },
  });

  if (hasTryCatch) patterns.push('try-catch');
  if (hasOnError || content.includes('error:')) patterns.push('callback');
  if (hasToastError || content.includes('showError')) patterns.push('toast');
  if (hasSetError || content.includes('formState.errors')) patterns.push('form-errors');
  if (hasErrorBoundary) patterns.push('boundary');

  if (patterns.length > 0) {
    return patterns.join(', ');
  }

  return undefined;
}

/**
 * Extract purpose from JSDoc comment (regex-based, AST doesn't include comments)
 */
function extractPurpose(content: string): string | undefined {
  const match = content.match(/\/\*\*\s*\n\s*\*\s*(.+)\n/);
  return match?.[1]?.trim();
}

/**
 * Extract @feature annotations (regex-based)
 */
function extractFeatures(content: string): string[] {
  const features: string[] = [];
  const matches = Array.from(content.matchAll(/@feature\s+(.+)/g));
  for (const fm of matches) {
    if (fm[1]) features.push(fm[1].trim());
  }
  return features;
}

/**
 * Check if file matches any pattern
 */
function matchesPatterns(fileName: string, patterns: string[]): boolean {
  const nameLower = fileName.toLowerCase();
  return patterns.some((p) => nameLower.includes(p.toLowerCase()));
}
