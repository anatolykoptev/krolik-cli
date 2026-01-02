/**
 * @module commands/audit/readability
 * @description Readability Score calculation based on Chromium Tricorder
 *
 * Measures code readability across 4 dimensions:
 * - Naming: descriptive names, no single-letter vars or abbreviations
 * - Structure: low nesting, clear flow, short functions
 * - Comments: JSDoc presence for exports, meaningful comments
 * - Cognitive: inverse of cognitive complexity (SonarQube formula)
 *
 * @see https://www.sonarsource.com/resources/cognitive-complexity/
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Readability score breakdown
 */
export interface ReadabilityScore {
  /** Naming quality: descriptive names, no abbreviations (0-100) */
  naming: number;
  /** Code structure: low nesting, clear flow (0-100) */
  structure: number;
  /** Documentation: JSDoc presence for exports (0-100) */
  comments: number;
  /** Cognitive complexity: inverse score (0-100, higher = simpler) */
  cognitive: number;
  /** Weighted average of all scores */
  overall: number;
  /** Letter grade (A-F) */
  grade: ReadabilityGrade;
  /** Issues found during analysis */
  issues: ReadabilityIssue[];
}

/**
 * Letter grade for readability
 */
export type ReadabilityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Individual readability issue
 */
export interface ReadabilityIssue {
  category: 'naming' | 'structure' | 'comments' | 'cognitive';
  message: string;
  line?: number;
  severity: 'nit' | 'should-fix' | 'must-fix';
}

/**
 * Input data for readability analysis
 */
export interface ReadabilityInput {
  /** Variable and function names */
  identifiers: IdentifierInfo[];
  /** Function metrics */
  functions: FunctionMetrics[];
  /** JSDoc presence for exports */
  jsdocCoverage: {
    exported: number;
    documented: number;
  };
  /** File-level metrics */
  fileMetrics: {
    totalLines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
  };
}

/**
 * Identifier (variable/function/class) info
 */
export interface IdentifierInfo {
  name: string;
  type: 'variable' | 'function' | 'class' | 'parameter';
  line: number;
}

/**
 * Function-level metrics
 */
