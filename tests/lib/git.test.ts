import { describe, expect, it } from 'vitest';
import {
  getCurrentBranch,
  getDefaultBranch,
  getRecentCommits,
  getStatus,
  isGitRepo,
} from '../../src/lib';

describe('git', () => {
  // These tests run in the krolik-cli directory which is a git repo
  const cwd = process.cwd();

  describe('isGitRepo', () => {
    it('should return true for git repository', () => {
      expect(isGitRepo(cwd)).toBe(true);
    });

    it('should return false for non-git directory', () => {
      expect(isGitRepo('/tmp')).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return branch name for git repo', () => {
      const branch = getCurrentBranch(cwd);
      expect(branch).toBeTruthy();
      expect(typeof branch).toBe('string');
    });

    it('should return null for non-git directory', () => {
      const branch = getCurrentBranch('/tmp');
      expect(branch).toBeNull();
    });
  });

  describe('getDefaultBranch', () => {
    it('should return main or master', () => {
      const branch = getDefaultBranch(cwd);
      expect(['main', 'master']).toContain(branch);
    });
  });

  describe('getStatus', () => {
    it('should return status object', () => {
      const status = getStatus(cwd);
      expect(status).toHaveProperty('modified');
      expect(status).toHaveProperty('untracked');
      expect(status).toHaveProperty('staged');
      expect(status).toHaveProperty('hasChanges');
      expect(Array.isArray(status.modified)).toBe(true);
      expect(Array.isArray(status.untracked)).toBe(true);
      expect(Array.isArray(status.staged)).toBe(true);
    });
  });

  describe('getRecentCommits', () => {
    it('should return array of commits', () => {
      const commits = getRecentCommits(3, cwd);
      expect(Array.isArray(commits)).toBe(true);
      expect(commits.length).toBeLessThanOrEqual(3);

      if (commits.length > 0) {
        expect(commits[0]).toHaveProperty('hash');
        expect(commits[0]).toHaveProperty('message');
      }
    });
  });
});
