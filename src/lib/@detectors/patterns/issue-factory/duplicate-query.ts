/**
 * @module lib/@detectors/issue-factory/duplicate-query
 * @description Factory functions for creating duplicate query quality issues
 */

import { getSnippet, offsetToLine } from '@/lib/@ast/swc';
import type {
  PrismaOperationType,
  PrismaQueryDetection,
  QueryDetection,
  TrpcHookType,
  TrpcQueryDetection,
} from '../ast/types';
import type { IssueFactoryContext, QualityIssue } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Fixer ID for duplicate query issues */
export const DUPLICATE_QUERY_FIXER_ID = 'extract-query' as const;

/** Minimum occurrences to report as duplicate */
export const MIN_DUPLICATE_OCCURRENCES = 2;

// ============================================================================
// DUPLICATE GROUP TYPES
// ============================================================================

/**
 * A group of duplicate queries (after aggregation)
 */
export interface DuplicateQueryGroup {
  /** Shared fingerprint */
  fingerprint: string;
  /** Query type (prisma or trpc) */
  type: 'prisma' | 'trpc';
  /** All detections in this group */
  detections: QueryDetection[];
  /** Locations (file:line) */
  locations: Array<{ file: string; line: number }>;
  /** Suggested function/hook name */
  suggestedName: string;
  /** Suggested file for extraction */
  suggestedFile: string;
}

// ============================================================================
// MESSAGE GENERATORS
// ============================================================================

/** Generate Prisma duplicate query message */
function getPrismaMessage(model: string, op: string, count: number): string {
  return `Duplicate ${model}.${op}() query found ${count} times`;
}

/** Generate Prisma duplicate query suggestion */
function getPrismaSuggestion(name: string): string {
  return `Extract to reusable function: ${name}(). Consider placing in packages/api/src/lib/queries/`;
}

/** Generate tRPC duplicate query message */
function getTrpcMessage(path: string, count: number): string {
  return `Duplicate trpc.${path}.useQuery() hook called ${count} times`;
}

/** Generate tRPC duplicate query suggestion */
function getTrpcSuggestion(name: string): string {
  return `Extract to shared hook: ${name}(). Consider placing in lib/@ui/hooks/`;
}

// ============================================================================
// NAME GENERATION
// ============================================================================

/**
 * Generate suggested function name for Prisma query
 */
function generatePrismaFunctionName(model: string, operation: PrismaOperationType): string {
  const modelCapitalized = model.charAt(0).toUpperCase() + model.slice(1);

  switch (operation) {
    case 'findMany':
      return `get${modelCapitalized}List`;
    case 'findUnique':
    case 'findUniqueOrThrow':
      return `get${modelCapitalized}ById`;
    case 'findFirst':
    case 'findFirstOrThrow':
      return `find${modelCapitalized}`;
    case 'count':
      return `count${modelCapitalized}s`;
    case 'aggregate':
    case 'groupBy':
      return `get${modelCapitalized}Stats`;
    case 'create':
      return `create${modelCapitalized}`;
    case 'createMany':
      return `createMany${modelCapitalized}s`;
    case 'update':
      return `update${modelCapitalized}`;
    case 'updateMany':
      return `updateMany${modelCapitalized}s`;
    case 'delete':
      return `delete${modelCapitalized}`;
    case 'deleteMany':
      return `deleteMany${modelCapitalized}s`;
    case 'upsert':
      return `upsert${modelCapitalized}`;
    default:
      return `${operation}${modelCapitalized}`;
  }
}

/**
 * Generate suggested hook name for tRPC query
 */
function generateTrpcHookName(router: string, procedure: string, hook: TrpcHookType): string {
  const routerCapitalized = router.charAt(0).toUpperCase() + router.slice(1);
  const procedureCapitalized = procedure.charAt(0).toUpperCase() + procedure.slice(1);

  if (hook === 'useMutation') {
    return `use${routerCapitalized}${procedureCapitalized}Mutation`;
  }

  return `use${routerCapitalized}${procedureCapitalized}`;
}

// ============================================================================
// ISSUE FACTORY
// ============================================================================

/**
 * Create a QualityIssue from a Prisma query detection
 */
