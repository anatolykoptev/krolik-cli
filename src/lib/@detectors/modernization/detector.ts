/**
 * @module lib/@detectors/modernization/detector
 * @description SWC AST detector for modernization issues
 *
 * Detects:
 * - require() calls
 * - require.resolve() calls
 */

import type { Node, Span } from '@swc/core';
import type { ModernizationDetection } from '../ast/types';

// ============================================================================
// MAIN DETECTOR
// ============================================================================

/**
 * Detect modernization issue from AST node
 *
 * Identifies legacy CommonJS patterns that should be migrated to ES modules:
 * - require('module')
 * - require.resolve('module')
 *
 * @param node - SWC AST node
 * @returns Detection result or null if no issue found
 */
export function detectModernizationIssue(node: Node): ModernizationDetection | null {
  const nodeType = (node as { type?: string }).type;
  const span = (node as { span?: Span }).span;

  if (!span) {
    return null;
  }

  // Only process CallExpression nodes
  if (nodeType !== 'CallExpression') {
    return null;
  }

  const callExpr = node as {
    callee?: Node;
    span?: Span;
  };

  const callee = callExpr.callee;
  if (!callee) {
    return null;
  }

  const calleeType = (callee as { type?: string }).type;

  // 1. Direct require('module')
  if (calleeType === 'Identifier') {
    const identifier = callee as { value?: string };
    const identifierValue = identifier.value;

    if (identifierValue === 'require') {
      return {
        type: 'require',
        offset: span.start,
        method: 'require',
      };
    }
  }

  // 2. require.resolve('module')
  if (calleeType === 'MemberExpression') {
    const memberExpr = callee as {
      object?: Node;
      property?: Node;
    };

    const object = memberExpr.object;
    const property = memberExpr.property;

    if (!object || !property) {
      return null;
    }

    // Check if object is "require"
    const objectType = (object as { type?: string }).type;
    if (objectType === 'Identifier') {
      const objectValue = (object as { value?: string }).value;
      if (objectValue === 'require') {
        // Check if property is "resolve"
        const propertyType = (property as { type?: string }).type;
        if (propertyType === 'Identifier') {
          const propertyValue = (property as { value?: string }).value;
          if (propertyValue === 'resolve') {
            return {
              type: 'require',
              offset: span.start,
              method: 'require.resolve',
            };
          }
        }
      }
    }
  }

  return null;
}

// ============================================================================
// SPECIALIZED DETECTORS
// ============================================================================

/**
 * Detect require calls specifically
 *
 * Detects both:
 * - require('module')
 * - require.resolve('module')
 */
export function detectRequire(node: Node): ModernizationDetection | null {
  const result = detectModernizationIssue(node);
  return result?.type === 'require' ? result : null;
}
