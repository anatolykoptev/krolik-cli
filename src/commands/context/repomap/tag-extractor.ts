/**
 * @module commands/context/repomap/tag-extractor
 * @description SWC-based tag extractor for Smart Context / RepoMap system
 *
 * Extracts symbol-level tags (definitions and references) from TypeScript/JavaScript
 * files using SWC for fast AST parsing. Tags include classes, functions, types,
 * interfaces, constants, methods, and exports with their location and export status.
 *
 * @example
 * import { extractFileTags, buildSymbolGraph } from './tag-extractor';
 *
 * // Extract tags from a single file
 * const tags = extractFileTags('src/api.ts', content, projectRoot);
 *
 * // Build a complete symbol graph for analysis
 * const graph = await buildSymbolGraph(projectRoot, { include: ['src'] });
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Node } from '@swc/core';
import { scanDirectorySync } from '@/lib/core/fs';
import { getNodeType, offsetToLine, parseFile, visitNodeWithCallbacks } from '@/lib/parsing/swc';
import type { SymbolGraph, Tag } from './types.js';

/**
 * Options for tag extraction
 */
export interface ExtractorOptions {
  /** Directories to include (relative to projectRoot) */
  include?: string[];
  /** Directories to exclude */
  exclude?: string[];
  /** File extensions to scan */
  extensions?: string[];
}

/**
 * Internal state during AST traversal
 */
interface TraversalState {
  tags: Tag[];
  definedSymbols: Set<string>;
  referencedSymbols: Map<string, number[]>; // symbol name -> line numbers
  lineOffsets: number[];
  baseOffset: number;
  relPath: string;
  isExported: boolean;
  currentClassName: string | null;
}

/**
 * Extract tags from a single file
 *
 * Parses the file using SWC and extracts all symbol definitions and references.
 * Definitions include classes, functions, types, interfaces, constants, methods, and exports.
 * References are tracked for identifiers that reference defined symbols.
 *
 * @param filePath - Absolute path to the file
 * @param content - File content
 * @param projectRoot - Project root directory for relative path calculation
 * @returns Array of tags found in the file
 *
 * @example
 * const content = fs.readFileSync('src/api.ts', 'utf-8');
 * const tags = extractFileTags('src/api.ts', content, '/project');
 * console.log(tags.filter(t => t.kind === 'def'));
 */
export function extractFileTags(filePath: string, content: string, projectRoot: string): Tag[] {
  const relPath = path.relative(projectRoot, filePath);

  try {
    const { ast, lineOffsets, baseOffset } = parseFile(filePath, content);

    const state: TraversalState = {
      tags: [],
      definedSymbols: new Set(),
      referencedSymbols: new Map(),
      lineOffsets,
      baseOffset,
      relPath,
      isExported: false,
      currentClassName: null,
    };

    // First pass: collect definitions
    collectDefinitions(ast, state);

    // Second pass: collect references
    collectReferences(ast, state);

    return state.tags;
  } catch {
    // Parse error - return empty array
    return [];
  }
}

/**
 * Collect symbol definitions from AST
 */
