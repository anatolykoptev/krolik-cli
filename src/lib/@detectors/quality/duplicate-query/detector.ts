/**
 * @module lib/@detectors/quality/duplicate-query/detector
 * @description SWC AST detector for duplicate Prisma/tRPC queries
 *
 * Detects:
 * - Duplicate Prisma findMany/findUnique/etc. calls
 * - Duplicate tRPC useQuery/useMutation hooks
 * - Similar query structures that could be consolidated
 */

import type { CallExpression, MemberExpression, Node, Span } from '@swc/core';
import type {
  PrismaOperationType,
  QueryDetection,
  QueryDetectorContext,
  TrpcHookType,
} from '../../patterns/ast/types';
import {
  generatePrismaFingerprint,
  generateTrpcFingerprint,
  normalizeQueryStructure,
  normalizeTrpcInput,
} from './normalizer';
import {
  ALL_PRISMA_OPERATIONS,
  ALL_TRPC_HOOKS,
  PRISMA_CLIENT_IDENTIFIERS,
  TRPC_CLIENT_IDENTIFIERS,
} from './patterns';
import type { PrismaOperation, TrpcHook } from './types';

// ============================================================================
// MAIN DETECTOR
// ============================================================================

/**
 * Detect Prisma or tRPC query from AST node
 *
 * @param node - SWC AST node
 * @param content - File content for context extraction
 * @param context - Current detector context
 * @returns Detection result or null if not a query
 */
export function detectQuery(
  node: Node,
  content: string,
  context: QueryDetectorContext,
): QueryDetection | null {
  const nodeType = (node as { type?: string }).type;

  if (nodeType !== 'CallExpression') {
    return null;
  }

  const callExpr = node as CallExpression;

  // Try to detect Prisma query
  const prismaResult = detectPrismaQuery(callExpr, content, context);
  if (prismaResult) {
    return prismaResult;
  }

  // Try to detect tRPC query hook
  const trpcResult = detectTrpcQuery(callExpr, content, context);
  if (trpcResult) {
    return trpcResult;
  }

  return null;
}

// ============================================================================
// PRISMA DETECTION
// ============================================================================

/**
 * Detect Prisma query call
 *
 * @example
 * ```ts
 * ctx.db.user.findMany({ where: { ... } })
 * prisma.booking.findUnique({ where: { id } })
 * ```
 */
function detectPrismaQuery(
  callExpr: CallExpression,
  _content: string,
  context: QueryDetectorContext,
): QueryDetection | null {
  const callee = callExpr.callee;

  // Must be a member expression (e.g., ctx.db.user.findMany)
  if (callee.type !== 'MemberExpression') {
    return null;
  }

  // Extract the call chain
  const chain = extractMemberChain(callee as MemberExpression);
  if (chain.length < 3) {
    return null; // Need at least: client.model.operation
  }

  // Check if this is a Prisma client call
  const clientMatch = findPrismaClient(chain);
  if (clientMatch === null) {
    return null;
  }

  const { clientEndIndex } = clientMatch;

  // Extract model and operation from chain
  // After client (e.g., ctx.db), we expect: model.operation
  if (chain.length <= clientEndIndex + 2) {
    return null;
  }

  const model = chain[clientEndIndex + 1];
  const operation = chain[clientEndIndex + 2];

  // Guard against undefined (should not happen due to length check, but TypeScript doesn't know)
  if (!model || !operation) {
    return null;
  }

  // Validate operation is a Prisma operation
  if (!ALL_PRISMA_OPERATIONS.includes(operation as PrismaOperation)) {
    return null;
  }

  // Extract and normalize query arguments
  const args = extractQueryArgs(callExpr);
  const normalized = normalizeQueryStructure(args);

  // Generate fingerprint
  const fingerprint = generatePrismaFingerprint(model, operation, normalized);

  const span = callExpr.span as Span;

  return {
    type: 'prisma',
    offset: span.start,
    model,
    operation: operation as PrismaOperationType,
    whereStructure: normalized.where.join(','),
    selectStructure: [...normalized.select, ...normalized.include].join(','),
    fingerprint,
    procedureName: context.procedureName,
    routerName: context.routerName,
  };
}

