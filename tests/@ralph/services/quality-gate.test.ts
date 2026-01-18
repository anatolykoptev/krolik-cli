import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QualityGateConfig } from '../../../src/lib/@ralph/executor/quality-gate';
import { runQualityGate } from '../../../src/lib/@ralph/executor/quality-gate';

// Mock the reporter module
vi.mock('../../../src/lib/@reporter', () => ({
  generateAIReportFromAnalysis: vi.fn(),
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
    const { generateAIReportFromAnalysis } = await import('../../../src/lib/@reporter');
    vi.mocked(generateAIReportFromAnalysis).mockResolvedValue({
      groups: [],
      summary: { totalIssues: 0 },
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
    const { generateAIReportFromAnalysis } = await import('../../../src/lib/@reporter');
    vi.mocked(generateAIReportFromAnalysis).mockResolvedValue({
      groups: [
        {
          issues: [
            {
              priority: 'critical',
              issue: {
                category: 'security',
                message: 'Critical security issue',
                file: '/test/file.ts',
                line: 10,
              },
            },
          ],
        },
      ],
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
    const { generateAIReportFromAnalysis } = await import('../../../src/lib/@reporter');
    vi.mocked(generateAIReportFromAnalysis).mockRejectedValue(new Error('Audit failed'));

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
    const { generateAIReportFromAnalysis } = await import('../../../src/lib/@reporter');
    vi.mocked(generateAIReportFromAnalysis).mockResolvedValue({
      groups: [
        {
          issues: [
            {
              priority: 'high',
              issue: {
                category: 'type-safety',
                message: 'High priority issue',
                file: '/test/file.ts',
                line: 20,
              },
            },
          ],
        },
      ],
    } as any);

    // pre-commit mode should pass with high issues
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
