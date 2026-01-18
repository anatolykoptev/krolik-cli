/**
 * @module mcp/tools/skills
 * @description krolik_skills_* tools - Manage agent skills (Guardrails)
 */

import * as path from 'node:path';
import { findSkillCandidates, promoteClusterToGuardrail } from '@/lib/@storage/memory/analysis';
import type { MemoryType } from '@/lib/@storage/memory/types';
import {
  createGuardrail,
  deleteGuardrail,
  type GuardrailCategory,
  type GuardrailSeverity,
  getGuardrailsByProject,
} from '@/lib/@storage/ralph';
import { type MCPToolDefinition, PROJECT_PROPERTY } from '../core';
import { formatError, formatMCPError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';

// ============================================================================
// SKILLS LIST TOOL
// ============================================================================

export const skillsListTool: MCPToolDefinition = {
  name: 'krolik_skills_list',
  description: `List active skills (guardrails) for the project.
    
Skills are rules the agent follows to ensure quality, security, and consistency.`,
  template: { when: 'List active skills', params: '`category: "security"`' },
  category: 'context',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      category: {
        type: 'string',
        description: 'Filter by category (security, quality, etc)',
      },
      severity: {
        type: 'string',
        description: 'Filter by severity (critical, high, medium, low)',
      },
    },
  },
  handler: (args, workspaceRoot) => {
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) return resolved.error;

    const projectName = path.basename(resolved.path);

    try {
      const skills = getGuardrailsByProject(projectName, {
        category: args.category as GuardrailCategory,
        severity: args.severity as GuardrailSeverity,
      });

      if (skills.length === 0) {
        return '<skills count="0"><message>No skills found.</message></skills>';
      }

      const lines = [`<skills count="${skills.length}">`];
      for (const skill of skills) {
        const type = (skill.type || 'guardrail').toUpperCase();
        lines.push(
          `  <skill id="${skill.id}" type="${type}" severity="${skill.severity}" category="${skill.category}">`,
        );
        lines.push(`    <title>${skill.title}</title>`);
        lines.push(`  </skill>`);
      }
      lines.push('</skills>');
      return lines.join('\n');
    } catch (error) {
      return formatError(error);
    }
  },
};

// ============================================================================
// SKILLS LEARN TOOL
// ============================================================================

export const skillsLearnTool: MCPToolDefinition = {
  name: 'krolik_skills_learn',
  description: `Teach the agent a new skill (create a guardrail).
    
Use this when you want the agent to remember a rule, pattern, or decision permanently.`,
  template: { when: 'Teach new skill', params: '`title: "Use Zod", type: "pattern"`' },
  category: 'context',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      title: { type: 'string', description: 'Short title of the skill' },
      type: { type: 'string', description: 'Type: pattern, snippet, decision, guardrail' },
      problem: { type: 'string', description: 'Context/Problem description' },
      solution: { type: 'string', description: 'The rule/solution to follow' },
      category: { type: 'string', description: 'Category (quality, security, etc)' },
      severity: { type: 'string', description: 'Severity (critical, high, medium, low)' },
    },
    required: ['title', 'problem', 'solution', 'category'],
  },
  handler: (args, workspaceRoot) => {
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) return resolved.error;
    const projectName = path.basename(resolved.path);

    try {
      const id = createGuardrail({
        project: projectName,
        type: (args.type as MemoryType) || 'pattern',
        category: args.category as GuardrailCategory,
        severity: (args.severity as GuardrailSeverity) || 'medium',
        title: args.title as string,
        problem: args.problem as string,
        solution: args.solution as string,
      });

      return `<skill-learned id="${id}"><message>Skill "${args.title}" learned successfully.</message></skill-learned>`;
    } catch (error) {
      return formatError(error);
    }
  },
};

// ============================================================================
// SKILLS ANALYZE TOOL
// ============================================================================

export const skillsAnalyzeTool: MCPToolDefinition = {
  name: 'krolik_skills_analyze',
  description: `Analyze memory to find recurring patterns and suggest new skills.`,
  template: { when: 'Analyze patterns', params: '' },
  category: 'advanced',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      minCount: { type: 'number', description: 'Minimum repetitions (default: 5)' },
      threshold: { type: 'number', description: 'Similarity threshold 0.0-1.0 (default: 0.6)' },
      auto: { type: 'boolean', description: 'Auto-promote found candidates' },
    },
  },
  handler: (args, workspaceRoot) => {
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) return resolved.error;
    const projectName = path.basename(resolved.path);

    try {
      const candidates = findSkillCandidates(projectName, {
        minCount: args.minCount as number,
        threshold: args.threshold as number,
      });

      if (candidates.length === 0) {
        return '<skill-candidates count="0" />';
      }

      if (args.auto) {
        const results = [];
        for (const cluster of candidates) {
          const id = promoteClusterToGuardrail(projectName, cluster);
          results.push(`<promoted id="${id}" title="${cluster.label}" />`);
        }
        return `<auto-promotion count="${candidates.length}">\n${results.join('\n')}\n</auto-promotion>`;
      }

      const lines = [`<skill-candidates count="${candidates.length}">`];
      for (const c of candidates) {
        lines.push(`  <candidate count="${c.members.length}" score="${c.score.toFixed(2)}">`);
        lines.push(`    <title>${c.label}</title>`);
        lines.push(`    <description>${c.centroid.description}</description>`);
        lines.push(`  </candidate>`);
      }
      lines.push('</skill-candidates>');
      return lines.join('\n');
    } catch (error) {
      return formatError(error);
    }
  },
};

// ============================================================================
// SKILLS DELETE TOOL
// ============================================================================

export const skillsDeleteTool: MCPToolDefinition = {
  name: 'krolik_skills_delete',
  description: `Delete a skill by ID.`,
  template: { when: 'Delete skill', params: '`id: "123"`' },
  category: 'context',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Skill ID' },
    },
    required: ['id'],
  },
  handler: (args) => {
    const id = parseInt(args.id as string, 10);
    if (isNaN(id)) return formatMCPError('E101', { id: args.id });

    try {
      const success = deleteGuardrail(id);
      return success
        ? `<skill-delete status="success" id="${id}" />`
        : `<skill-delete status="error"><message>Skill not found</message></skill-delete>`;
    } catch (error) {
      return formatError(error);
    }
  },
};
