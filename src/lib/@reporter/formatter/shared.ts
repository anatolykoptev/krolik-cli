/**
 * @module lib/@reporter/formatter/shared
 * @description Shared utilities for formatters
 */

import type { TypeContext } from '../../../commands/audit/suggestions';
import { escapeXml } from '../../@core/xml/escape';
import type { ActionStep, PriorityLevel } from '../types';

// ============================================================================
// ICONS & LABELS
// ============================================================================

/**
 * Get icon for priority level
 */
export function getPriorityIcon(priority: PriorityLevel): string {
  const icons: Record<PriorityLevel, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };
  return icons[priority];
}

/**
 * Get icon for action type
 */
export function getActionIcon(action: ActionStep['action']): string {
  const icons: Record<ActionStep['action'], string> = {
    fix: '🔧',
    refactor: '🔄',
    review: '👀',
    skip: '⏭️',
  };
  return icons[action];
}

// ============================================================================
// IMPACT FORMATTER
// ============================================================================

/**
 * Format percentile as human-readable rank
 */
export function formatChangeRank(percentile: number): string {
  if (percentile >= 95) return 'top-5%';
  if (percentile >= 90) return 'top-10%';
  if (percentile >= 80) return 'top-20%';
  if (percentile >= 50) return 'top-50%';
  return 'bottom-50%';
}

/**
 * Format ImpactScore as XML for issue enrichment
 */
export function formatImpactXml(
  impact: {
    dependents: number;
    bugHistory: number;
    changeFrequency: number;
    percentile: number;
    riskLevel: string;
    dependentFiles?: string[];
    riskReason?: string;
  },
  indent = 0,
): string[] {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];

  if (impact.dependentFiles || impact.riskReason) {
    lines.push(`${pad}<impact dependents="${impact.dependents}" risk="${impact.riskLevel}">`);

    if (impact.dependentFiles && impact.dependentFiles.length > 0) {
      lines.push(`${pad}  <top-dependents>`);
      for (const file of impact.dependentFiles.slice(0, 5)) {
        lines.push(`${pad}    <file>${escapeXml(file)}</file>`);
      }
      lines.push(`${pad}  </top-dependents>`);
    }

    if (impact.riskReason) {
      lines.push(`${pad}  <risk-reason>${escapeXml(impact.riskReason)}</risk-reason>`);
    }

    lines.push(`${pad}</impact>`);
  } else {
    const changeRank = formatChangeRank(impact.percentile);

    lines.push(`${pad}<impact>`);
    lines.push(`${pad}  <dependents count="${impact.dependents}"/>`);
    lines.push(`${pad}  <bug-history count="${impact.bugHistory}" period="30d"/>`);
    lines.push(`${pad}  <change-frequency rank="${changeRank}"/>`);
    lines.push(`${pad}</impact>`);
    lines.push(`${pad}<risk>${impact.riskLevel}</risk>`);
  }

  return lines;
}

// ============================================================================
// SUGGESTION FORMATTER
// ============================================================================

/**
 * Format a Suggestion as XML with before/after and reasoning
 */
export function formatSuggestionXml(
  suggestion: {
    before: string;
    after: string;
    reasoning: string;
    confidence: number;
    typeContext?: TypeContext | undefined;
  },
  indent = 0,
): string[] {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];

  lines.push(`${pad}<suggestion confidence="${suggestion.confidence}%">`);
  lines.push(`${pad}  <before><![CDATA[${suggestion.before}]]></before>`);
  lines.push(`${pad}  <after><![CDATA[${suggestion.after}]]></after>`);
  lines.push(`${pad}  <reasoning>${escapeXml(suggestion.reasoning)}</reasoning>`);

  if (suggestion.typeContext) {
    const tc = suggestion.typeContext;
    lines.push(
      `${pad}  <type-inference inferred="${escapeXml(tc.inferredType)}" confidence="${tc.confidence}%">`,
    );
    if (tc.evidence.length > 0) {
      lines.push(`${pad}    <evidence>`);
      for (const e of tc.evidence.slice(0, 5)) {
        const lineAttr = e.line ? ` line="${e.line}"` : '';
        lines.push(
          `${pad}      <usage type="${e.type}"${lineAttr}>${escapeXml(e.description)}</usage>`,
        );
      }
      if (tc.evidence.length > 5) {
        lines.push(`${pad}      <!-- ... and ${tc.evidence.length - 5} more usages -->`);
      }
      lines.push(`${pad}    </evidence>`);
    }
    lines.push(`${pad}  </type-inference>`);
  }

  lines.push(`${pad}</suggestion>`);

  return lines;
}
