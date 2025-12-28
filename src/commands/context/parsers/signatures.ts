/**
 * @module commands/context/parsers/signatures
 * @description Extracts function/class/type signatures without their bodies for Smart Context
 *
 * Uses SWC AST for fast and accurate signature extraction.
 * Based on Aider's RepoMap approach - shows only signatures for code context.
 *
 * @example
 * const signatures = extractSignatures('src/utils.ts', sourceCode);
 * console.log(formatSignaturesForFile('src/utils.ts', signatures));
 * // src/utils.ts:
 * // ⋮...
 * // │export function parseDate(str: string): Date
 * // ⋮...
 * // │export function formatDate(date: Date, format: string): string
 */

import * as fs from 'node:fs';
import type {
  ClassDeclaration,
  ClassMember,
  ClassMethod,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Module,
  ModuleItem,
  Node,
  TsInterfaceDeclaration,
  TsTypeAliasDeclaration,
  VariableDeclaration,
  VariableDeclarator,
} from '@swc/core';
import {
  isArrowFunction,
  isClassDeclaration,
  isClassMethod,
  isExportDeclaration,
  isExportDefaultDeclaration,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isTsInterface,
  isTsTypeAlias,
  isVariableDeclaration,
} from '@/lib/analysis/guards';
import { parseFile as swcParseFile } from '@/lib/parsing/swc';
import type { Signature } from '../repomap/types';

// ============================================================================
// OPTIONS
// ============================================================================

export interface SignatureOptions {
  /** Include private methods (those starting with #) */
  includePrivate?: boolean;
  /** Include internal symbols (those starting with _) */
  includeInternal?: boolean;
  /** Maximum signature length before truncation */
  maxLength?: number;
}

