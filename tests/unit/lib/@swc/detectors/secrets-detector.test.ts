/**
 * @module tests/unit/lib/@swc/detectors/secrets-detector
 * @description Tests for secrets detection module
 *
 * NOTE: This file tests security detection patterns.
 * All "secret-like" strings are intentionally fake/placeholder values
 * that match regex patterns for testing purposes only.
 */

import { describe, expect, it } from 'vitest';

import {
  calculateEntropy,
  detectAllSecrets,
  isEnvReference,
  isPlaceholder,
  isTestFile,
  redactSecret,
} from '@/lib/@swc/detectors';

// ============================================================================
// VALIDATOR TESTS
// ============================================================================

describe('calculateEntropy', () => {
  it('should return 0 for empty string', () => {
    expect(calculateEntropy('')).toBe(0);
  });

  it('should return 0 for single character', () => {
    expect(calculateEntropy('a')).toBe(0);
  });

  it('should return higher entropy for random-looking strings', () => {
    const lowEntropy = calculateEntropy('aaaaaaaaaa');
    const highEntropy = calculateEntropy('a1b2c3d4e5');

    expect(highEntropy).toBeGreaterThan(lowEntropy);
  });

  it('should calculate consistent entropy', () => {
    const value = 'abcdefghij';
    const entropy1 = calculateEntropy(value);
    const entropy2 = calculateEntropy(value);

    expect(entropy1).toBe(entropy2);
  });
});

describe('isPlaceholder', () => {
  it('should detect example values', () => {
    expect(isPlaceholder('example_value')).toBe(true);
    expect(isPlaceholder('sample_data')).toBe(true);
  });

  it('should detect placeholder markers', () => {
    expect(isPlaceholder('your_api_key_here')).toBe(true);
    expect(isPlaceholder('my_secret_key')).toBe(true);
  });

  it('should detect test/demo values', () => {
    expect(isPlaceholder('test_token_123')).toBe(true);
    expect(isPlaceholder('demo_password')).toBe(true);
  });

  it('should detect template syntax', () => {
    expect(isPlaceholder('${API_KEY}')).toBe(true);
    expect(isPlaceholder('{{secret}}')).toBe(true);
    expect(isPlaceholder('<your-api-key>')).toBe(true);
  });

  it('should detect common filler patterns', () => {
    expect(isPlaceholder('xxx_placeholder')).toBe(true);
    expect(isPlaceholder('000_default')).toBe(true);
    expect(isPlaceholder('123_starter')).toBe(true);
  });

  it('should not flag normal values', () => {
    expect(isPlaceholder('production_database_url')).toBe(false);
    expect(isPlaceholder('actual_config_value')).toBe(false);
  });
});

describe('isTestFile', () => {
  it('should detect .test.ts files', () => {
    expect(isTestFile('src/utils.test.ts')).toBe(true);
    expect(isTestFile('/project/auth.test.ts')).toBe(true);
  });

  it('should detect .spec.ts files', () => {
    expect(isTestFile('components/Button.spec.ts')).toBe(true);
    expect(isTestFile('/app/api.spec.ts')).toBe(true);
  });

  it('should detect __tests__ directories', () => {
    expect(isTestFile('src/__tests__/utils.ts')).toBe(true);
    expect(isTestFile('/project/__tests__/auth.ts')).toBe(true);
  });

  it('should detect __mocks__ directories', () => {
    expect(isTestFile('src/__mocks__/api.ts')).toBe(true);
  });

  it('should detect test/tests directories', () => {
    expect(isTestFile('/test/utils.ts')).toBe(true);
    expect(isTestFile('/tests/auth.ts')).toBe(true);
  });

  it('should detect fixtures directories', () => {
    // Note: pattern requires '/fixtures/' not just 'fixtures/'
    expect(isTestFile('/fixtures/data.json')).toBe(true);
    expect(isTestFile('src/fixtures/secrets.ts')).toBe(true);
  });

  it('should not flag normal source files', () => {
    expect(isTestFile('src/utils.ts')).toBe(false);
    expect(isTestFile('lib/auth.ts')).toBe(false);
  });
});

