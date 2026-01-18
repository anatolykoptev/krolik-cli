/**
 * @module commands/skills
 * @description Agent skills management (Ralph Guardrails wrapper)
 */

import path from 'node:path';
import chalk from 'chalk';
import {
  createGuardrail,
  deleteGuardrail,
  type GuardrailCategory,
  type GuardrailSeverity,
  getGuardrailsByProject,
} from '@/lib/@storage/felix';
import type { MemoryType } from '../../lib/@storage/memory/types';
import type { CommandContext } from '../../types/commands/base';

/**
 * Run skill learn command
 */
export async function runSkillLearn(
  ctx: CommandContext & {
    options: {
      title: string;
      type?: MemoryType;
      problem: string;
      solution: string;
      category: GuardrailCategory;
      severity: GuardrailSeverity;
      example?: string;
    };
  },
): Promise<void> {
  const { config, options } = ctx;
  const project = path.basename(config.projectRoot);

  const id = createGuardrail({
    project,
    category: options.category,
    severity: options.severity,
    title: options.title,
    problem: options.problem,
    solution: options.solution,
    tags: [],
    ...(options.type !== undefined && { type: options.type }),
    ...(options.example !== undefined && { example: options.example }),
  });

  console.log(chalk.green(`✓ Skill learned! (ID: ${id})`));
  console.log(`Agent will now follow: "${options.title}"`);
}

/**
 * Run skill list command
 */
export async function runSkillList(
  ctx: CommandContext & {
    options: {
      category?: GuardrailCategory;
      severity?: GuardrailSeverity;
    };
  },
): Promise<void> {
  const { config, options } = ctx;
  const project = path.basename(config.projectRoot);

  const skills = getGuardrailsByProject(project, {
    ...(options.category !== undefined && { category: options.category }),
    ...(options.severity !== undefined && { severity: options.severity }),
  });

  if (skills.length === 0) {
    console.log('No skills found.');
    return;
  }

  const lines = ['ID | Type | Sev | Title'];
  lines.push('---|------|-----|------');

  for (const skill of skills) {
    const type = (skill.type || 'rule').substring(0, 4).toUpperCase();
    let sev = 'INFO';
    if (skill.severity === 'critical') sev = 'CRIT';
    else if (skill.severity === 'high') sev = 'HIGH';
    else if (skill.severity === 'medium') sev = 'MED';
    else if (skill.severity === 'low') sev = 'LOW';
    else if (skill.severity === 'error') sev = 'ERR';
    else if (skill.severity === 'warning') sev = 'WARN';

    lines.push(`${skill.id} | ${type} | ${sev} | ${skill.title}`);
  }

  console.log(lines.join('\n'));
}

/**
 * Run skill delete command
 */
export async function runSkillDelete(
  ctx: CommandContext & { options: { id: string } },
): Promise<void> {
  const { options } = ctx;
  const id = Number(options.id);

  const success = deleteGuardrail(id);

  if (success) {
    console.log(chalk.green(`✓ Skill #${id} deleted.`));
  } else {
    console.log(chalk.red(`✗ Skill #${id} not found.`));
    process.exitCode = 1;
  }
}

// Re-export specific helpers if needed by other modules (e.g. context)
export { createGuardrail, deleteGuardrail, getGuardrailsByProject };
export { runSkillAnalyze } from './analyze';