const DEFAULT_OPTIONS: Required<SignatureOptions> = {
  includePrivate: false,
  includeInternal: false,
  maxLength: 200,
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Extract all signatures from a file
 *
 * @param filePath - Path to the TypeScript/JavaScript file
 * @param content - Optional file content (will read from disk if not provided)
 * @param options - Extraction options
 * @returns Array of Signature objects
 *
 * @example
 * const signatures = extractSignatures('src/lib/utils.ts');
 * for (const sig of signatures) {
 *   console.log(`${sig.type}: ${sig.name} at line ${sig.line}`);
 * }
 */
export function extractSignatures(
  filePath: string,
  content?: string,
  options: SignatureOptions = {},
): Signature[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sourceContent = content ?? readFileSafe(filePath);
  if (!sourceContent) return [];

  try {
    const { ast, lineOffsets, baseOffset } = swcParseFile(filePath, sourceContent);
    return extractFromModule(ast, sourceContent, lineOffsets, baseOffset, filePath, opts);
  } catch {
    return [];
  }
}

/**
 * Extract signatures from multiple files
 *
 * @param files - Array of file paths
 * @param options - Extraction options
 * @returns Map of file path to signatures
 */
export function extractSignaturesFromFiles(
  files: string[],
  options: SignatureOptions = {},
): Map<string, Signature[]> {
  const result = new Map<string, Signature[]>();

  for (const filePath of files) {
    const signatures = extractSignatures(filePath, undefined, options);
    if (signatures.length > 0) {
      result.set(filePath, signatures);
    }
  }

  return result;
}

/**
 * Format signatures for a file in Aider-style repo map format
 *
 * @param filePath - File path to display
 * @param signatures - Signatures to format
 * @returns Formatted string
 *
 * @example
 * const output = formatSignaturesForFile('src/utils.ts', signatures);
 * // src/utils.ts:
 * // ⋮...
 * // │export function parseDate(str: string): Date
 */
export function formatSignaturesForFile(filePath: string, signatures: Signature[]): string {
  if (signatures.length === 0) return '';

  const lines: string[] = [`${filePath}:`];

  for (const sig of signatures) {
    lines.push('⋮...');
    lines.push(`│${sig.text}`);
  }

  return lines.join('\n');
}

/**
 * Format signatures for multiple files
 *
 * @param signaturesMap - Map of file path to signatures
 * @returns Formatted string with all files
 */
export function formatSignaturesMap(signaturesMap: Map<string, Signature[]>): string {
  const sections: string[] = [];

  for (const [filePath, signatures] of signaturesMap) {
    const formatted = formatSignaturesForFile(filePath, signatures);
    if (formatted) {
      sections.push(formatted);
    }
  }

  return sections.join('\n\n');
}

// ============================================================================
// EXTRACTION LOGIC
// ============================================================================

function extractFromModule(
  ast: Module,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
  filePath: string,
  opts: Required<SignatureOptions>,
): Signature[] {
  const signatures: Signature[] = [];

  for (const item of ast.body) {
    const extracted = extractFromModuleItem(item, content, lineOffsets, baseOffset, filePath, opts);
    signatures.push(...extracted);
  }

  return signatures;
}

function extractFromModuleItem(
  item: ModuleItem,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
  filePath: string,
  opts: Required<SignatureOptions>,
): Signature[] {
  // Handle export declarations
  if (isExportDeclaration(item)) {
    const decl = item.declaration as Node;
    return extractFromDeclaration(decl, content, lineOffsets, baseOffset, filePath, true, opts);
  }

  if (isExportDefaultDeclaration(item)) {
    const decl = item.decl as Node;
    return extractFromDeclaration(decl, content, lineOffsets, baseOffset, filePath, true, opts);
  }

  // Handle non-exported declarations (skip if we only want exported)
  // For now, we extract all top-level declarations
  if (isFunctionDeclaration(item)) {
    return extractFromDeclaration(item, content, lineOffsets, baseOffset, filePath, false, opts);
  }

  if (isClassDeclaration(item)) {
    return extractFromDeclaration(item, content, lineOffsets, baseOffset, filePath, false, opts);
  }

  if (isVariableDeclaration(item)) {
    return extractFromDeclaration(item, content, lineOffsets, baseOffset, filePath, false, opts);
  }

  if (isTsTypeAlias(item)) {
    return extractFromDeclaration(item, content, lineOffsets, baseOffset, filePath, false, opts);
  }

  if (isTsInterface(item)) {
    return extractFromDeclaration(item, content, lineOffsets, baseOffset, filePath, false, opts);
  }

  return [];
}

function extractFromDeclaration(
  node: Node,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
  filePath: string,
  isExported: boolean,
  opts: Required<SignatureOptions>,
): Signature[] {
  // Function declaration
  if (isFunctionDeclaration(node)) {
    const sig = extractFunctionSignature(
      node,
      content,
      lineOffsets,
      baseOffset,
      filePath,
      isExported,
      opts,
    );
    return sig ? [sig] : [];
  }

  // Function expression (for default exports)
  if (isFunctionExpression(node)) {
    const sig = extractFunctionExprSignature(
      node,
      content,
      lineOffsets,
      baseOffset,
      filePath,
      isExported,
      opts,
    );
    return sig ? [sig] : [];
  }

  // Class declaration
  if (isClassDeclaration(node)) {
    return extractClassSignatures(
      node,
      content,
      lineOffsets,
      baseOffset,
      filePath,
      isExported,
      opts,
    );
  }

  // Variable declaration (const/let/var)
  if (isVariableDeclaration(node)) {
    return extractVariableSignatures(
      node,
      content,
      lineOffsets,
      baseOffset,
      filePath,
      isExported,
      opts,
    );
  }

  // Type alias
  if (isTsTypeAlias(node)) {
    const sig = extractTypeAliasSignature(
      node,
      content,
      lineOffsets,
      baseOffset,
      filePath,
      isExported,
      opts,
    );
    return sig ? [sig] : [];
  }

  // Interface declaration
  if (isTsInterface(node)) {
    const sig = extractInterfaceSignature(
      node,
      content,
      lineOffsets,
      baseOffset,
      filePath,
      isExported,
      opts,
    );
    return sig ? [sig] : [];
  }

  return [];
}

// ============================================================================
// FUNCTION SIGNATURES
// ============================================================================

function extractFunctionSignature(
  func: FunctionDeclaration,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
  filePath: string,
  isExported: boolean,
  opts: Required<SignatureOptions>,
): Signature | null {
  const name = func.identifier?.value;
  if (!name) return null;
  if (!opts.includeInternal && name.startsWith('_')) return null;

  const span = getNodeSpan(func);
  if (!span) return null;

  const line = offsetToLine(span.start - baseOffset, lineOffsets);
  const text = extractSignatureText(
    content,
    span.start - baseOffset,
    span.end - baseOffset,
    opts.maxLength,
  );

  return {
    file: filePath,
    line,
    text: formatFunctionSignature(text, isExported),
    type: 'function',
    name,
    isExported,
  };
}

function extractFunctionExprSignature(
  func: FunctionExpression,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
  filePath: string,
  isExported: boolean,
  opts: Required<SignatureOptions>,
): Signature | null {
  const name = func.identifier?.value ?? 'default';

  const span = getNodeSpan(func);
  if (!span) return null;

  const line = offsetToLine(span.start - baseOffset, lineOffsets);
  const text = extractSignatureText(
    content,
    span.start - baseOffset,
    span.end - baseOffset,
    opts.maxLength,
  );

  return {
    file: filePath,
    line,
    text: formatFunctionSignature(text, isExported),
    type: 'function',
    name,
    isExported,
  };
}

// ============================================================================
// CLASS SIGNATURES
// ============================================================================

function extractClassSignatures(
  cls: ClassDeclaration,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
  filePath: string,
  isExported: boolean,
  opts: Required<SignatureOptions>,
): Signature[] {
  const signatures: Signature[] = [];

  const className = cls.identifier?.value;
  if (!className) return signatures;
  if (!opts.includeInternal && className.startsWith('_')) return signatures;

  // Extract class signature
  const span = getNodeSpan(cls);
  if (span) {
    const line = offsetToLine(span.start - baseOffset, lineOffsets);
    const text = extractClassDeclarationLine(content, span.start - baseOffset, opts.maxLength);

    signatures.push({
      file: filePath,
      line,
      text: formatClassSignature(text, isExported, cls),
      type: 'class',
      name: className,
      isExported,
    });
  }

  // Extract method signatures
  const methods = extractMethodSignatures(
    cls.body ?? [],
    content,
    lineOffsets,
    baseOffset,
    filePath,
    opts,
  );
  signatures.push(...methods);

  return signatures;
}

function extractMethodSignatures(
  body: ClassMember[],
  content: string,
  lineOffsets: number[],
  baseOffset: number,
  filePath: string,
  opts: Required<SignatureOptions>,
): Signature[] {
  const signatures: Signature[] = [];

  for (const member of body) {
    if (!isClassMethod(member)) continue;

    const method = member as ClassMethod;
    if (!isIdentifier(method.key)) continue;

    const name = method.key.value;
    if (!opts.includePrivate && name.startsWith('#')) continue;
    if (!opts.includeInternal && name.startsWith('_')) continue;

    const span = getNodeSpan(method);
    if (!span) continue;

    const line = offsetToLine(span.start - baseOffset, lineOffsets);
    const text = extractSignatureText(
      content,
      span.start - baseOffset,
      span.end - baseOffset,
      opts.maxLength,
    );

    signatures.push({
      file: filePath,
      line,
      text: formatMethodSignature(text, method),
      type: 'method',
      name,
      isExported: false, // Methods inherit export from class
    });
  }

  return signatures;
}

// ============================================================================
// VARIABLE SIGNATURES (const/let with type annotations or arrow functions)
// ============================================================================

function extractVariableSignatures(
  varDecl: VariableDeclaration,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
  filePath: string,
  isExported: boolean,
  opts: Required<SignatureOptions>,
): Signature[] {
  const signatures: Signature[] = [];

  for (const declarator of varDecl.declarations as VariableDeclarator[]) {
    const sig = extractDeclaratorSignature(
      declarator,
      varDecl.kind,
      content,
      lineOffsets,
      baseOffset,
      filePath,
      isExported,
      opts,
    );
    if (sig) signatures.push(sig);
  }

  return signatures;
}

function extractDeclaratorSignature(
  declarator: VariableDeclarator,
  kind: 'const' | 'let' | 'var',
  content: string,
  lineOffsets: number[],
  baseOffset: number,
  filePath: string,
  isExported: boolean,
  opts: Required<SignatureOptions>,
): Signature | null {
  if (!isIdentifier(declarator.id)) return null;

  const name = declarator.id.value;
  if (!opts.includeInternal && name.startsWith('_')) return null;

  const init = declarator.init;
  const hasTypeAnnotation = !!(declarator.id as unknown as { typeAnnotation?: unknown })
    .typeAnnotation;

  // Arrow function or function expression
  if (init && (isArrowFunction(init) || isFunctionExpression(init))) {
    const span = getNodeSpan(declarator);
    if (!span) return null;

    const line = offsetToLine(span.start - baseOffset, lineOffsets);
    const text = extractSignatureText(
      content,
      span.start - baseOffset,
      span.end - baseOffset,
      opts.maxLength,
    );

    return {
      file: filePath,
      line,
      text: formatConstFunctionSignature(text, kind, isExported),
      type: 'function',
      name,
      isExported,
    };
  }

  // Const with type annotation (e.g., export const config: Config = {...})
  if (hasTypeAnnotation) {
    const span = getNodeSpan(declarator);
    if (!span) return null;

    const line = offsetToLine(span.start - baseOffset, lineOffsets);
    const text = extractConstWithTypeSignature(
      content,
      span.start - baseOffset,
      span.end - baseOffset,
      opts.maxLength,
    );

    return {
      file: filePath,
      line,
      text: formatConstSignature(text, kind, isExported),
      type: 'const',
      name,
      isExported,
    };
  }

  return null;
}

// ============================================================================
// TYPE ALIAS SIGNATURES
// ============================================================================

function extractTypeAliasSignature(
  node: Node,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
  filePath: string,
  isExported: boolean,
  opts: Required<SignatureOptions>,
): Signature | null {
  const typeAlias = node as TsTypeAliasDeclaration;
  const name = typeAlias.id?.value;
  if (!name) return null;
  if (!opts.includeInternal && name.startsWith('_')) return null;

  const span = getNodeSpan(node);
  if (!span) return null;

  const line = offsetToLine(span.start - baseOffset, lineOffsets);
  const text = extractFirstLine(content, span.start - baseOffset, opts.maxLength);

  return {
    file: filePath,
    line,
    text: formatTypeSignature(text, isExported),
    type: 'type',
    name,
    isExported,
  };
}

// ============================================================================
// INTERFACE SIGNATURES
// ============================================================================

function extractInterfaceSignature(
  node: Node,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
  filePath: string,
  isExported: boolean,
  opts: Required<SignatureOptions>,
): Signature | null {
  const iface = node as TsInterfaceDeclaration;
  const name = iface.id?.value;
  if (!name) return null;
  if (!opts.includeInternal && name.startsWith('_')) return null;

  const span = getNodeSpan(node);
  if (!span) return null;

  const line = offsetToLine(span.start - baseOffset, lineOffsets);
  const text = extractInterfaceDeclarationLine(content, span.start - baseOffset, opts.maxLength);

  return {
    file: filePath,
    line,
    text: formatInterfaceSignature(text, isExported, iface),
    type: 'interface',
    name,
    isExported,
  };
}

// ============================================================================
// TEXT EXTRACTION HELPERS
// ============================================================================

/**
 * Extract signature text from AST node
 * Returns only the first line (signature) without the body
 */
function extractSignatureText(
  content: string,
  startOffset: number,
  endOffset: number,
  maxLength: number,
): string {
  // SWC offsets are 1-based, convert to 0-based
  const start = startOffset - 1;
  const end = endOffset - 1;

  if (start < 0 || end > content.length || start >= end) {
    return '';
  }

  const nodeText = content.slice(start, end);

  // Find the signature part (up to first { or end of first line)
  const openBraceIndex = findSignatureEnd(nodeText);
  let signatureText = nodeText.slice(0, openBraceIndex).trim();

  // Handle multi-line parameters - collapse to single line
  signatureText = signatureText.replace(/\s+/g, ' ');

  // Truncate if too long
  if (signatureText.length > maxLength) {
    signatureText = `${signatureText.slice(0, maxLength - 3)}...`;
  }

  return signatureText;
}

/** Bracket depth change for each character */
const BRACKET_DELTAS: Record<string, [number, number]> = {
  '(': [1, 0],
  ')': [-1, 0],
  '<': [0, 1],
  '>': [0, -1],
};

/**
 * Find the end of the signature (before the body)
 * Returns the index of the opening brace or arrow function body
 */
function findSignatureEnd(text: string): number {
  let parenDepth = 0;
  let angleDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Update bracket depth
    const delta = BRACKET_DELTAS[char];
    if (delta) {
      parenDepth += delta[0];
      angleDepth += delta[1];
      continue;
    }

    // Only check for body start at top level
    if (parenDepth !== 0 || angleDepth !== 0) continue;

    // Check for body start
    const bodyStart = findBodyStartAt(text, i, char);
    if (bodyStart !== -1) return bodyStart;
  }

  return text.length;
}

