/**
 * @module commands/context/formatters/ai
 * @description AI-friendly XML formatter for context output
 */

import type { AiContextData } from "../../types";
import { getDomainKeywords } from "../../../../lib/domains";
import {
  formatTaskSection,
  formatGitSection,
  formatTreeSection,
  formatSchemaSection,
  formatRoutesSection,
  formatFilesSection,
  formatIoSchemasSection,
  formatComponentsSection,
  formatTestsSection,
  formatHintsSection,
  formatApproachSection,
  formatPreCommitSection,
  formatQualitySection,
  formatTypesSection,
  formatImportsSection,
} from "./sections";

/**
 * Format context as AI-ready structured XML prompt
 */
export function formatAiPrompt(data: AiContextData): string {
  const lines: string[] = [];
  const domainKeywords = getDomainKeywords(data.context.domains, data.config);

  lines.push("<context>");

  // Core sections
  formatTaskSection(lines, data);
  formatGitSection(lines, data);
  formatTreeSection(lines, data);

  // Data sections (filtered by keywords)
  formatSchemaSection(lines, data, domainKeywords);
  formatRoutesSection(lines, data, domainKeywords);
  formatFilesSection(lines, data);
  formatIoSchemasSection(lines, data);

  // TypeScript types and dependencies
  formatTypesSection(lines, data);
  formatImportsSection(lines, data);

  // Detail sections
  formatComponentsSection(lines, data);
  formatTestsSection(lines, data);
  formatHintsSection(lines, data);
  formatApproachSection(lines, data);

  // Quality issues (from --with-audit)
  formatQualitySection(lines, data);

  formatPreCommitSection(lines);

  lines.push("</context>");
  lines.push("");
  lines.push("<!-- Copy this context to Claude/GPT for AI-assisted development -->");

  return lines.join("\n");
}
