/**
 * @module lib/@roadmap
 * @description Roadmap generation from GitHub issues
 *
 * Auto-generates ROADMAP.md from GitHub issues when enabled in config.
 * Triggered automatically by `krolik status` when roadmap.auto is true.
 */

export { generateRoadmap, needsRoadmapRefresh } from './generator';
export type {
  PhaseStats,
  RoadmapIssue,
  RoadmapResult,
  RoadmapStats,
} from './types';
