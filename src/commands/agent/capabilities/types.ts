/**
 * @module commands/agent/capabilities/types
 * @description Types for agent capabilities parsing
 */

import type { AgentCategory } from '../types';

/**
 * Parsed agent capabilities for smart selection
 */
export interface AgentCapabilities {
  /** Agent name (e.g., 'security-auditor') */
  name: string;
  /** Original description from frontmatter */
  description: string;
  /** Agent category */
  category: AgentCategory;
  /** Plugin name */
  plugin: string;

  /** Extracted keywords from description */
  keywords: string[];
  /** Detected tech stack mentions */
  techStack: string[];
  /** Inferred project types this agent is suitable for */
  projectTypes: ('monorepo' | 'single' | 'backend' | 'frontend' | 'fullstack')[];

  /** Model preference */
  model: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  /** Path to agent file */
  filePath: string;
}

/**
 * Capabilities index structure (stored in .krolik/agent-capabilities.json)
 */
export interface CapabilitiesIndex {
  /** Version of the index format */
  version: string;
  /** When the index was generated */
  generatedAt: string;
  /** Source agents path */
  agentsPath: string;
  /** Total agent count */
  totalAgents: number;
  /** Agent capabilities */
  agents: AgentCapabilities[];
}