function collectDefinitions(ast: Node, state: TraversalState): void {
  visitNodeWithCallbacks(ast, {
    // Export declarations - mark following nodes as exported
    onExportDeclaration: (node) => {
      state.isExported = true;
      const decl = (node as { declaration?: Node }).declaration;
      if (decl) {
        processDeclaration(decl, state, true);
      }
      state.isExported = false;
    },

    // Function declarations
    onFunctionDeclaration: (node, context) => {
      const funcNode = node as unknown as {
        identifier?: { value: string };
        async?: boolean;
        span?: { start: number; end: number };
      };

      if (funcNode.identifier?.value) {
        const name = funcNode.identifier.value;
        const line = getLineFromSpan(funcNode.span, state);

        addDefinitionTag(state, {
          name,
          type: 'function',
          line,
          endLine: getEndLineFromSpan(funcNode.span, state),
          isExported: context?.isExported ?? state.isExported,
        });
      }
    },

    // Arrow functions assigned to variables are handled in onVariableDeclaration
    onArrowFunctionExpression: () => {
      // Handled via variable declaration
    },

    // Variable declarations (const, let, var)
    onVariableDeclaration: (node, context) => {
      const varNode = node as unknown as {
        kind: string;
        declarations: Array<{
          id?: { type: string; value?: string };
          init?: { type: string };
          span?: { start: number; end: number };
        }>;
        span?: { start: number; end: number };
      };

      if (varNode.kind !== 'const') return;

      for (const decl of varNode.declarations) {
        if (decl.id?.type === 'Identifier' && decl.id.value) {
          const name = decl.id.value;
          const line = getLineFromSpan(decl.span ?? varNode.span, state);
          const initType = decl.init?.type;

          // Determine if it's a function (arrow function or function expression)
          const isFunction =
            initType === 'ArrowFunctionExpression' || initType === 'FunctionExpression';

          addDefinitionTag(state, {
            name,
            type: isFunction ? 'function' : 'const',
            line,
            endLine: getEndLineFromSpan(decl.span ?? varNode.span, state),
            isExported: context?.isExported ?? state.isExported,
          });
        }
      }
    },

    // TypeScript interfaces
    onTsInterfaceDeclaration: (node, context) => {
      const ifaceNode = node as unknown as {
        id?: { value: string };
        span?: { start: number; end: number };
      };

      if (ifaceNode.id?.value) {
        const name = ifaceNode.id.value;
        const line = getLineFromSpan(ifaceNode.span, state);

        addDefinitionTag(state, {
          name,
          type: 'interface',
          line,
          endLine: getEndLineFromSpan(ifaceNode.span, state),
          isExported: context?.isExported ?? state.isExported,
        });
      }
    },

    // TypeScript type aliases
    onTsTypeAliasDeclaration: (node, context) => {
      const typeNode = node as unknown as {
        id?: { value: string };
        span?: { start: number; end: number };
      };

      if (typeNode.id?.value) {
        const name = typeNode.id.value;
        const line = getLineFromSpan(typeNode.span, state);

        addDefinitionTag(state, {
          name,
          type: 'type',
          line,
          endLine: getEndLineFromSpan(typeNode.span, state),
          isExported: context?.isExported ?? state.isExported,
        });
      }
    },

    // Handle any node type for classes and methods
    onNode: (node, context) => {
      const nodeType = getNodeType(node);

      // Class declarations
      if (nodeType === 'ClassDeclaration' || nodeType === 'ClassExpression') {
        const classNode = node as unknown as {
          identifier?: { value: string };
          body: { body?: Node[] };
          span?: { start: number; end: number };
        };

        const name = classNode.identifier?.value;
        if (name) {
          const line = getLineFromSpan(classNode.span, state);

          addDefinitionTag(state, {
            name,
            type: 'class',
            line,
            endLine: getEndLineFromSpan(classNode.span, state),
            isExported: context?.isExported ?? state.isExported,
          });

          // Process class methods
          state.currentClassName = name;
          const members = classNode.body?.body ?? [];
          for (const member of members) {
            processClassMember(member, state);
          }
          state.currentClassName = null;
        }
      }

      // Export default declarations
      if (nodeType === 'ExportDefaultDeclaration') {
        const exportNode = node as unknown as {
          decl?: Node;
          span?: { start: number; end: number };
        };

        if (exportNode.decl) {
          const declType = getNodeType(exportNode.decl);
          const line = getLineFromSpan(exportNode.span, state);

          // Get the name from the declaration if available
          const declWithId = exportNode.decl as unknown as { identifier?: { value: string } };
          const name = declWithId.identifier?.value ?? 'default';

          let type: Tag['type'] = 'export';
          if (declType === 'FunctionDeclaration' || declType === 'FunctionExpression') {
            type = 'function';
          } else if (declType === 'ClassDeclaration' || declType === 'ClassExpression') {
            type = 'class';
          }

          addDefinitionTag(state, {
            name,
            type,
            line,
            isExported: true,
          });
        }
      }

      // Named exports: export { foo, bar }
      if (nodeType === 'ExportNamedDeclaration') {
        const namedExport = node as unknown as {
          specifiers?: Array<{
            type: string;
            orig?: { value: string };
            exported?: { value: string };
          }>;
          span?: { start: number; end: number };
        };

        const line = getLineFromSpan(namedExport.span, state);

        for (const spec of namedExport.specifiers ?? []) {
          if (spec.type === 'ExportSpecifier' && spec.orig?.value) {
            addDefinitionTag(state, {
              name: spec.exported?.value ?? spec.orig.value,
              type: 'export',
              line,
              isExported: true,
            });
          }
        }
      }
    },
  });
}

/**
 * Process a declaration node
 */
