/**
 * @module commands/quality/recommendations/rules/security
 * @description Security recommendations
 */

import type { Recommendation } from '../types';

export const SECURITY_RULES: Recommendation[] = [
  {
    id: 'security-no-innerhtml',
    title: 'Avoid dangerouslySetInnerHTML',
    description: 'innerHTML can lead to XSS attacks, use sanitization or alternatives',
    category: 'security',
    severity: 'best-practice',
    pattern: /dangerouslySetInnerHTML/,
  },
  {
    id: 'security-no-hardcoded-secrets',
    title: 'Avoid hardcoded secrets or API keys',
    description: 'Use environment variables for sensitive data',
    category: 'security',
    severity: 'best-practice',
    pattern: /(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]+['"]/i,
  },
  {
    id: 'security-validate-input',
    title: 'Validate user input at boundaries',
    description: 'Always validate and sanitize input from users/external sources',
    category: 'security',
    severity: 'recommendation',
    check: (content, analysis) => {
      if (analysis.fileType !== 'router') return false;
      const hasInput = content.includes('.input(') || content.includes('req.body');
      const hasValidation = content.includes('z.') || content.includes('yup.') || content.includes('validate');
      return hasInput && !hasValidation;
    },
  },
  {
    id: 'security-https-only',
    title: 'Use HTTPS for external URLs',
    description: 'Avoid HTTP URLs, use HTTPS for secure communication',
    category: 'security',
    severity: 'recommendation',
    pattern: /['"]http:\/\/(?!localhost|127\.0\.0\.1)/,
  },
  {
    id: 'security-no-exec',
    title: 'Avoid executing shell commands with user input',
    description: 'Shell injection is a critical security risk',
    category: 'security',
    severity: 'best-practice',
    pattern: /(?:exec|spawn|execSync)\s*\([^)]*\$\{/,
  },
  {
    id: 'security-sql-injection',
    title: 'Use parameterized queries',
    description: 'Avoid string concatenation in SQL queries',
    category: 'security',
    severity: 'best-practice',
    pattern: /(?:query|execute)\s*\(\s*[`'"].*\$\{/,
  },
];
