/**
 * @module cli/commands/skills
 * @description Skill command registration
 */

import type { Command } from 'commander';
import type { GuardrailCategory, GuardrailSeverity } from '@/lib/@storage/felix';
import type { MemoryType } from '@/lib/@storage/memory/types';
import { addProjectOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext, handleProjectOption } from './helpers';

/**
 * Register skills command
 */
export function registerSkillsCommand(program: Command): void {
  const skills = program
    .command('skills')
    .alias('skill')
    .alias('guardrails')
    .description('Manage agent skills and guardrails');

  addProjectOption(skills);

  // krolik skills list
  const listCmd = skills
    .command('list')
    .description('List skills for the project')
    .option('--category <category>', 'Filter by category')
    .option('--severity <severity>', 'Filter by severity')
    .action(async (options: CommandOptions) => {
      const { runSkillList } = await import('../../commands/skills');
      handleProjectOption(options);
      const ctx = await createContext(program, options);

      await runSkillList({
        ...ctx,
        options: {
          category: options.category as GuardrailCategory,
          severity: options.severity as GuardrailSeverity,
        },
      });
    });

  addProjectOption(listCmd);

  // krolik skills analyze
  const analyzeCmd = skills
    .command('analyze')
    .description('Analyze memory for skill candidates (> 5 repetitions)')
    .option('--min-count <n>', 'Minimum repetition count', '5')
    .option('--threshold <n>', 'Similarity threshold (0.0-1.0)', '0.6')
    .option('--auto', 'Auto-promote all found candidates (non-interactive)')
    .action(async (options: CommandOptions) => {
      const { runSkillAnalyze } = await import('../../commands/skills');
      handleProjectOption(options);
      const ctx = await createContext(program, options);

      await runSkillAnalyze({
        ...ctx,
        options: {
          minCount: Number(options.minCount),
          threshold: Number(options.threshold),
          auto: !!options.auto,
        },
      });
    });

  addProjectOption(analyzeCmd);

  // krolik skills learn
  const learnCmd = skills
    .command('learn')
    .description('Teach the agent a new skill')
    .argument('<title>', 'Title of the skill ("Don\'t use any")')
    .option('--type <type>', 'Type of skill (pattern, snippet, rule)', 'pattern')
    .requiredOption('--problem <text>', 'Problem description')
    .requiredOption('--solution <text>', 'Solution description')
    .requiredOption(
      '--category <category>',
      'Category (security, performance, architecture, quality, etc)',
    )
    .option('--severity <severity>', 'Severity (critical, high, medium, low)', 'high')
    .option('--example <code...>', 'Code example')
    .action(async (title: string, options: CommandOptions) => {
      const { runSkillLearn } = await import('../../commands/skills');
      handleProjectOption(options);
      const ctx = await createContext(program, options);

      await runSkillLearn({
        ...ctx,
        options: {
          title,
          type: options.type as MemoryType,
          problem: options.problem as string,
          solution: options.solution as string,
          category: options.category as GuardrailCategory,
          severity: options.severity as GuardrailSeverity,
          example: options.example as string,
        },
      });
    });

  addProjectOption(learnCmd);

  // krolik skills delete
  const deleteCmd = skills
    .command('delete')
    .description('Delete a skill')
    .argument('<id>', 'Skill ID')
    .action(async (id: string, options: CommandOptions) => {
      const { runSkillDelete } = await import('../../commands/skills');
      handleProjectOption(options);
      const ctx = await createContext(program, options);

      await runSkillDelete({
        ...ctx,
        options: { id },
      });
    });

  addProjectOption(deleteCmd);
}