export interface FunctionMetrics {
  name: string;
  line: number;
  lines: number;
  maxNestingDepth: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  parameterCount: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Thresholds for scoring
 */
const THRESHOLDS = {
  /** Max function length before penalty */
  functionLength: 50,
  /** Max nesting depth before penalty */
  maxNesting: 3,
  /** Max cyclomatic complexity before penalty */
  cyclomaticComplexity: 10,
  /** Max cognitive complexity before penalty */
  cognitiveComplexity: 15,
  /** Max parameters before penalty */
  maxParameters: 4,
  /** Min identifier length (single-letter = bad) */
  minIdentifierLength: 2,
};

/**
 * Single-letter exceptions that are acceptable
 */
const SINGLE_LETTER_EXCEPTIONS = new Set([
  'i',
  'j',
  'k', // loop counters
  'x',
  'y',
  'z', // coordinates
  '_', // unused
  'e', // error in catch
  't', // i18n translation
  'T', // generic type
  'K',
  'V',
  'P', // common generics
]);

/**
 * Common abbreviations that reduce readability
 */
const BAD_ABBREVIATIONS = new Set([
  'idx',
  'cnt',
  'val',
  'num',
  'str',
  'arr',
  'obj',
  'fn',
  'cb',
  'evt',
  'err',
  'msg',
  'btn',
  'ctx',
  'req',
  'res',
  'cfg',
  'tmp',
  'usr',
  'pwd',
  'len',
  'pos',
  'ptr',
  'buf',
  'cur',
  'prev',
  'ret',
  'init',
  'calc',
  'proc',
  'util',
  'misc',
  'temp',
]);

/**
 * Weights for overall score calculation
 */
const WEIGHTS = {
  naming: 0.2,
  structure: 0.3,
  comments: 0.15,
  cognitive: 0.35,
};

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate naming score (0-100)
 * Penalizes single-letter names and abbreviations
 */
export function calculateNamingScore(identifiers: IdentifierInfo[]): {
  score: number;
  issues: ReadabilityIssue[];
} {
  if (identifiers.length === 0) {
    return { score: 100, issues: [] };
  }

  const issues: ReadabilityIssue[] = [];
  let penalties = 0;

  for (const id of identifiers) {
    const name = id.name.toLowerCase();

    // Single-letter check (excluding exceptions)
    if (id.name.length === 1 && !SINGLE_LETTER_EXCEPTIONS.has(id.name)) {
      penalties += 5;
      issues.push({
        category: 'naming',
        message: `Single-letter ${id.type}: "${id.name}"`,
        line: id.line,
        severity: 'nit',
      });
    }

    // Abbreviation check
    if (BAD_ABBREVIATIONS.has(name)) {
      penalties += 2;
      issues.push({
        category: 'naming',
        message: `Abbreviation "${id.name}" — use descriptive name`,
        line: id.line,
        severity: 'nit',
      });
    }

    // Very short names (2 chars) for non-loops
    if (id.name.length === 2 && id.type !== 'parameter') {
      penalties += 1;
    }
  }

  // Score: 100 - penalties, min 0
  const score = Math.max(0, 100 - penalties);
  return { score, issues };
}

/**
 * Calculate structure score (0-100)
 * Penalizes deep nesting, long functions
 */
export function calculateStructureScore(functions: FunctionMetrics[]): {
  score: number;
  issues: ReadabilityIssue[];
} {
  if (functions.length === 0) {
    return { score: 100, issues: [] };
  }

  const issues: ReadabilityIssue[] = [];
  let totalPenalty = 0;

  for (const fn of functions) {
    // Nesting depth penalty
    if (fn.maxNestingDepth > THRESHOLDS.maxNesting) {
      const excess = fn.maxNestingDepth - THRESHOLDS.maxNesting;
      totalPenalty += excess * 5;
      issues.push({
        category: 'structure',
        message: `Function "${fn.name}" has nesting depth ${fn.maxNestingDepth} (max: ${THRESHOLDS.maxNesting})`,
        line: fn.line,
        severity: excess > 2 ? 'should-fix' : 'nit',
      });
    }

    // Function length penalty
    if (fn.lines > THRESHOLDS.functionLength) {
      const excess = fn.lines - THRESHOLDS.functionLength;
      totalPenalty += Math.floor(excess / 10) * 3;
      issues.push({
        category: 'structure',
        message: `Function "${fn.name}" has ${fn.lines} lines (max: ${THRESHOLDS.functionLength})`,
        line: fn.line,
        severity: fn.lines > 100 ? 'should-fix' : 'nit',
      });
    }

    // Parameter count penalty
    if (fn.parameterCount > THRESHOLDS.maxParameters) {
      const excess = fn.parameterCount - THRESHOLDS.maxParameters;
      totalPenalty += excess * 2;
      issues.push({
        category: 'structure',
        message: `Function "${fn.name}" has ${fn.parameterCount} parameters (max: ${THRESHOLDS.maxParameters})`,
        line: fn.line,
        severity: 'nit',
      });
    }
  }

  const score = Math.max(0, 100 - totalPenalty);
  return { score, issues };
}

/**
 * Calculate comments/documentation score (0-100)
 * Based on JSDoc coverage for exports
 */
export function calculateCommentsScore(jsdocCoverage: { exported: number; documented: number }): {
  score: number;
  issues: ReadabilityIssue[];
} {
  if (jsdocCoverage.exported === 0) {
    return { score: 100, issues: [] };
  }

  const coverage = (jsdocCoverage.documented / jsdocCoverage.exported) * 100;
  const issues: ReadabilityIssue[] = [];

  if (coverage < 50) {
    issues.push({
      category: 'comments',
      message: `Only ${Math.round(coverage)}% of exports have JSDoc (${jsdocCoverage.documented}/${jsdocCoverage.exported})`,
      severity: 'nit',
    });
  }

  return { score: Math.round(coverage), issues };
}

/**
 * Calculate cognitive complexity score (0-100)
 * Inverse of SonarQube cognitive complexity
 * Higher score = simpler code
 */
export function calculateCognitiveScore(functions: FunctionMetrics[]): {
  score: number;
  issues: ReadabilityIssue[];
} {
  if (functions.length === 0) {
    return { score: 100, issues: [] };
  }

  const issues: ReadabilityIssue[] = [];
  let totalPenalty = 0;

  for (const fn of functions) {
    // Cognitive complexity penalty
    if (fn.cognitiveComplexity > THRESHOLDS.cognitiveComplexity) {
      const excess = fn.cognitiveComplexity - THRESHOLDS.cognitiveComplexity;
      totalPenalty += excess * 2;
      issues.push({
        category: 'cognitive',
        message: `Function "${fn.name}" has cognitive complexity ${fn.cognitiveComplexity} (max: ${THRESHOLDS.cognitiveComplexity})`,
        line: fn.line,
        severity: fn.cognitiveComplexity > 25 ? 'must-fix' : 'should-fix',
      });
    }

    // Cyclomatic complexity penalty (additional)
    if (fn.cyclomaticComplexity > THRESHOLDS.cyclomaticComplexity) {
      const excess = fn.cyclomaticComplexity - THRESHOLDS.cyclomaticComplexity;
      totalPenalty += excess;
    }
  }

  const score = Math.max(0, 100 - totalPenalty);
  return { score, issues };
}

/**
 * Calculate overall readability score and grade
 */
export function calculateReadabilityScore(input: ReadabilityInput): ReadabilityScore {
  const naming = calculateNamingScore(input.identifiers);
  const structure = calculateStructureScore(input.functions);
  const comments = calculateCommentsScore(input.jsdocCoverage);
  const cognitive = calculateCognitiveScore(input.functions);

  // Weighted average
  const overall = Math.round(
    naming.score * WEIGHTS.naming +
      structure.score * WEIGHTS.structure +
      comments.score * WEIGHTS.comments +
      cognitive.score * WEIGHTS.cognitive,
  );

  // Letter grade
  const grade = scoreToGrade(overall);

  // Combine all issues
  const issues = [...naming.issues, ...structure.issues, ...comments.issues, ...cognitive.issues];

  return {
    naming: naming.score,
    structure: structure.score,
    comments: comments.score,
    cognitive: cognitive.score,
    overall,
    grade,
    issues,
  };
}

/**
 * Convert numeric score to letter grade
 */
export function scoreToGrade(score: number): ReadabilityGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Format readability score as XML
 */
export function formatReadabilityXml(score: ReadabilityScore, indent = 0): string[] {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];

  lines.push(`${pad}<readability overall="${score.overall}" grade="${score.grade}">`);
  lines.push(`${pad}  <naming>${score.naming}</naming>`);
  lines.push(`${pad}  <structure>${score.structure}</structure>`);
  lines.push(`${pad}  <comments>${score.comments}</comments>`);
  lines.push(`${pad}  <cognitive>${score.cognitive}</cognitive>`);

  if (score.issues.length > 0) {
    lines.push(`${pad}  <issues count="${score.issues.length}">`);
    for (const issue of score.issues.slice(0, 10)) {
      const lineAttr = issue.line ? ` line="${issue.line}"` : '';
      lines.push(
        `${pad}    <issue category="${issue.category}" severity="${issue.severity}"${lineAttr}>${issue.message}</issue>`,
      );
    }
    if (score.issues.length > 10) {
      lines.push(`${pad}    <!-- ... and ${score.issues.length - 10} more issues -->`);
    }
    lines.push(`${pad}  </issues>`);
  }

  lines.push(`${pad}</readability>`);
  return lines;
}