/**
 * Check if current position is the start of a function body
 */
function findBodyStartAt(text: string, index: number, char: string): number {
  // Opening brace - function body starts
  if (char === '{') return index;

  // Arrow function (=> sequence)
  if (char === '=' && text[index + 1] === '>') {
    const afterArrow = text.slice(index + 2).trimStart();
    if (afterArrow.startsWith('{')) {
      return text.indexOf('{', index);
    }
    // Expression body - include the whole thing
    return text.length;
  }

  return -1;
}

/**
 * Extract the first line only (for type aliases)
 */
function extractFirstLine(content: string, startOffset: number, maxLength: number): string {
  const start = startOffset - 1;
  if (start < 0 || start >= content.length) return '';

  let endIndex = content.indexOf('\n', start);
  if (endIndex === -1) endIndex = content.length;

  let line = content.slice(start, endIndex).trim();

  if (line.length > maxLength) {
    line = `${line.slice(0, maxLength - 3)}...`;
  }

  return line;
}

/**
 * Extract class declaration line (up to first {)
 */
function extractClassDeclarationLine(
  content: string,
  startOffset: number,
  maxLength: number,
): string {
  const start = startOffset - 1;
  if (start < 0 || start >= content.length) return '';

  let braceIndex = content.indexOf('{', start);
  if (braceIndex === -1) braceIndex = content.length;

  let text = content.slice(start, braceIndex).trim();
  text = text.replace(/\s+/g, ' ');

  if (text.length > maxLength) {
    text = `${text.slice(0, maxLength - 3)}...`;
  }

  return text;
}

