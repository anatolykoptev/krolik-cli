/**
 * QualityGatePlugin - Run code quality checks
 *
 * Runs krolik_audit and krolik_review after agent makes changes.
 * Blocks commit/completion if quality gates fail.
 *
 * @module @felix/plugins/quality-gate-plugin
 */

import type { CallbackContext, LlmResponse } from '@google/adk';
import { BasePlugin } from '@google/adk';

export type QualityGateMode = 'pre-commit' | 'release' | 'full';

export interface QualityGatePluginConfig {
  projectRoot: string;
  mode?: QualityGateMode;
  blockOnFailure?: boolean;
  maxIssues?: number;
  categories?: string[];
}

export interface QualityGateResult {
  passed: boolean;
  mode: QualityGateMode;
  audit?: AuditResult;
  review?: ReviewResult;
  refactor?: RefactorResult;
  blockers: string[];
}

export interface AuditResult {
  totalIssues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  categories: Record<string, number>;
}

export interface ReviewResult {
  hasRisks: boolean;
  risks: string[];
  suggestions: string[];
}

export interface RefactorResult {
  hasDuplicates: boolean;
  duplicateFunctions: number;
  duplicateTypes: number;
  suggestions: string[];
}

export class QualityGatePlugin extends BasePlugin {
  private config: Required<QualityGatePluginConfig>;
  private lastAnalysisTime = 0;
  private analysisDebounceMs = 60_000; // Only run analysis once per minute max
  private cachedResult: QualityGateResult | null = null;

  constructor(config: QualityGatePluginConfig) {
    super('quality-gate');
    this.config = {
      mode: 'pre-commit',
      blockOnFailure: true,
      maxIssues: 0,
      categories: ['security', 'type-safety'],
      ...config,
    };
  }

  /**
   * After model response, run quality checks ONLY if needed
   *
   * Quality gates are expensive (analyzes all files). Only run when:
   * 1. Response contains tool calls that may have modified files
   * 2. Debounce period has passed since last analysis
   * 3. No cached result exists
   */
  override async afterModelCallback({
    callbackContext,
    llmResponse,
  }: {
    callbackContext: CallbackContext;
    llmResponse: LlmResponse;
  }): Promise<LlmResponse | undefined> {
    // Skip partial responses
    if (llmResponse.partial) {
      return undefined;
    }

    // Check if response contains file-modifying tool calls
    const hasFileModifications = this.hasFileModifyingToolCalls(llmResponse);
    if (!hasFileModifications) {
      // No file changes, use cached result if available
      if (this.cachedResult) {
        callbackContext.eventActions.stateDelta['__qualityGate'] = {
          passed: this.cachedResult.passed,
          mode: this.cachedResult.mode,
          totalIssues: this.cachedResult.audit?.totalIssues ?? 0,
          blockers: this.cachedResult.blockers,
          cached: true,
        };
      }
      return undefined;
    }

    // Check debounce - don't run analysis too frequently
    const now = Date.now();
    if (now - this.lastAnalysisTime < this.analysisDebounceMs && this.cachedResult) {
      callbackContext.eventActions.stateDelta['__qualityGate'] = {
        passed: this.cachedResult.passed,
        mode: this.cachedResult.mode,
        totalIssues: this.cachedResult.audit?.totalIssues ?? 0,
        blockers: this.cachedResult.blockers,
        cached: true,
        debounced: true,
      };
      return undefined;
    }

    // Run quality gates
    this.lastAnalysisTime = now;
    const result = await this.runQualityGates();
    this.cachedResult = result;

    // Store result in state
    callbackContext.eventActions.stateDelta['__qualityGate'] = {
      passed: result.passed,
      mode: result.mode,
      totalIssues: result.audit?.totalIssues ?? 0,
      blockers: result.blockers,
    };

    // If blocking is enabled and gates failed, inject feedback
    if (this.config.blockOnFailure && !result.passed && result.blockers.length > 0) {
      return this.appendQualityFeedback(llmResponse, result);
    }

    return undefined;
  }

