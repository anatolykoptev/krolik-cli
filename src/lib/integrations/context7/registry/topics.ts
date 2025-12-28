/**
 * @module lib/integrations/context7/registry/topics
 * @description Topic management for libraries
 *
 * This module provides:
 * - Topic retrieval with usage-based ordering
 * - Topic usage recording for learning
 * - Custom topic addition
 */

import { getCachedTopics, saveTopicToCache, seedDefaultTopics } from './database';
import { DEFAULT_TOPICS } from './defaults';

/**
 * Get recommended topics for a library.
 *
 * Returns topics sorted by usage count (learned behavior).
 * Falls back to default topics if no usage data exists.
 *
 * @param context7Id - Context7 library ID
 * @param limit - Maximum number of topics to return
 * @returns Array of topic strings
 */
export function getTopicsForLibrary(context7Id: string, limit: number = 6): string[] {
  // Ensure defaults are seeded
  seedDefaultTopics();

  const cached = getCachedTopics(context7Id);

  if (cached.length > 0) {
    return cached.slice(0, limit).map((t) => t.topic);
  }

  // Fallback to defaults
  const defaults = DEFAULT_TOPICS.get(context7Id);
  return defaults ? [...defaults].slice(0, limit) : [];
}

/**
 * Record topic usage for learning.
 *
 * Called when a topic is successfully used to fetch docs.
 * Increments usage count for smarter future recommendations.
 *
 * @param context7Id - Context7 library ID
 * @param topic - Topic that was used
 */
export function recordTopicUsage(context7Id: string, topic: string): void {
  saveTopicToCache(context7Id, topic, false);
}

/**
 * Add a custom topic for a library.
 *
 * @param context7Id - Context7 library ID
 * @param topics - Topics to add
 */
export function addTopicsForLibrary(context7Id: string, topics: string[]): void {
  for (const topic of topics) {
    saveTopicToCache(context7Id, topic.trim(), false);
  }
}