function processDeclaration(node: Node, state: TraversalState, isExported: boolean): void {
  const nodeType = getNodeType(node);
  const nodeWithSpan = node as unknown as { span?: { start: number; end: number } };

  if (nodeType === 'FunctionDeclaration') {
    const funcNode = node as unknown as { identifier?: { value: string } };
    if (funcNode.identifier?.value) {
      addDefinitionTag(state, {
        name: funcNode.identifier.value,
        type: 'function',
        line: getLineFromSpan(nodeWithSpan.span, state),
        endLine: getEndLineFromSpan(nodeWithSpan.span, state),
        isExported,
      });
    }
  } else if (nodeType === 'ClassDeclaration') {
    const classNode = node as unknown as { identifier?: { value: string } };
    if (classNode.identifier?.value) {
      addDefinitionTag(state, {
        name: classNode.identifier.value,
        type: 'class',
        line: getLineFromSpan(nodeWithSpan.span, state),
        endLine: getEndLineFromSpan(nodeWithSpan.span, state),
        isExported,
      });
    }
  } else if (nodeType === 'VariableDeclaration') {
    const varNode = node as unknown as {
      kind: string;
      declarations: Array<{
        id?: { type: string; value?: string };
        init?: { type: string };
        span?: { start: number; end: number };
      }>;
    };

    for (const decl of varNode.declarations) {
      if (decl.id?.type === 'Identifier' && decl.id.value) {
        const initType = decl.init?.type;
        const isFunction =
          initType === 'ArrowFunctionExpression' || initType === 'FunctionExpression';

        addDefinitionTag(state, {
          name: decl.id.value,
          type: isFunction ? 'function' : 'const',
          line: getLineFromSpan(decl.span ?? nodeWithSpan.span, state),
          endLine: getEndLineFromSpan(decl.span ?? nodeWithSpan.span, state),
          isExported,
        });
      }
    }
  } else if (nodeType === 'TsInterfaceDeclaration') {
    const ifaceNode = node as unknown as { id?: { value: string } };
    if (ifaceNode.id?.value) {
      addDefinitionTag(state, {
        name: ifaceNode.id.value,
        type: 'interface',
        line: getLineFromSpan(nodeWithSpan.span, state),
        endLine: getEndLineFromSpan(nodeWithSpan.span, state),
        isExported,
      });
    }
  } else if (nodeType === 'TsTypeAliasDeclaration') {
    const typeNode = node as unknown as { id?: { value: string } };
    if (typeNode.id?.value) {
      addDefinitionTag(state, {
        name: typeNode.id.value,
        type: 'type',
        line: getLineFromSpan(nodeWithSpan.span, state),
        endLine: getEndLineFromSpan(nodeWithSpan.span, state),
        isExported,
      });
    }
  }
}

/**
 * Process a class member (method, property)
 */
function processClassMember(node: Node, state: TraversalState): void {
  const nodeType = getNodeType(node);
  const memberNode = node as unknown as {
    key?: { type: string; value?: string };
    span?: { start: number; end: number };
  };

  if (nodeType === 'ClassMethod' || nodeType === 'PrivateMethod') {
    const key = memberNode.key;
    if (key?.type === 'Identifier' && key.value) {
      const name = state.currentClassName ? `${state.currentClassName}.${key.value}` : key.value;

      addDefinitionTag(state, {
        name,
        type: 'method',
        line: getLineFromSpan(memberNode.span, state),
        endLine: getEndLineFromSpan(memberNode.span, state),
        isExported: false, // Methods are not directly exported
      });
    }
  } else if (nodeType === 'ClassProperty' || nodeType === 'PrivateProperty') {
    const key = memberNode.key;
    if (key?.type === 'Identifier' && key.value) {
      const name = state.currentClassName ? `${state.currentClassName}.${key.value}` : key.value;

      addDefinitionTag(state, {
        name,
        type: 'property',
        line: getLineFromSpan(memberNode.span, state),
        isExported: false,
      });
    }
  }
}

/**
 * Collect symbol references from AST
 */
function collectReferences(ast: Node, state: TraversalState): void {
  visitNodeWithCallbacks(ast, {
    onIdentifier: (node) => {
      const identNode = node as unknown as {
        value: string;
        span?: { start: number; end: number };
      };

      const name = identNode.value;

      // Skip if this is a definition (already tracked)
      if (state.definedSymbols.has(name)) {
        // Track reference to defined symbol
        const line = getLineFromSpan(identNode.span, state);
        addReferenceTag(state, name, line);
      }
    },

    // Type references (TypeScript)
    onNode: (node) => {
      const nodeType = getNodeType(node);

      if (nodeType === 'TsTypeReference') {
        const typeRef = node as unknown as {
          typeName?: { type: string; value?: string };
          span?: { start: number; end: number };
        };

        if (typeRef.typeName?.type === 'Identifier' && typeRef.typeName.value) {
          const name = typeRef.typeName.value;
          if (state.definedSymbols.has(name)) {
            const line = getLineFromSpan(typeRef.span, state);
            addReferenceTag(state, name, line);
          }
        }
      }
    },
  });
}

