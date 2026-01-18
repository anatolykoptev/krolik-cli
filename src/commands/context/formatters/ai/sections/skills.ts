/**
 * @module commands/context/formatters/ai/sections/skills
 * @description Agent skills section formatter
 */

import type { AiContextData } from '../../../types';

/**
 * Format agent skills section
 */
export function formatSkillsSection(lines: string[], data: AiContextData): void {
  if (!data.skills || data.skills.length === 0) {
    return;
  }

  lines.push('  <agent-skills>');

  // Group by category
  const byCategory: Record<string, typeof data.skills> = {};
  for (const skill of data.skills) {
    const cat = skill.category;
    if (!byCategory[cat]) {
      byCategory[cat] = [];
    }
    byCategory[cat]!.push(skill);
  }

  for (const [category, skills] of Object.entries(byCategory)) {
    lines.push(`    <category name="${category}">`);
    for (const skill of skills) {
      lines.push(`      <skill severity="${skill.severity}" title="${skill.title}">`);

      lines.push(`        <problem>`);
      lines.push(`          <![CDATA[${skill.problem.trim()}]]>`);
      lines.push(`        </problem>`);

      lines.push(`        <solution>`);
      lines.push(`          <![CDATA[${skill.solution.trim()}]]>`);
      lines.push(`        </solution>`);

      if (skill.example) {
        lines.push(`        <example>`);
        lines.push(`          <![CDATA[${skill.example.trim()}]]>`);
        lines.push(`        </example>`);
      }

      lines.push(`      </skill>`);
    }
    lines.push(`    </category>`);
  }

  lines.push('  </agent-skills>');
}
