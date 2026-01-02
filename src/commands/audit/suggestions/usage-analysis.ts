/**
 * @module commands/audit/suggestions/usage-analysis
 * @description Analyze variable usage patterns for type inference
 *
 * Provides AST-based analysis of how variables are used.
 */

import type { CallExpression, Module, Node } from '@swc/core';
import {
  getCalleeName,
  getCalleeObjectName,
  getIdentifierName,
  getNodeType,
  offsetToLine,
  visitNode,
} from '../../../lib/@ast/swc';
import type {
  ConfidenceLevel,
  TypeEvidence,
  TypeInferenceResult,
  TypeInferenceSource,
} from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Variable usage information
 */
interface VariableUsage {
  line: number;
  node: Node;
  context: UsageContext;
}

/**
 * Context of how a variable is used
 */
type UsageContext =
  | { type: 'method-call'; method: string; objectName?: string | undefined }
  | { type: 'property-access'; property: string }
  | { type: 'computed-access' }
  | { type: 'assignment'; valueType?: string | undefined }
  | { type: 'return' }
  | { type: 'argument'; functionName?: string | undefined; argIndex?: number | undefined }
  | { type: 'for-of' }
  | { type: 'spread' }
  | { type: 'other' };

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Common type patterns detected from usage
 */
export const USAGE_PATTERNS = {
  /** String methods indicate string type */
  stringMethods: [
    'toLowerCase',
    'toUpperCase',
    'trim',
    'split',
    'replace',
    'includes',
    'startsWith',
    'endsWith',
    'charAt',
    'substring',
    'slice',
    'match',
    'padStart',
    'padEnd',
    'repeat',
    'normalize',
  ],
  /** Number methods indicate number type */
  numberMethods: ['toFixed', 'toPrecision', 'toExponential', 'toString'],
  /** Array methods indicate array type */
  arrayMethods: [
    'map',
    'filter',
    'reduce',
    'forEach',
    'find',
    'some',
    'every',
    'push',
    'pop',
    'shift',
    'unshift',
    'slice',
    'splice',
    'includes',
    'indexOf',
    'join',
    'sort',
    'reverse',
    'flat',
    'flatMap',
    'fill',
    'copyWithin',
    'entries',
    'keys',
    'values',
    'at',
    'findIndex',
    'findLast',
    'findLastIndex',
  ],
  /** Promise methods indicate Promise type */
  promiseMethods: ['then', 'catch', 'finally'],
  /** Object static methods indicate Record/object usage */
  objectStaticMethods: ['keys', 'values', 'entries', 'assign', 'freeze', 'seal'],
  /** Set methods indicate Set type */
  setMethods: ['add', 'delete', 'has', 'clear', 'size'],
  /** Map methods indicate Map type */
  mapMethods: ['get', 'set', 'delete', 'has', 'clear', 'size', 'keys', 'values', 'entries'],
  /** Function methods indicate function type */
  functionMethods: ['call', 'apply', 'bind'],
} as const;

/**
 * Confidence scores for different inference sources
 */
export const CONFIDENCE_SCORES: Record<TypeInferenceSource, ConfidenceLevel> = {
  fallback: 100, // unknown is always safe
  usage: 75, // Method usage is reliable
  assignment: 80, // Direct assignment is reliable
  return: 70, // Return type inference
  parameter: 65, // Parameter usage inference
  'property-access': 60, // Property access patterns
};

/**
 * Enhanced type inference result with evidence
 */
