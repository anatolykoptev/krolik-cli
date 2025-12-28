/**
 * @module tests/unit/lib/@patterns/verb-detection.test
 * @description Unit tests for linguistic verb detection
 */

import { describe, expect, it } from 'vitest';
import {
  extractVerbPrefix,
  groupByVerbPrefix,
  isActionVerbName,
  isEventHandlerName,
  isVerbLike,
} from '../../../../src/lib/@patterns/verb-detection';

describe('verb-detection', () => {
  describe('isVerbLike', () => {
    it('should detect common programming verbs', () => {
      expect(isVerbLike('get')).toBe(true);
      expect(isVerbLike('set')).toBe(true);
      expect(isVerbLike('fetch')).toBe(true);
      expect(isVerbLike('create')).toBe(true);
      expect(isVerbLike('update')).toBe(true);
      expect(isVerbLike('delete')).toBe(true);
      expect(isVerbLike('handle')).toBe(true);
      expect(isVerbLike('validate')).toBe(true);
      expect(isVerbLike('parse')).toBe(true);
      expect(isVerbLike('format')).toBe(true);
    });

    it('should detect verbs with morphological endings', () => {
      expect(isVerbLike('create')).toBe(true); // -ate ending
      expect(isVerbLike('generate')).toBe(true); // -ate ending
      expect(isVerbLike('validate')).toBe(true); // -ate ending
      expect(isVerbLike('stringify')).toBe(true); // -ify ending
      expect(isVerbLike('modify')).toBe(true); // -ify ending
      expect(isVerbLike('normalize')).toBe(true); // -ize ending
      expect(isVerbLike('serialize')).toBe(true); // -ize ending
    });

    it('should reject nouns and non-verbs', () => {
      expect(isVerbLike('user')).toBe(false);
      expect(isVerbLike('config')).toBe(false);
      expect(isVerbLike('data')).toBe(false);
      expect(isVerbLike('profile')).toBe(false);
    });

    it('should reject words that are too short or too long', () => {
      expect(isVerbLike('a')).toBe(false); // too short
      expect(isVerbLike('somethingverylongthatisnotaverb')).toBe(false); // too long
    });

    it('should reject empty and invalid inputs', () => {
      expect(isVerbLike('')).toBe(false);
      expect(isVerbLike(null as unknown as string)).toBe(false);
      expect(isVerbLike(undefined as unknown as string)).toBe(false);
    });
  });

  describe('extractVerbPrefix', () => {
    it('should extract verb prefixes from camelCase names', () => {
      expect(extractVerbPrefix('getUser')).toBe('get');
      expect(extractVerbPrefix('setName')).toBe('set');
      expect(extractVerbPrefix('fetchData')).toBe('fetch');
      expect(extractVerbPrefix('createAccount')).toBe('create');
      expect(extractVerbPrefix('updateProfile')).toBe('update');
      expect(extractVerbPrefix('deleteRecord')).toBe('delete');
      expect(extractVerbPrefix('handleSubmit')).toBe('handle');
      expect(extractVerbPrefix('validateInput')).toBe('validate');
      expect(extractVerbPrefix('parseJSON')).toBe('parse');
      expect(extractVerbPrefix('formatDate')).toBe('format');
    });

    it('should extract verb prefixes from multi-word names', () => {
      expect(extractVerbPrefix('getUserById')).toBe('get');
      expect(extractVerbPrefix('createNewAccount')).toBe('create');
      expect(extractVerbPrefix('validateUserInput')).toBe('validate');
    });

    it('should detect event handler pattern (on prefix)', () => {
      expect(extractVerbPrefix('onClick')).toBe('on');
      expect(extractVerbPrefix('onSubmit')).toBe('on');
      expect(extractVerbPrefix('onUserChange')).toBe('on');
    });

    it('should return null for non-verb prefixes', () => {
      expect(extractVerbPrefix('userProfile')).toBe(null);
      expect(extractVerbPrefix('configData')).toBe(null);
      expect(extractVerbPrefix('AuthProvider')).toBe(null);
    });

    it('should handle edge cases', () => {
      expect(extractVerbPrefix('')).toBe(null);
      expect(extractVerbPrefix(null as unknown as string)).toBe(null);
      expect(extractVerbPrefix(undefined as unknown as string)).toBe(null);
    });
  });

  describe('groupByVerbPrefix', () => {
    it('should group function names by verb prefix', () => {
      const names = ['getUser', 'setUser', 'getProfile', 'deleteUser'];
      const groups = groupByVerbPrefix(names);

      expect(groups.get('get')).toEqual(['getUser', 'getProfile']);
      expect(groups.get('set')).toEqual(['setUser']);
      expect(groups.get('delete')).toEqual(['deleteUser']);
    });

    it('should put names without verb prefix in misc group', () => {
      const names = ['getUser', 'userProfile', 'configData'];
      const groups = groupByVerbPrefix(names);

      expect(groups.get('get')).toEqual(['getUser']);
      expect(groups.get('misc')).toEqual(['userProfile', 'configData']);
    });

    it('should handle empty array', () => {
      const groups = groupByVerbPrefix([]);
      expect(groups.size).toBe(0);
    });
  });

  describe('isActionVerbName', () => {
    it('should return true for action verb names', () => {
      expect(isActionVerbName('getUser')).toBe(true);
      expect(isActionVerbName('createAccount')).toBe(true);
      expect(isActionVerbName('deleteRecord')).toBe(true);
    });

    it('should return false for event handlers', () => {
      expect(isActionVerbName('onClick')).toBe(false);
      expect(isActionVerbName('onSubmit')).toBe(false);
    });

    it('should return false for non-verb names', () => {
      expect(isActionVerbName('userProfile')).toBe(false);
      expect(isActionVerbName('configData')).toBe(false);
    });
  });

  describe('isEventHandlerName', () => {
    it('should return true for event handler names', () => {
      expect(isEventHandlerName('onClick')).toBe(true);
      expect(isEventHandlerName('onSubmit')).toBe(true);
      expect(isEventHandlerName('onUserChange')).toBe(true);
    });

    it('should return false for action verb names', () => {
      expect(isEventHandlerName('getUser')).toBe(false);
      expect(isEventHandlerName('createAccount')).toBe(false);
    });

    it('should return false for non-verb names', () => {
      expect(isEventHandlerName('userProfile')).toBe(false);
    });
  });
});