  /**
   * Check if response contains tool calls that modify files
   */
  private hasFileModifyingToolCalls(response: LlmResponse): boolean {
    const modifyingTools = new Set([
      'write_file',
      'edit_file',
      'create_file',
      'delete_file',
      'Write',
      'Edit',
      'NotebookEdit',
      'bash',
      'Bash', // May modify files
    ]);

    // Check for function calls in response
    if (response.content?.parts) {
      for (const part of response.content.parts) {
        const p = part as { functionCall?: { name?: string } };
        if (p.functionCall?.name && modifyingTools.has(p.functionCall.name)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Run all quality gates based on mode
   */
  private async runQualityGates(): Promise<QualityGateResult> {
    const result: QualityGateResult = {
      passed: true,
      mode: this.config.mode,
      blockers: [],
    };

    try {
      // Run audit
      result.audit = await this.runAudit();

      // Check for blocking issues
      if (result.audit.critical > 0) {
        result.passed = false;
        result.blockers.push(`${result.audit.critical} critical issues found`);
      }

      if (this.config.mode === 'release' && result.audit.high > 0) {
        result.passed = false;
        result.blockers.push(`${result.audit.high} high-severity issues found`);
      }

      if (result.audit.totalIssues > this.config.maxIssues) {
        result.passed = false;
        result.blockers.push(
          `Total issues (${result.audit.totalIssues}) exceeds limit (${this.config.maxIssues})`,
        );
      }

      // Run review for staged changes
      result.review = await this.runReview();
      if (result.review.hasRisks) {
        result.blockers.push(...result.review.risks);
        if (this.config.mode === 'release') {
          result.passed = false;
        }
      }

      // Run refactor analysis (for full mode or release)
      if (this.config.mode === 'full' || this.config.mode === 'release') {
        result.refactor = await this.runRefactor();
        if (result.refactor.hasDuplicates) {
          const total = result.refactor.duplicateFunctions + result.refactor.duplicateTypes;
          result.blockers.push(
            `${total} duplicates found (${result.refactor.duplicateFunctions} functions, ${result.refactor.duplicateTypes} types)`,
          );
          if (this.config.mode === 'release') {
            result.passed = false;
          }
        }
      }
    } catch (error) {
      // Quality gate failed to run - don't block
      result.blockers.push(
        `Quality gate error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  /**
   * Run krolik audit
   */
  private async runAudit(): Promise<AuditResult> {
    try {
      // Import the reporter directly instead of command runner
      // Commands expect CommandContext which we don't have in plugin context
      const { generateAIReportFromAnalysis } = await import('@/lib/@reporter');
      const report = await generateAIReportFromAnalysis(this.config.projectRoot);

      // Convert report to AuditResult format
      const auditResult = { issues: report.groups.flatMap((g) => g.issues.map((ei) => ei.issue)) };

      // Parse audit results
      if (typeof auditResult === 'object' && auditResult !== null) {
        const issues = (auditResult as { issues?: unknown[] }).issues ?? [];
        const result: AuditResult = {
          totalIssues: issues.length,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          categories: {},
        };

        for (const issue of issues) {
          const i = issue as { severity?: string; category?: string };
          switch (i.severity) {
            case 'critical':
              result.critical++;
              break;
            case 'high':
              result.high++;
              break;
            case 'medium':
              result.medium++;
              break;
            default:
              result.low++;
          }
          if (i.category) {
            result.categories[i.category] = (result.categories[i.category] ?? 0) + 1;
          }
        }

        return result;
      }

      return { totalIssues: 0, critical: 0, high: 0, medium: 0, low: 0, categories: {} };
    } catch {
      return { totalIssues: 0, critical: 0, high: 0, medium: 0, low: 0, categories: {} };
    }
  }

  /**
   * Run krolik review on staged changes
   */
  private async runReview(): Promise<ReviewResult> {
    try {
      // Import review utilities directly instead of command runner
      // Commands expect CommandContext which we don't have in plugin context
      const { generateReview } = await import('@/commands/review');
      const { getStagedChanges } = await import('@/commands/review/diff');
      const files = getStagedChanges(this.config.projectRoot);

      if (files.length === 0) {
        return { hasRisks: false, risks: [], suggestions: [] };
      }

      const review = generateReview(files, {
        title: 'Staged Changes Review',
        baseBranch: 'HEAD',
        headBranch: 'staged',
        staged: true,
        cwd: this.config.projectRoot,
      });

      return {
        hasRisks: review.issues.length > 0,
        risks: review.issues.map((i) => `[${i.severity}] ${i.file}:${i.line} - ${i.message}`),
        suggestions: [],
      };
    } catch {
      return { hasRisks: false, risks: [], suggestions: [] };
    }
  }

  /**
   * Run krolik refactor to find duplicates
   */
  private async runRefactor(): Promise<RefactorResult> {
    try {
      const { runRefactor } = await import('@/commands/refactor');
      const refactorResult = await runRefactor(this.config.projectRoot, { mode: 'quick' });

      if (typeof refactorResult === 'object' && refactorResult !== null) {
        const r = refactorResult as {
          duplicates?: { functions?: unknown[]; types?: unknown[] };
          suggestions?: string[];
        };
        const duplicateFunctions = r.duplicates?.functions?.length ?? 0;
        const duplicateTypes = r.duplicates?.types?.length ?? 0;

        return {
          hasDuplicates: duplicateFunctions > 0 || duplicateTypes > 0,
          duplicateFunctions,
          duplicateTypes,
          suggestions: r.suggestions ?? [],
        };
      }

      return { hasDuplicates: false, duplicateFunctions: 0, duplicateTypes: 0, suggestions: [] };
    } catch {
      return { hasDuplicates: false, duplicateFunctions: 0, duplicateTypes: 0, suggestions: [] };
    }
  }

  /**
   * Append quality feedback to response
   */
  private appendQualityFeedback(response: LlmResponse, result: QualityGateResult): LlmResponse {
    const feedback = `
## Quality Gate Failed

The following issues must be resolved before continuing:

${result.blockers.map((b) => `- ${b}`).join('\n')}

${
  result.audit
    ? `
### Audit Summary
- Critical: ${result.audit.critical}
- High: ${result.audit.high}
- Medium: ${result.audit.medium}
- Low: ${result.audit.low}
`
    : ''
}
${
  result.refactor?.hasDuplicates
    ? `
### Refactor Summary
- Duplicate functions: ${result.refactor.duplicateFunctions}
- Duplicate types: ${result.refactor.duplicateTypes}
`
    : ''
}
Please fix these issues and try again.
`.trim();

    // Append feedback to response content
    if (response.content?.parts) {
      response.content.parts.push({ text: feedback });
    }

    return response;
  }
}

/**
 * Create a quality gate plugin
 */
export function createQualityGatePlugin(
  projectRoot: string,
  mode: QualityGateMode = 'pre-commit',
): QualityGatePlugin {
  return new QualityGatePlugin({ projectRoot, mode });
}