/**
 * Input for creating a definition tag
 */
interface DefinitionTagInput {
  name: string;
  type: Tag['type'];
  line: number;
  endLine?: number | undefined;
  isExported: boolean;
}

/**
 * Add a definition tag to the state
 */
function addDefinitionTag(state: TraversalState, input: DefinitionTagInput): void {
  state.definedSymbols.add(input.name);

  const tag: Tag = {
    relPath: state.relPath,
    kind: 'def',
    name: input.name,
    type: input.type,
    line: input.line,
    isExported: input.isExported,
  };

  // Only add endLine if defined (exactOptionalPropertyTypes compatibility)
  if (input.endLine !== undefined) {
    tag.endLine = input.endLine;
  }

  state.tags.push(tag);
}

/**
 * Add a reference tag to the state
 */
function addReferenceTag(state: TraversalState, name: string, line: number): void {
  // Avoid duplicate references on the same line
  const existing = state.referencedSymbols.get(name) ?? [];
  if (existing.includes(line)) return;

  existing.push(line);
  state.referencedSymbols.set(name, existing);

  // Find the definition to get the type
  const defTag = state.tags.find((t) => t.kind === 'def' && t.name === name);

  const tag: Tag = {
    relPath: state.relPath,
    name,
    kind: 'ref',
    line,
    type: defTag?.type ?? 'const',
  };

  // Only add isExported if defined (exactOptionalPropertyTypes compatibility)
  if (defTag?.isExported !== undefined) {
    tag.isExported = defTag.isExported;
  }

  state.tags.push(tag);
}

/**
 * Get line number from span
 */
function getLineFromSpan(
  span: { start: number; end: number } | undefined,
  state: TraversalState,
): number {
  if (!span) return 1;
  // Normalize span offset and convert to line number
  const normalizedOffset = span.start - state.baseOffset;
  return offsetToLine(normalizedOffset, state.lineOffsets);
}

/**
 * Get end line number from span
 */
function getEndLineFromSpan(
  span: { start: number; end: number } | undefined,
  state: TraversalState,
): number | undefined {
  if (!span) return undefined;
  const normalizedOffset = span.end - state.baseOffset;
  const endLine = offsetToLine(normalizedOffset, state.lineOffsets);
  const startLine = getLineFromSpan(span, state);
  // Only return endLine if it's different from startLine (multi-line definition)
  return endLine > startLine ? endLine : undefined;
}

/**
 * Build a complete symbol graph from all files in a directory
 *
 * Scans all TypeScript/JavaScript files in the specified directory,
 * extracts tags from each file, and builds a comprehensive symbol graph
 * with definition and reference maps.
 *
 * @param projectRoot - Project root directory
 * @param options - Extraction options
 * @returns Symbol graph with all tags and relationship maps
 *
 * @example
 * const graph = await buildSymbolGraph('/project', {
 *   include: ['src'],
 *   exclude: ['node_modules', 'dist'],
 * });
 *
 * console.log(`Found ${graph.tags.length} tags in ${graph.filesScanned} files`);
 * console.log(`Definitions: ${graph.definitions.size}`);
 * console.log(`References: ${graph.references.size}`);
 */
