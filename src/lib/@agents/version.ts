/**
 * @module lib/@agents/version
 * @description Version utilities for agents repository
 */

import { getGitVersion, type VersionInfo } from '../@git';
import { getAgentsHome } from './paths';

export type { VersionInfo };

/**
 * Get agents version info from git
 */
export function getAgentsVersion(): VersionInfo | null {
  return getGitVersion(getAgentsHome());
}