export function createPrismaQueryIssue(
  detection: PrismaQueryDetection,
  ctx: IssueFactoryContext,
  duplicateCount: number,
): QualityIssue {
  const adjustedOffset = detection.offset - ctx.baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, ctx.lineOffsets);
  const snippet = getSnippet(ctx.content, adjustedOffset, ctx.lineOffsets);

  const suggestedName = generatePrismaFunctionName(detection.model, detection.operation);

  return {
    file: ctx.filepath,
    line: lineNumber,
    severity: duplicateCount >= 3 ? 'warning' : 'info',
    category: 'duplicate-query',
    message: getPrismaMessage(detection.model, detection.operation, duplicateCount),
    suggestion: getPrismaSuggestion(suggestedName),
    snippet,
    fixerId: DUPLICATE_QUERY_FIXER_ID,
  };
}

/**
 * Create a QualityIssue from a tRPC query detection
 */
export function createTrpcQueryIssue(
  detection: TrpcQueryDetection,
  ctx: IssueFactoryContext,
  duplicateCount: number,
): QualityIssue {
  const adjustedOffset = detection.offset - ctx.baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, ctx.lineOffsets);
  const snippet = getSnippet(ctx.content, adjustedOffset, ctx.lineOffsets);

  const suggestedName = generateTrpcHookName(detection.router, detection.procedure, detection.hook);

  return {
    file: ctx.filepath,
    line: lineNumber,
    severity: duplicateCount >= 3 ? 'warning' : 'info',
    category: 'duplicate-query',
    message: getTrpcMessage(detection.procedurePath, duplicateCount),
    suggestion: getTrpcSuggestion(suggestedName),
    snippet,
    fixerId: DUPLICATE_QUERY_FIXER_ID,
  };
}

/**
 * Create a QualityIssue from any query detection
 */
export function createDuplicateQueryIssue(
  detection: QueryDetection,
  ctx: IssueFactoryContext,
  duplicateCount: number = 1,
): QualityIssue {
  if (detection.type === 'prisma') {
    return createPrismaQueryIssue(detection, ctx, duplicateCount);
  }
  return createTrpcQueryIssue(detection, ctx, duplicateCount);
}

/**
 * Create issues from duplicate groups (aggregated detections)
 *
 * This is the main entry point for creating issues from grouped duplicates.
 * It creates one issue per group, using the first detection as representative.
 */
export function createDuplicateQueryIssues(
  groups: DuplicateQueryGroup[],
  ctx: IssueFactoryContext,
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const group of groups) {
    // Only report if there are duplicates
    if (group.detections.length < MIN_DUPLICATE_OCCURRENCES) {
      continue;
    }

    // Use first detection as representative
    const firstDetection = group.detections[0];
    if (!firstDetection) continue;

    const issue = createDuplicateQueryIssue(firstDetection, ctx, group.detections.length);

    // Add metadata about all locations
    const otherLocations = group.locations
      .slice(1)
      .map((loc) => `${loc.file}:${loc.line}`)
      .join(', ');

    if (otherLocations) {
      issue.suggestion += ` Also used in: ${otherLocations}`;
    }

    issues.push(issue);
  }

  return issues;
}

// ============================================================================
// GROUPING UTILITIES
// ============================================================================

/**
 * Group query detections by fingerprint
 *
 * @param detections - All query detections from analysis
 * @param fileContexts - Map of filepath to factory context
 * @returns Array of duplicate groups (only groups with 2+ items)
 */
export function groupQueryDetections(
  detections: Array<{ detection: QueryDetection; ctx: IssueFactoryContext }>,
): DuplicateQueryGroup[] {
  const groups = new Map<string, DuplicateQueryGroup>();

  for (const { detection, ctx } of detections) {
    const { fingerprint } = detection;

    if (!groups.has(fingerprint)) {
      // Create new group
      const suggestedName =
        detection.type === 'prisma'
          ? generatePrismaFunctionName(detection.model, detection.operation)
          : generateTrpcHookName(detection.router, detection.procedure, detection.hook);

      const suggestedFile =
        detection.type === 'prisma'
          ? `packages/api/src/lib/queries/${detection.model}.ts`
          : `apps/web/lib/@ui/hooks/use${detection.router.charAt(0).toUpperCase() + detection.router.slice(1)}.ts`;

      groups.set(fingerprint, {
        fingerprint,
        type: detection.type,
        detections: [],
        locations: [],
        suggestedName,
        suggestedFile,
      });
    }

    const group = groups.get(fingerprint)!;
    group.detections.push(detection);

    const adjustedOffset = detection.offset - ctx.baseOffset;
    const line = offsetToLine(adjustedOffset, ctx.lineOffsets);
    group.locations.push({ file: ctx.filepath, line });
  }

  // Filter to only groups with duplicates
  return Array.from(groups.values()).filter(
    (group) => group.detections.length >= MIN_DUPLICATE_OCCURRENCES,
  );
}
