/**
 * @module commands/context/sections/skills
 * @description Agent skills (Guardrails) section provider
 */

import { basename } from 'node:path';
import { type FelixGuardrail, getRelevantGuardrails } from '@/lib/@storage/felix';

/**
 * Load relevant skills (guardrails)
 */
export function loadSkills(projectRoot: string, domains: string[] = []): FelixGuardrail[] {
  try {
    const projectName = basename(projectRoot);
    // Fetch guardrails relevant to the project and domains
    // We use a high limit to get a good set of skills
    return getRelevantGuardrails(projectName, domains, 20);
  } catch (error) {
    if (process.env.DEBUG) {
      console.error('Failed to load skills:', error);
    }
    return [];
  }
}

/**
 * Format skills for AI context
 */
export function formatSkills(skills: FelixGuardrail[]): string {
  if (skills.length === 0) return '';

  const sections: string[] = [];

  // Group by category for better organization
  const byCategory: Record<string, FelixGuardrail[]> = {};

  for (const skill of skills) {
    const cat = skill.category;
    if (!byCategory[cat]) {
      byCategory[cat] = [];
    }
    byCategory[cat]!.push(skill);
  }

  sections.push('## Agent Skills & Guidelines');
  sections.push('Follow these project-specific guardrails and patterns:');
  sections.push('');

  for (const [category, categorySkills] of Object.entries(byCategory)) {
    sections.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}`);

    for (const skill of categorySkills) {
      const severityIcon =
        skill.severity === 'error' ? 'Pb' : skill.severity === 'warning' ? 'WARN' : 'INFO';
      sections.push(`- **[${severityIcon}] ${skill.title}**`);
      sections.push(`  Problem: ${skill.problem}`);
      sections.push(`  Solution: ${skill.solution}`);
      if (skill.example) {
        sections.push(`  Example: \`${skill.example}\``);
      }
      sections.push('');
    }
  }

  return sections.join('\n');
}
