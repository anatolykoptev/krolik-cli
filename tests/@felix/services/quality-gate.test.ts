import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QualityGateConfig } from '../../../src/lib/@felix/executor/quality-gate';
import { runQualityGate } from '../../../src/lib/@felix/executor/quality-gate';

// Mock the analyze module
vi.mock('../../../src/commands/fix/analyze', () => ({
  analyzeQuality: vi.fn(),
}));

// Mock the filterByIntent - return issues as-is for testing
vi.mock('../../../src/commands/audit/filters/intent', () => ({
  filterByIntent: vi.fn((issues) => issues),
}));

describe('runQualityGate', () => {
  const mockProjectRoot = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return passed=true when disabled', async () => {
    const config: QualityGateConfig = {
      enabled: false,
      auditMode: 'pre-commit',
      failOnIssues: true,
    };

    const result = await runQualityGate(mockProjectRoot, config);

    expect(result).toEqual({
      passed: true,
      issues: [],
      summary: {
        totalIssues: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        duration: 0,
      },
    });
  });

  it('should handle successful audit with no issues', async () => {
    const { analyzeQuality } = await import('../../../src/commands/fix/analyze');
    vi.mocked(analyzeQuality).mockResolvedValue({
      report: {
        files: [],
      },
    } as any);

    const config: QualityGateConfig = {
      enabled: true,
      auditMode: 'pre-commit',
      failOnIssues: true,
    };

    const result = await runQualityGate(mockProjectRoot, config);

    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.summary.totalIssues).toBe(0);
  });

  it('should handle successful audit with critical issues in pre-commit mode', async () => {
    const { analyzeQuality } = await import('../../../src/commands/fix/analyze');
    vi.mocked(analyzeQuality).mockResolvedValue({
      report: {
        files: [
          {
            issues: [
              {
                category: 'security',
                message: 'Critical security issue',
                file: '/test/file.ts',
                line: 10,
              },
            ],
          },
        ],
      },
    } as any);

    const config: QualityGateConfig = {
      enabled: true,
      auditMode: 'pre-commit',
      failOnIssues: true,
    };

    const result = await runQualityGate(mockProjectRoot, config);

    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('critical');
    expect(result.summary.critical).toBe(1);
  });

  it('should handle audit errors gracefully', async () => {
    const { analyzeQuality } = await import('../../../src/commands/fix/analyze');
    vi.mocked(analyzeQuality).mockRejectedValue(new Error('Audit failed'));

    const config: QualityGateConfig = {
      enabled: true,
      auditMode: 'pre-commit',
      failOnIssues: true,
      onError: 'fail-open',
    };

    const result = await runQualityGate(mockProjectRoot, config);

    expect(result.passed).toBe(true); // Should pass on error as per acceptance criteria
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].category).toBe('quality-gate');
    expect(result.issues[0].message).toContain('Quality gate execution failed');
  });

  it('should respect different audit modes for failOnIssues', async () => {
    const { analyzeQuality } = await import('../../../src/commands/fix/analyze');
    vi.mocked(analyzeQuality).mockResolvedValue({
      report: {
        files: [
          {
            issues: [
              {
                category: 'type-safety',
                message: 'High priority issue',
                file: '/test/file.ts',
                line: 20,
              },
            ],
          },
        ],
      },
    } as any);

    // pre-commit mode should pass with high issues (only critical fails)
    const preCommitConfig: QualityGateConfig = {
      enabled: true,
      auditMode: 'pre-commit',
      failOnIssues: true,
    };

    const preCommitResult = await runQualityGate(mockProjectRoot, preCommitConfig);
    expect(preCommitResult.passed).toBe(true);

    // release mode should fail with high issues
    const releaseConfig: QualityGateConfig = {
      enabled: true,
      auditMode: 'release',
      failOnIssues: true,
    };

    const releaseResult = await runQualityGate(mockProjectRoot, releaseConfig);
    expect(releaseResult.passed).toBe(false);
  });
});