export interface EnhancedTypeInferenceResult extends TypeInferenceResult {
  /** Evidence supporting the inferred type */
  evidence: TypeEvidence[];
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Find all usages of a variable in the AST
 */
export function findVariableUsages(
  ast: Module,
  variableName: string,
  lineOffsets: number[],
  baseOffset: number,
): VariableUsage[] {
  const usages: VariableUsage[] = [];

  visitNode(ast, (node, context) => {
    // Look for identifiers matching our variable name
    if (getNodeType(node) === 'Identifier') {
      const name = getIdentifierName(node);
      if (name === variableName && context?.parent) {
        const span = (node as { span?: { start: number } }).span;
        if (span) {
          const normalizedOffset = span.start - baseOffset;
          const line = offsetToLine(normalizedOffset, lineOffsets);
          const usageContext = determineUsageContext(node, context.parent);

          usages.push({ line, node, context: usageContext });
        }
      }
    }
  });

  return usages;
}

/**
 * Analyze usages to infer the most likely type
 */
export function analyzeUsages(
  usages: VariableUsage[],
  variableName: string,
): EnhancedTypeInferenceResult | null {
  const evidence: TypeEvidence[] = [];

  // Collect method calls with their context
  const methodCallUsages = usages.filter(
    (
      u,
    ): u is VariableUsage & {
      context: { type: 'method-call'; method: string; objectName?: string };
    } => u.context.type === 'method-call',
  );

  // Collect property accesses
  const propertyAccessUsages = usages.filter(
    (u): u is VariableUsage & { context: { type: 'property-access'; property: string } } =>
      u.context.type === 'property-access',
  );

  // Collect computed accesses (bracket notation)
  const computedAccessUsages = usages.filter((u) => u.context.type === 'computed-access');

  // Collect for-of usages
  const forOfUsages = usages.filter((u) => u.context.type === 'for-of');

  // Collect spread usages
  const spreadUsages = usages.filter((u) => u.context.type === 'spread');

  // Collect argument usages
  const argumentUsages = usages.filter(
    (u): u is VariableUsage & { context: { type: 'argument'; functionName?: string } } =>
      u.context.type === 'argument',
  );

  const methodCalls = methodCallUsages.map((u) => u.context.method);

  // Check for Object.keys/values/entries (indicates Record/object type)
  const objectStaticUsages = methodCallUsages.filter(
    (u) =>
      u.context.objectName === 'Object' &&
      USAGE_PATTERNS.objectStaticMethods.includes(
        u.context.method as (typeof USAGE_PATTERNS.objectStaticMethods)[number],
      ),
  );
  if (objectStaticUsages.length > 0) {
    for (const usage of objectStaticUsages) {
      evidence.push({
        type: 'method-call',
        description: `Object.${usage.context.method}(${variableName}) called`,
        line: usage.line,
      });
    }
    return {
      inferredType: 'Record<string, unknown>',
      confidence: CONFIDENCE_SCORES.usage,
      source: 'usage',
      details: `Object methods used: ${objectStaticUsages.map((u) => u.context.method).join(', ')}`,
      evidence,
    };
  }

  // Check for property access patterns (indicates object/Record type)
  if (propertyAccessUsages.length > 0) {
    const properties = propertyAccessUsages.map((u) => u.context.property);
    for (const usage of propertyAccessUsages) {
      evidence.push({
        type: 'property-access',
        description: `${variableName}.${usage.context.property} accessed`,
        line: usage.line,
      });
    }

    // If we also have computed access, it's more likely a Record
    if (computedAccessUsages.length > 0) {
      for (const usage of computedAccessUsages) {
        evidence.push({
          type: 'property-access',
          description: `${variableName}[...] bracket access`,
          line: usage.line,
        });
      }
      return {
        inferredType: 'Record<string, unknown>',
        confidence: CONFIDENCE_SCORES['property-access'] + 10,
        source: 'property-access',
        details: `Properties accessed: ${properties.join(', ')} + bracket notation`,
        evidence,
      };
    }

    // Just property access - likely a specific object type
    return {
      inferredType: 'Record<string, unknown>',
      confidence: CONFIDENCE_SCORES['property-access'],
      source: 'property-access',
      details: `Properties accessed: ${properties.join(', ')}`,
      evidence,
    };
  }

  // Check for string methods
  const stringMethodsUsed = methodCalls.filter((m) =>
    USAGE_PATTERNS.stringMethods.includes(m as (typeof USAGE_PATTERNS.stringMethods)[number]),
  );
  if (stringMethodsUsed.length > 0) {
    for (const method of stringMethodsUsed) {
      const usage = methodCallUsages.find((u) => u.context.method === method);
      evidence.push({
        type: 'method-call',
        description: `${variableName}.${method}() called`,
        line: usage?.line,
      });
    }
    return {
      inferredType: 'string',
      confidence: CONFIDENCE_SCORES.usage,
      source: 'usage',
      details: `Uses string methods: ${stringMethodsUsed.join(', ')}`,
      evidence,
    };
  }

  // Check for number methods
  const numberMethodsUsed = methodCalls.filter((m) =>
    USAGE_PATTERNS.numberMethods.includes(m as (typeof USAGE_PATTERNS.numberMethods)[number]),
  );
  if (numberMethodsUsed.length > 0) {
    for (const method of numberMethodsUsed) {
      const usage = methodCallUsages.find((u) => u.context.method === method);
      evidence.push({
        type: 'method-call',
        description: `${variableName}.${method}() called`,
        line: usage?.line,
      });
    }
    return {
      inferredType: 'number',
      confidence: CONFIDENCE_SCORES.usage,
      source: 'usage',
      details: `Uses number methods: ${numberMethodsUsed.join(', ')}`,
      evidence,
    };
  }

  // Check for array methods
  const arrayMethodsUsed = methodCalls.filter((m) =>
    USAGE_PATTERNS.arrayMethods.includes(m as (typeof USAGE_PATTERNS.arrayMethods)[number]),
  );
  if (arrayMethodsUsed.length > 0) {
    for (const method of arrayMethodsUsed) {
      const usage = methodCallUsages.find((u) => u.context.method === method);
      evidence.push({
        type: 'method-call',
        description: `${variableName}.${method}() called`,
        line: usage?.line,
      });
    }
    return {
      inferredType: 'unknown[]',
      confidence: CONFIDENCE_SCORES.usage - 10, // Slightly lower - we don't know element type
      source: 'usage',
      details: `Uses array methods: ${arrayMethodsUsed.join(', ')}`,
      evidence,
    };
  }

  // Check for for-of iteration (indicates array or iterable)
  if (forOfUsages.length > 0) {
    for (const usage of forOfUsages) {
      evidence.push({
        type: 'for-of',
        description: `for (... of ${variableName}) iteration`,
        line: usage.line,
      });
    }
    return {
      inferredType: 'unknown[]',
      confidence: CONFIDENCE_SCORES.usage - 15,
      source: 'usage',
      details: 'Used in for-of loop',
      evidence,
    };
  }

  // Check for spread usage (indicates array or object)
  if (spreadUsages.length > 0) {
    for (const usage of spreadUsages) {
      evidence.push({
        type: 'spread',
        description: `...${variableName} spread operator used`,
        line: usage.line,
      });
    }
    return {
      inferredType: 'unknown[] | Record<string, unknown>',
      confidence: CONFIDENCE_SCORES.usage - 20,
      source: 'usage',
      details: 'Spread operator used',
      evidence,
    };
  }

  // Check for Promise methods
  const promiseMethodsUsed = methodCalls.filter((m) =>
    USAGE_PATTERNS.promiseMethods.includes(m as (typeof USAGE_PATTERNS.promiseMethods)[number]),
  );
  if (promiseMethodsUsed.length > 0) {
    for (const method of promiseMethodsUsed) {
      const usage = methodCallUsages.find((u) => u.context.method === method);
      evidence.push({
        type: 'method-call',
        description: `${variableName}.${method}() called`,
        line: usage?.line,
      });
    }
    return {
      inferredType: 'Promise<unknown>',
      confidence: CONFIDENCE_SCORES.usage - 5,
      source: 'usage',
      details: `Uses Promise methods: ${promiseMethodsUsed.join(', ')}`,
      evidence,
    };
  }

  // Check for function methods
  const functionMethodsUsed = methodCalls.filter((m) =>
    USAGE_PATTERNS.functionMethods.includes(m as (typeof USAGE_PATTERNS.functionMethods)[number]),
  );
  if (functionMethodsUsed.length > 0) {
    for (const method of functionMethodsUsed) {
      const usage = methodCallUsages.find((u) => u.context.method === method);
      evidence.push({
        type: 'method-call',
        description: `${variableName}.${method}() called`,
        line: usage?.line,
      });
    }
    return {
      inferredType: '(...args: unknown[]) => unknown',
      confidence: CONFIDENCE_SCORES.usage - 5,
      source: 'usage',
      details: `Uses function methods: ${functionMethodsUsed.join(', ')}`,
      evidence,
    };
  }

  // Check for argument usage in known functions
  if (argumentUsages.length > 0) {
    for (const usage of argumentUsages) {
      evidence.push({
        type: 'argument',
        description: `Passed to ${usage.context.functionName ?? 'function'}()`,
        line: usage.line,
      });
    }
    // Not enough info to infer specific type
  }

  // No specific type could be inferred
  return null;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Determine how a variable is being used from its parent node
 */
function determineUsageContext(node: Node, parent: Node): UsageContext {
  const parentType = getNodeType(parent);

  // Check for method calls: variable.method()
  if (parentType === 'MemberExpression') {
    const memberExpr = parent as unknown as {
      object: Node;
      property: { type: string; value?: string };
      computed?: boolean;
    };

    // Check if this is computed access (bracket notation)
    if (memberExpr.computed) {
      return { type: 'computed-access' };
    }

    if (memberExpr.property?.type === 'Identifier') {
      const propertyName = (memberExpr.property as unknown as { value: string }).value;
      if (propertyName) {
        // This could be either property access or method call
        // We'll mark it as property access, and if parent is CallExpression, it's a method call
        return { type: 'property-access', property: propertyName };
      }
    }
  }

  // Check for CallExpression - this might be a method call or passing as argument
  if (parentType === 'CallExpression') {
    const callExpr = parent as CallExpression;

    // Check if our variable is the callee's object (method call on it)
    const callee = callExpr.callee;
    if (callee.type === 'MemberExpression') {
      const memberExpr = callee as unknown as {
        object: Node;
        property: { type: string; value?: string };
      };
      // Check if the variable is the object of the member expression
      if (memberExpr.object === node) {
        const methodName = (memberExpr.property as unknown as { value?: string }).value;
        if (methodName) {
          return { type: 'method-call', method: methodName };
        }
      }
    }

    // Check if our variable is passed as an argument to Object.keys/values/entries
    const objectName = getCalleeObjectName(callExpr);
    const methodName = getCalleeName(callExpr);

    if (objectName === 'Object' && methodName) {
      // Check if node is in the arguments
      const isArgument = callExpr.arguments.some((arg) => {
        if ('expression' in arg) {
          return arg.expression === node;
        }
        return false;
      });
      if (isArgument) {
        return { type: 'method-call', method: methodName, objectName: 'Object' };
      }
    }

    // Variable passed as argument to a function
    const funcName = getCalleeName(callExpr);
    return { type: 'argument', functionName: funcName ?? undefined };
  }

  // Check for assignments
  if (parentType === 'AssignmentExpression') {
    return { type: 'assignment' };
  }

  // Check for return statements
  if (parentType === 'ReturnStatement') {
    return { type: 'return' };
  }

  // Check for for-of statements
  if (parentType === 'ForOfStatement') {
    return { type: 'for-of' };
  }

  // Check for spread element
  if (parentType === 'SpreadElement') {
    return { type: 'spread' };
  }

  return { type: 'other' };
}
