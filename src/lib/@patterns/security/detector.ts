/**
 * @module lib/@patterns/security/detector
 * @description SWC AST detector for security issues
 *
 * Detects:
 * - Command injection (execSync/exec/spawn with template literals)
 * - Path traversal (path.join/resolve with untrusted variable in path segments)
 *
 * Path traversal logic:
 * - First argument is typically a trusted base path (projectRoot, basePath)
 * - Only flags if arguments AFTER the first are variables (potential user input)
 * - path.join(projectRoot, 'package.json') → SAFE (literal path segment)
 * - path.join(projectRoot, userInput) → DANGEROUS (variable path segment)
 */

import type { Node, Span } from '@swc/core';
import type { SecurityDetection } from '@/lib/@swc/detectors/types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Child process methods that can lead to command injection */
const COMMAND_EXEC_METHODS = ['execSync', 'exec', 'spawn', 'spawnSync'] as const;

/** Path methods that can lead to path traversal */
const PATH_METHODS = ['join', 'resolve'] as const;

// ============================================================================
// MAIN DETECTOR
// ============================================================================

/**
 * Detect security issue from AST node
 *
 * @param node - SWC AST node
 * @returns Detection result or null if no issue found
 */
export function detectSecurityIssue(node: Node): SecurityDetection | null {
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
    arguments?: Node[];
    span?: Span;
  };

  const callee = callExpr.callee;
  if (!callee) {
    return null;
  }

  const calleeType = (callee as { type?: string }).type;

  // 1. Command Injection - execSync, exec, spawn with template literals
  if (calleeType === 'Identifier') {
    const identifier = callee as { value?: string };
    const identifierValue = identifier.value;

    if (
      identifierValue &&
      COMMAND_EXEC_METHODS.includes(identifierValue as (typeof COMMAND_EXEC_METHODS)[number])
    ) {
      const args = callExpr.arguments ?? [];
      const firstArg = args[0];

      // Check if first argument is a template literal with expressions
      // Note: SWC wraps arguments in { spread, expression } objects
      if (firstArg) {
        const argExpr = (firstArg as { expression?: Node }).expression;
        if (argExpr) {
          const argType = (argExpr as { type?: string }).type;
          if (argType === 'TemplateLiteral') {
            const templateLiteral = argExpr as { expressions?: unknown[] };
            const expressions = templateLiteral.expressions ?? [];

            // Template literal with interpolation = potential injection
            if (expressions.length > 0) {
              return {
                type: 'command-injection',
                offset: span.start,
                method: identifierValue,
              };
            }
          }
        }
      }
    }
  }

  // 2. Path Traversal - path.join() or path.resolve() with variables
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

    // Check if object is "path"
    const objectType = (object as { type?: string }).type;
    if (objectType === 'Identifier') {
      const objectValue = (object as { value?: string }).value;
      if (objectValue === 'path') {
        // Check if property is join or resolve
        const propertyType = (property as { type?: string }).type;
        if (propertyType === 'Identifier') {
          const propertyValue = (property as { value?: string }).value;
          if (
            propertyValue &&
            PATH_METHODS.includes(propertyValue as (typeof PATH_METHODS)[number])
          ) {
            const args = callExpr.arguments ?? [];

            // Only flag if path segments (args after the first) contain variables
            // First arg is typically a trusted base path (projectRoot, basePath, etc.)
            // path.join(projectRoot, 'file.json') → SAFE (literal segment)
            // path.join(projectRoot, userInput) → DANGEROUS (variable segment)
            const pathSegmentArgs = args.slice(1); // Skip first argument (base path)

            const hasUntrustedPathSegment = pathSegmentArgs.some((arg) => {
              const argExpr = (arg as { expression?: Node }).expression;
              if (!argExpr) return false;

              const argType = (argExpr as { type?: string }).type;

              // Variable identifier = potential untrusted input
              if (argType === 'Identifier') return true;

              // Template literal with expressions = potential untrusted input
              if (argType === 'TemplateLiteral') {
                const templateLiteral = argExpr as { expressions?: unknown[] };
                return (templateLiteral.expressions?.length ?? 0) > 0;
              }

              // Member expression (obj.prop) = potential untrusted input
              if (argType === 'MemberExpression') return true;

              // Call expression (fn()) = potential untrusted input
              if (argType === 'CallExpression') return true;

              // String literal = SAFE
              // Numeric literal = SAFE
              return false;
            });

            if (hasUntrustedPathSegment) {
              return {
                type: 'path-traversal',
                offset: span.start,
                method: `path.${propertyValue}`,
              };
            }
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
 * Detect command injection specifically
 *
 * Detects dangerous patterns like:
 * - execSync(\`rm -rf \${userInput}\`)
 * - spawn(\`echo \${data}\`)
 */
export function detectCommandInjection(node: Node): SecurityDetection | null {
  const result = detectSecurityIssue(node);
  return result?.type === 'command-injection' ? result : null;
}

/**
 * Detect path traversal specifically
 *
 * Only flags when path segments (arguments after the first) contain untrusted input.
 * First argument is assumed to be a trusted base path.
 *
 * SAFE patterns (not flagged):
 * - path.join(projectRoot, 'package.json')
 * - path.join(basePath, 'src', 'lib')
 * - path.resolve(cwd, 'config.ts')
 *
 * DANGEROUS patterns (flagged):
 * - path.join(baseDir, userInput)
 * - path.join(root, fileName)
 * - path.resolve(dir, `${prefix}/file`)
 */
export function detectPathTraversal(node: Node): SecurityDetection | null {
  const result = detectSecurityIssue(node);
  return result?.type === 'path-traversal' ? result : null;
}
