/**
 * @module commands/skills/analyze
 * @description Analyze memories to find potential skills (AI-First, no interactive menus)
 */

import path from 'node:path';
import { findSkillCandidates, promoteClusterToGuardrail } from '../../lib/@storage/memory/analysis';
import type { CommandContext } from '../../types/commands/base';

/**
 * Run skill analyze command
 */
export async function runSkillAnalyze(
  ctx: CommandContext & {
    options: {
      minCount?: number;
      threshold?: number;
      auto?: boolean;
    };
  },
): Promise<void> {
  const { config, options } = ctx;
  const project = path.basename(config.projectRoot);

  const candidates = findSkillCandidates(project, {
    ...(options.minCount !== undefined && { minCount: options.minCount }),
    ...(options.threshold !== undefined && { threshold: options.threshold }),
  });

  if (candidates.length === 0) {
    console.log('<skill-candidates count="0" />');
    return;
  }

  // Auto-promotion (if requested)
  if (options.auto) {
    console.log(`<auto-promotion count="${candidates.length}">`);
    for (const cluster of candidates) {
      const id = promoteClusterToGuardrail(project, cluster);
      console.log(`  <promoted id="${id}" title="${cluster.label}" />`);
    }
    console.log('</auto-promotion>');
    return;
  }

  // XML Output for AI Analysis
  console.log(`<skill-candidates count="${candidates.length}">`);
  candidates.forEach((cluster) => {
    console.log(
      `  <candidate count="${cluster.members.length}" score="${cluster.score.toFixed(2)}">`,
    );
    console.log(`    <title><![CDATA[${cluster.label}]]></title>`);
    console.log(`    <description><![CDATA[${cluster.centroid.description}]]></description>`);
    console.log(`    <importance>${cluster.centroid.importance}</importance>`);
    console.log(`    <tags>${cluster.centroid.tags.join(',')}</tags>`);
    console.log('  </candidate>');
  });
  console.log('</skill-candidates>');
}