describe('isEnvReference', () => {
  it('should detect process.env references', () => {
    expect(isEnvReference('process.env.API_KEY')).toBe(true);
    expect(isEnvReference('process.env.DATABASE_URL')).toBe(true);
  });

  it('should detect template variable syntax', () => {
    expect(isEnvReference('${API_KEY}')).toBe(true);
    expect(isEnvReference('${DATABASE_URL}')).toBe(true);
  });

  it('should detect $ENV references', () => {
    expect(isEnvReference('$ENV:API_KEY')).toBe(true);
  });

  it('should detect import.meta.env', () => {
    expect(isEnvReference('import.meta.env.VITE_API_KEY')).toBe(true);
  });

  it('should not flag literal values', () => {
    expect(isEnvReference('some_literal_value')).toBe(false);
    expect(isEnvReference('hardcoded_string')).toBe(false);
  });
});

describe('redactSecret', () => {
  it('should redact middle of long strings', () => {
    const result = redactSecret('1234567890abcdef');
    expect(result).toContain('1234');
    expect(result).toContain('cdef');
    expect(result).toContain('*');
    expect(result).not.toBe('1234567890abcdef');
  });

  it('should fully redact short strings', () => {
    const result = redactSecret('short');
    expect(result).toBe('*****');
  });

  it('should use custom show chars', () => {
    const result = redactSecret('1234567890abcdefghij', 2);
    expect(result.startsWith('12')).toBe(true);
    expect(result.endsWith('ij')).toBe(true);
  });
});

// ============================================================================
// DETECTION TESTS
// ============================================================================

describe('detectAllSecrets', () => {
  it('should return empty array for short strings', () => {
    const result = detectAllSecrets('short');
    expect(result).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    const result = detectAllSecrets('');
    expect(result).toEqual([]);
  });

  it('should skip placeholder values', () => {
    // These contain placeholder patterns so should be skipped
    const result1 = detectAllSecrets('example_api_key_12345678');
    const result2 = detectAllSecrets('test_secret_value_here');
    const result3 = detectAllSecrets('placeholder_token_demo');

    expect(result1).toEqual([]);
    expect(result2).toEqual([]);
    expect(result3).toEqual([]);
  });

  it('should skip environment variable references', () => {
    const result1 = detectAllSecrets('process.env.SECRET_KEY');
    const result2 = detectAllSecrets('${DATABASE_PASSWORD}');

    expect(result1).toEqual([]);
    expect(result2).toEqual([]);
  });

  describe('Private Keys', () => {
    it('should detect RSA private key headers', () => {
      const rsaHeader = '-----BEGIN RSA PRIVATE KEY-----';
      const result = detectAllSecrets(rsaHeader);

      // Should detect as private key
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.type).toContain('private-key');
      expect(result[0]?.severity).toBe('critical');
    });

    it('should detect SSH private key headers', () => {
      const sshHeader = '-----BEGIN OPENSSH PRIVATE KEY-----';
      const result = detectAllSecrets(sshHeader);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.type).toContain('private-key');
    });
  });

  describe('Database Connection Strings', () => {
    it('should detect PostgreSQL connection strings', () => {
      // Credentials that don't trigger isPlaceholder() but are clearly for testing
      const connStr = 'postgresql://dbadmin:s3cur3P@ss@dbhost.internal:5432/appdb';
      const result = detectAllSecrets(connStr);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.type).toBe('postgres-connection');
    });

    it('should detect MongoDB connection strings', () => {
      // Credentials that don't trigger isPlaceholder() but are clearly for testing
      const connStr = 'mongodb://appuser:m0ng0P@ss@mongo.internal:27017/appdb';
      const result = detectAllSecrets(connStr);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.type).toBe('mongodb-connection');
    });

    it('should detect Redis connection strings', () => {
      const connStr = 'redis://:r3d1sP@ss@redis.internal:6379/0';
      const result = detectAllSecrets(connStr);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.type).toBe('redis-connection');
    });
  });
});
