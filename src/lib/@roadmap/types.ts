/**
 * @module lib/@roadmap/types
 * @description Roadmap generation types
 */

/**
 * GitHub issue for roadmap
 */
export interface RoadmapIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'OPEN' | 'CLOSED';
  labels: Array<{ name: string }>;
  createdAt: string;
  closedAt: string | null;
}

/**
 * Phase statistics
 */
export interface PhaseStats {
  label: string;
  title: string;
  description?: string;
  emoji?: string;
  done: RoadmapIssue[];
  inProgress: RoadmapIssue[];
  todo: RoadmapIssue[];
  total: number;
  progress: number;
}

/**
 * Overall roadmap statistics
 */
export interface RoadmapStats {
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  progress: number;
}

/**
 * Roadmap generation result
 */
export interface RoadmapResult {
  generated: boolean;
  path: string;
  stats: RoadmapStats;
  phases: PhaseStats[];
  uncategorized: {
    open: RoadmapIssue[];
    closed: RoadmapIssue[];
  };
  error?: string;
}
