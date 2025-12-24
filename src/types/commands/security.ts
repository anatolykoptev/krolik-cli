/**
 * @module types/commands/security
 * @description Security audit result types
 */

/**
 * Security vulnerability from npm audit
 */
export interface SecurityVulnerability {
  package: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  path: string;
  fixAvailable: boolean;
}

/**
 * Security issue in code
 */
export interface SecurityCodeIssue {
  file: string;
  line: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  pattern: string;
  message: string;
  suggestion?: string;
}

/**
 * Security audit result
 */
export interface SecurityResult {
  vulnerabilities: SecurityVulnerability[];
  codeIssues: SecurityCodeIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}