/**
 * Find Prisma client in member chain
 * Returns the index where the client identifier ends
 */
function findPrismaClient(chain: string[]): { clientEndIndex: number } | null {
  // Check single identifiers (prisma, db)
  for (const identifier of PRISMA_CLIENT_IDENTIFIERS) {
    const parts = identifier.split('.');

    if (parts.length === 1 && parts[0]) {
      // Single identifier like "prisma" or "db"
      const idx = chain.indexOf(parts[0]);
      if (idx !== -1) {
        return { clientEndIndex: idx };
      }
    } else if (parts.length > 1) {
      // Compound identifier like "ctx.db" or "ctx.prisma"
      for (let i = 0; i <= chain.length - parts.length; i++) {
        const match = parts.every((part, j) => chain[i + j] === part);
        if (match) {
          return { clientEndIndex: i + parts.length - 1 };
        }
      }
    }
  }

  return null;
}

// ============================================================================
// TRPC DETECTION
// ============================================================================

/**
 * Detect tRPC query hook call
 *
 * @example
 * ```ts
 * trpc.users.getById.useQuery({ id })
 * api.businessPlaces.list.useQuery(undefined)
 * ```
 */
function detectTrpcQuery(
  callExpr: CallExpression,
  _content: string,
  context: QueryDetectorContext,
): QueryDetection | null {
  const callee = callExpr.callee;

  // Must be a member expression
  if (callee.type !== 'MemberExpression') {
    return null;
  }

  // Extract the call chain
  const chain = extractMemberChain(callee as MemberExpression);
  if (chain.length < 3) {
    return null; // Need at least: client.router.procedure.hook
  }

  // Check if last element is a tRPC hook
  const hookName = chain[chain.length - 1];
  if (!hookName || !ALL_TRPC_HOOKS.includes(hookName as TrpcHook)) {
    return null;
  }

  // Check if first element is a tRPC client
  const clientName = chain[0];
  if (
    !clientName ||
    !TRPC_CLIENT_IDENTIFIERS.includes(clientName as (typeof TRPC_CLIENT_IDENTIFIERS)[number])
  ) {
    return null;
  }

  // Extract router and procedure path (everything between client and hook)
  // e.g., trpc.users.getById.useQuery -> router: "users", procedure: "getById"
  const pathParts = chain.slice(1, -1); // Remove client and hook
  const router = pathParts[0];
  if (!router) {
    return null;
  }

  const procedure = pathParts.slice(1).join('.') || 'default';
  const procedurePath = pathParts.join('.');

  // Extract and normalize input
  const inputArg = callExpr.arguments[0];
  const inputNormalized = normalizeTrpcInput(extractArgumentValue(inputArg));

  // Generate fingerprint
  const fingerprint = generateTrpcFingerprint(procedurePath, hookName, inputNormalized);

  const span = callExpr.span as Span;

  return {
    type: 'trpc',
    offset: span.start,
    procedurePath,
    router,
    procedure,
    hook: hookName as TrpcHookType,
    inputStructure: inputNormalized.signature,
    fingerprint,
    componentName: context.functionName,
  };
}

// ============================================================================
// AST HELPERS
// ============================================================================

/**
 * Extract member expression chain as array of identifiers
 *
 * @example
 * `ctx.db.user.findMany` -> ['ctx', 'db', 'user', 'findMany']
 */
function extractMemberChain(expr: MemberExpression): string[] {
  const chain: string[] = [];

  // Get property name
  const prop = expr.property;
  if (prop.type === 'Identifier') {
    chain.unshift(prop.value);
  } else if (
    prop.type === 'Computed' &&
    (prop as { expression?: { type: string; value?: string } }).expression?.type === 'StringLiteral'
  ) {
    chain.unshift((prop as { expression: { value: string } }).expression.value);
  }

  // Recursively get object chain
  const obj = expr.object;
  if (obj.type === 'MemberExpression') {
    chain.unshift(...extractMemberChain(obj as MemberExpression));
  } else if (obj.type === 'Identifier') {
    chain.unshift((obj as { value: string }).value);
  } else if (obj.type === 'CallExpression') {
    // Handle chained calls like trpc.useContext().users.list
    const calleeChain = extractCalleeChain(obj as CallExpression);
    chain.unshift(...calleeChain);
  }

  return chain;
}