/**
 * Extract interface declaration line (up to first {)
 */
function extractInterfaceDeclarationLine(
  content: string,
  startOffset: number,
  maxLength: number,
): string {
  return extractClassDeclarationLine(content, startOffset, maxLength);
}

/**
 * Extract const with type annotation (up to =)
 */
function extractConstWithTypeSignature(
  content: string,
  startOffset: number,
  endOffset: number,
  maxLength: number,
): string {
  const start = startOffset - 1;
  if (start < 0) return '';

  const text = content.slice(start, endOffset - 1);

  // Find = sign (end of signature)
  const eqIndex = text.indexOf('=');
  if (eqIndex === -1) return extractFirstLine(content, startOffset, maxLength);

  let signature = text.slice(0, eqIndex).trim();
  signature = signature.replace(/\s+/g, ' ');

  if (signature.length > maxLength) {
    signature = `${signature.slice(0, maxLength - 3)}...`;
  }

  return signature;
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function formatFunctionSignature(text: string, isExported: boolean): string {
  // Clean up and ensure it starts with function keyword
  let signature = text.trim();

  // Add export prefix if needed and not already present
  if (isExported && !signature.startsWith('export')) {
    signature = `export ${signature}`;
  }

  return signature;
}

function formatClassSignature(text: string, isExported: boolean, cls: ClassDeclaration): string {
  let signature = text.trim();

  // Build signature if text extraction failed
  if (!signature.includes('class')) {
    const name = cls.identifier?.value ?? 'Anonymous';
    const superClass = cls.superClass ? extractSuperClassName(cls.superClass) : null;
    const impl = cls.implements?.map((i) => extractImplementsName(i)).filter(Boolean);

    signature = `class ${name}`;
    if (superClass) signature += ` extends ${superClass}`;
    if (impl && impl.length > 0) signature += ` implements ${impl.join(', ')}`;
  }

  if (isExported && !signature.startsWith('export')) {
    signature = `export ${signature}`;
  }

  return signature;
}

function formatMethodSignature(text: string, method: ClassMethod): string {
  let signature = text.trim();

  // Build minimal signature if needed
  if (!signature) {
    const name = isIdentifier(method.key) ? method.key.value : 'method';
    const isAsync = method.function?.async ? 'async ' : '';
    const isStatic = method.isStatic ? 'static ' : '';
    signature = `${isStatic}${isAsync}${name}()`;
  }

  return signature;
}

function formatConstFunctionSignature(text: string, kind: string, isExported: boolean): string {
  let signature = text.trim();

  // Ensure it starts with const/let
  if (
    !signature.startsWith('const') &&
    !signature.startsWith('let') &&
    !signature.startsWith('var')
  ) {
    signature = `${kind} ${signature}`;
  }

  if (isExported && !signature.startsWith('export')) {
    signature = `export ${signature}`;
  }

  return signature;
}

function formatConstSignature(text: string, kind: string, isExported: boolean): string {
  return formatConstFunctionSignature(text, kind, isExported);
}

function formatTypeSignature(text: string, isExported: boolean): string {
  let signature = text.trim();

  if (isExported && !signature.startsWith('export')) {
    signature = `export ${signature}`;
  }

  return signature;
}

function formatInterfaceSignature(
  text: string,
  isExported: boolean,
  iface: TsInterfaceDeclaration,
): string {
  let signature = text.trim();

  // Build signature if text extraction failed
  if (!signature.includes('interface')) {
    const name = iface.id?.value ?? 'Anonymous';
    const ext = iface.extends?.map((e) => extractExtendsName(e)).filter(Boolean);

    signature = `interface ${name}`;
    if (ext && ext.length > 0) signature += ` extends ${ext.join(', ')}`;
  }

  if (isExported && !signature.startsWith('export')) {
    signature = `export ${signature}`;
  }

  return signature;
}

// ============================================================================
// AST HELPERS
// ============================================================================

function getNodeSpan(node: Node): { start: number; end: number } | null {
  const span = (node as { span?: { start: number; end: number } }).span;
  return span ?? null;
}

function offsetToLine(offset: number, lineOffsets: number[]): number {
  // Convert 1-based offset to 0-based
  const zeroBasedOffset = offset - 1;

  // Binary search for the line
  let low = 0;
  let high = lineOffsets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const currentOffset = lineOffsets[mid] ?? 0;
    const nextOffset = lineOffsets[mid + 1] ?? Number.MAX_SAFE_INTEGER;

    if (zeroBasedOffset >= currentOffset && zeroBasedOffset < nextOffset) {
      return mid + 1; // 1-based line numbers
    }

    if (zeroBasedOffset < currentOffset) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return 1;
}

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function extractSuperClassName(superClass: Node): string | null {
  if (isIdentifier(superClass)) {
    return (superClass as Identifier).value;
  }
  return null;
}

function extractImplementsName(impl: unknown): string | null {
  const expr = (impl as { expression?: Node }).expression;
  if (expr && isIdentifier(expr)) {
    return (expr as Identifier).value;
  }
  return null;
}

function extractExtendsName(ext: unknown): string | null {
  const expr = (ext as { expression?: Node }).expression;
  if (expr && isIdentifier(expr)) {
    return (expr as Identifier).value;
  }
  return null;
}