export async function buildSymbolGraph(
  projectRoot: string,
  options: ExtractorOptions = {},
): Promise<SymbolGraph> {
  const startTime = Date.now();

  const {
    include = ['src'],
    exclude = ['node_modules', 'dist', '.git', '.next', 'coverage'],
    extensions = ['.ts', '.tsx', '.js', '.jsx'],
  } = options;

  // Collect all files to scan
  const filesToScan: string[] = [];

  for (const includeDir of include) {
    const scanDir = path.join(projectRoot, includeDir);
    if (!fs.existsSync(scanDir)) continue;

    const files = scanDirectorySync(scanDir, {
      extensions,
      skipDirs: exclude,
      includeTests: false,
    });

    filesToScan.push(...files);
  }

  // Extract tags from all files
  const allTags: Tag[] = [];
  const definitions = new Map<string, string[]>();
  const references = new Map<string, string[]>();
  const fileToTags = new Map<string, Tag[]>();

  for (const filePath of filesToScan) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const tags = extractFileTags(filePath, content, projectRoot);
    const relPath = path.relative(projectRoot, filePath);

    // Store tags for this file
    fileToTags.set(relPath, tags);
    allTags.push(...tags);

    // Build definition and reference maps
    for (const tag of tags) {
      if (tag.kind === 'def') {
        const files = definitions.get(tag.name) ?? [];
        if (!files.includes(tag.relPath)) {
          files.push(tag.relPath);
          definitions.set(tag.name, files);
        }
      } else if (tag.kind === 'ref') {
        const files = references.get(tag.name) ?? [];
        if (!files.includes(tag.relPath)) {
          files.push(tag.relPath);
          references.set(tag.name, files);
        }
      }
    }
  }

  const scanDurationMs = Date.now() - startTime;

  return {
    tags: allTags,
    definitions,
    references,
    fileToTags,
    filesScanned: filesToScan.length,
    scanDurationMs,
  };
}

/**
 * Extract tags synchronously from all files in a directory
 *
 * Convenience wrapper around buildSymbolGraph for synchronous usage.
 *
 * @param projectRoot - Project root directory
 * @param options - Extraction options
 * @returns Symbol graph
 */
export function buildSymbolGraphSync(
  projectRoot: string,
  options: ExtractorOptions = {},
): SymbolGraph {
  const startTime = Date.now();

  const {
    include = ['src'],
    exclude = ['node_modules', 'dist', '.git', '.next', 'coverage'],
    extensions = ['.ts', '.tsx', '.js', '.jsx'],
  } = options;

  // Collect all files to scan
  const filesToScan: string[] = [];

  for (const includeDir of include) {
    const scanDir = path.join(projectRoot, includeDir);
    if (!fs.existsSync(scanDir)) continue;

    const files = scanDirectorySync(scanDir, {
      extensions,
      skipDirs: exclude,
      includeTests: false,
    });

    filesToScan.push(...files);
  }

  // Extract tags from all files
  const allTags: Tag[] = [];
  const definitions = new Map<string, string[]>();
  const references = new Map<string, string[]>();
  const fileToTags = new Map<string, Tag[]>();

  for (const filePath of filesToScan) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const tags = extractFileTags(filePath, content, projectRoot);
    const relPath = path.relative(projectRoot, filePath);

    // Store tags for this file
    fileToTags.set(relPath, tags);
    allTags.push(...tags);

    // Build definition and reference maps
    for (const tag of tags) {
      if (tag.kind === 'def') {
        const files = definitions.get(tag.name) ?? [];
        if (!files.includes(tag.relPath)) {
          files.push(tag.relPath);
          definitions.set(tag.name, files);
        }
      } else if (tag.kind === 'ref') {
        const files = references.get(tag.name) ?? [];
        if (!files.includes(tag.relPath)) {
          files.push(tag.relPath);
          references.set(tag.name, files);
        }
      }
    }
  }

  const scanDurationMs = Date.now() - startTime;

  return {
    tags: allTags,
    definitions,
    references,
    fileToTags,
    filesScanned: filesToScan.length,
    scanDurationMs,
  };
}

/**
 * Get exported symbols from a file
 *
 * Convenience function to extract only exported definitions.
 *
 * @param filePath - Absolute path to the file
 * @param content - File content
 * @param projectRoot - Project root directory
 * @returns Array of exported definition tags
 */
export function getExportedSymbols(filePath: string, content: string, projectRoot: string): Tag[] {
  const tags = extractFileTags(filePath, content, projectRoot);
  return tags.filter((tag) => tag.kind === 'def' && tag.isExported === true);
}

/**
 * Get file signatures (one-line summaries of definitions)
 *
 * Extracts all definitions from a file and returns them as one-line signatures.
 *
 * @param filePath - Absolute path to the file
 * @param content - File content
 * @param projectRoot - Project root directory
 * @returns Array of signature strings
 */
export function getFileSignatures(
  filePath: string,
  content: string,
  projectRoot: string,
): string[] {
  const tags = extractFileTags(filePath, content, projectRoot);
  const definitions = tags.filter((tag) => tag.kind === 'def');

  const lines = content.split('\n');

  return definitions.map((def) => {
    const lineContent = lines[def.line - 1] ?? '';
    return lineContent.trim();
  });
}