/**
 * Extract chain from a call expression's callee
 */
function extractCalleeChain(callExpr: CallExpression): string[] {
  const callee = callExpr.callee;

  if (callee.type === 'MemberExpression') {
    return extractMemberChain(callee as MemberExpression);
  } else if (callee.type === 'Identifier') {
    return [(callee as { value: string }).value];
  }

  return [];
}

/**
 * Extract query arguments from call expression
 * Returns a simplified representation of the first argument
 */
function extractQueryArgs(callExpr: CallExpression): Record<string, unknown> | null {
  const firstArg = callExpr.arguments[0];
  if (!firstArg) {
    return null;
  }

  return extractArgumentValue(firstArg.expression) as Record<string, unknown>;
}

/**
 * Extract value from an argument node
 * Simplifies AST node to a plain object representation
 */
function extractArgumentValue(node: unknown): unknown {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const nodeObj = node as {
    type?: string;
    value?: unknown;
    properties?: unknown[];
    elements?: unknown[];
  };
  const nodeType = nodeObj.type;

  switch (nodeType) {
    case 'ObjectExpression': {
      const result: Record<string, unknown> = {};
      const props = nodeObj.properties as Array<{
        type: string;
        key?: { type: string; value?: string };
        value?: unknown;
      }>;

      if (props) {
        for (const prop of props) {
          if (prop.type === 'KeyValueProperty' || prop.type === 'Property') {
            const key = prop.key;
            const keyName = key?.type === 'Identifier' ? (key as { value: string }).value : null;
            if (keyName) {
              result[keyName] = extractArgumentValue(prop.value);
            }
          }
        }
      }
      return result;
    }

    case 'ArrayExpression': {
      const elements = nodeObj.elements as Array<{ expression?: unknown }>;
      return elements?.map((el) => extractArgumentValue(el?.expression)) ?? [];
    }

    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return nodeObj.value;

    case 'Identifier':
      // Return placeholder for variable references
      return '*';

    case 'NullLiteral':
      return null;

    default:
      // For other expressions, return a placeholder
      return '*';
  }
}

// ============================================================================
// CONTEXT DETECTION
// ============================================================================

/**
 * Detect if we're inside a tRPC router definition
 */
export function detectTrpcRouterContext(node: Node): string | null {
  const nodeType = (node as { type?: string }).type;

  // Look for router() calls or procedure definitions
  if (nodeType === 'CallExpression') {
    const callExpr = node as CallExpression;
    const callee = callExpr.callee;

    if (callee.type === 'MemberExpression') {
      const chain = extractMemberChain(callee as MemberExpression);

      // Check for .router pattern
      if (chain.includes('router')) {
        return 'router';
      }

      // Check for procedure patterns like .query, .mutation
      if (chain.includes('query') || chain.includes('mutation')) {
        return 'procedure';
      }
    }
  }

  return null;
}

/**
 * Detect if we're inside a React component (function starting with uppercase)
 */
export function detectReactComponentContext(node: Node): string | null {
  const nodeType = (node as { type?: string }).type;

  if (nodeType === 'FunctionDeclaration' || nodeType === 'FunctionExpression') {
    const funcNode = node as { identifier?: { value: string } };
    const name = funcNode.identifier?.value;

    // React components start with uppercase
    if (name && /^[A-Z]/.test(name)) {
      return name;
    }
  }

  if (nodeType === 'VariableDeclarator') {
    const varNode = node as { id?: { type: string; value?: string } };
    if (varNode.id?.type === 'Identifier') {
      const name = varNode.id.value;
      if (name && /^[A-Z]/.test(name)) {
        return name;
      }
    }
  }

  return null;
}
