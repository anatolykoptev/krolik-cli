/**
 * @module lib/@claude/sections/providers/roadmap
 * @description Roadmap link section provider
 *
 * Shows a link to the auto-generated roadmap file when roadmap.auto is enabled.
 */

import { getConfig } from '@/config/loader';
import type { SectionContext, SectionProvider, SectionResult } from '../types';
import { SectionPriority } from '../types';

/**
 * Roadmap link section provider
 *
 * Priority 250 - renders after context-cache, before sub-docs
 */
export const roadmapProvider: SectionProvider = {
  id: 'roadmap',
  name: 'Roadmap Link',
  priority: SectionPriority.ROADMAP,

  shouldRender(): boolean {
    try {
      const config = getConfig();
      return !!config.roadmap?.auto && !!config.roadmap?.output;
    } catch {
      return false;
    }
  },

  render(_ctx: SectionContext): SectionResult {
    const config = getConfig();
    const roadmapConfig = config.roadmap;

    if (!roadmapConfig?.output) {
      return { content: '', skip: true };
    }

    const outputPath = roadmapConfig.output;
    const title = roadmapConfig.projectTitle ?? 'Project Roadmap';

    return {
      content: `### Roadmap

📊 **${title}:** [${outputPath}](${outputPath})

Auto-generated from GitHub Issues. Refresh: \`krolik_status\``,
    };
  },
};
