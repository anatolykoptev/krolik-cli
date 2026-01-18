/**
 * GitPlugin - Git operations after successful runs
 *
 * Auto-commits changes on task success and detects secrets in changes.
 *
 * @module @ralph/plugins/git-plugin
 */

import { execSync } from 'node:child_process';
import type { InvocationContext } from '@google/adk';
import { BasePlugin } from '@google/adk';

export interface GitPluginConfig {
  projectRoot: string;
  autoCommit?: boolean;
  commitPrefix?: string;
  detectSecrets?: boolean;
  secretPatterns?: RegExp[];
}

export interface GitCommitResult {
  committed: boolean;
  hash?: string;
  files: string[];
  error?: string;
}

export interface SecretDetection {
  file: string;
  line: number;
  pattern: string;
  snippet: string;
}

// Common secret patterns
const DEFAULT_SECRET_PATTERNS: RegExp[] = [
  /(?:api[_-]?key|apikey)\s*[=:]\s*['"][a-zA-Z0-9]{20,}/i,
  /(?:secret|password|passwd|pwd)\s*[=:]\s*['"][^'"]{8,}/i,
  /(?:token|bearer)\s*[=:]\s*['"][a-zA-Z0-9_-]{20,}/i,
  /(?:sk|pk)[-_](?:live|test)[-_][a-zA-Z0-9]{20,}/i, // Stripe keys
  /ghp_[a-zA-Z0-9]{36}/, // GitHub PAT
  /gho_[a-zA-Z0-9]{36}/, // GitHub OAuth
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/, // AWS Access Key
];

export class GitPlugin extends BasePlugin {
  private config: Required<GitPluginConfig>;

  constructor(config: GitPluginConfig) {
    super('git');
    this.config = {
      autoCommit: false,
      commitPrefix: '[ralph]',
      detectSecrets: true,
      secretPatterns: DEFAULT_SECRET_PATTERNS,
      ...config,
    };
  }

  /**
   * After successful run, optionally commit changes
   * Note: afterRunCallback only receives invocationContext, not callbackContext
   * Results are logged instead of stored in stateDelta
   */
  override async afterRunCallback({
    invocationContext,
  }: {
    invocationContext: InvocationContext;
  }): Promise<void> {
    const agentName = invocationContext.agent.name;

    // Check for secrets in staged changes
    if (this.config.detectSecrets) {
      const secrets = await this.detectSecretsInChanges();
      if (secrets.length > 0) {
        // Log secrets detected - can't write to stateDelta in afterRunCallback
        console.warn(
          `[git-plugin] Secrets detected in ${secrets.length} locations, skipping auto-commit`,
        );
        this.lastResult = {
          secretsDetected: true,
          secrets: secrets.map((s) => ({
            file: s.file,
            line: s.line,
            pattern: s.pattern,
          })),
        };
        return;
      }
    }

    // Auto-commit if enabled and there are changes
    if (this.config.autoCommit) {
      const result = await this.commitChanges(agentName);
      this.lastResult = {
        committed: result.committed,
        hash: result.hash,
        files: result.files,
        error: result.error,
      };
    }
  }

  // Store last result for inspection
  private lastResult: Record<string, unknown> = {};

  /**
   * Get the last operation result
   */
  getLastResult(): Record<string, unknown> {
    return this.lastResult;
  }

  /**
   * Detect secrets in staged/unstaged changes
   */
  private async detectSecretsInChanges(): Promise<SecretDetection[]> {
    const detections: SecretDetection[] = [];

    try {
      // Get diff of staged and unstaged changes
      const diff = this.exec('git diff HEAD --unified=0');
      const lines = diff.split('\n');

      let currentFile = '';
      let currentLine = 0;

      for (const line of lines) {
        // Track current file
        const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
        if (fileMatch?.[1]) {
          currentFile = fileMatch[1];
          continue;
        }

        // Track line numbers
        const lineMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
        if (lineMatch?.[1]) {
          currentLine = parseInt(lineMatch[1], 10);
          continue;
        }

        // Check added lines for secrets
        if (line.startsWith('+') && !line.startsWith('+++')) {
          const content = line.slice(1);
          for (const pattern of this.config.secretPatterns) {
            if (pattern.test(content)) {
              detections.push({
                file: currentFile,
                line: currentLine,
                pattern: `${pattern.source.slice(0, 30)}...`,
                snippet: this.sanitizeSnippet(content),
              });
            }
          }
          currentLine++;
        }
      }
    } catch {
      // Git not available or not a repo
    }

    return detections;
  }

  /**
   * Commit staged changes
   */
  private async commitChanges(agentName: string): Promise<GitCommitResult> {
    try {
      // Check for changes
      const status = this.exec('git status --porcelain');
      if (!status.trim()) {
        return { committed: false, files: [], error: 'No changes to commit' };
      }

      // Get list of changed files
      const files = status
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => l.slice(3).trim());

      // Stage all changes
      this.exec('git add -A');

      // Create commit message
      const message = `${this.config.commitPrefix} ${agentName}: auto-commit`;

      // Commit
      this.exec(`git commit -m "${message}"`);

      // Get commit hash
      const hash = this.exec('git rev-parse HEAD').trim();

      return { committed: true, hash, files };
    } catch (error) {
      return {
        committed: false,
        files: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute git command
   */
  private exec(command: string): string {
    return execSync(command, {
      cwd: this.config.projectRoot,
      encoding: 'utf-8',
      timeout: 30000,
    });
  }

  /**
   * Sanitize snippet to avoid exposing full secrets
   */
  private sanitizeSnippet(content: string): string {
    // Replace potential secret values with asterisks
    return `${content.slice(0, 50).replace(/['"][^'"]{10,}['"]/g, '"***"')}...`;
  }

  /**
   * Get current git status
   */
  getStatus(): { branch: string; clean: boolean; files: string[] } {
    try {
      const branch = this.exec('git branch --show-current').trim();
      const status = this.exec('git status --porcelain');
      const files = status
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => l.slice(3).trim());

      return { branch, clean: files.length === 0, files };
    } catch {
      return { branch: 'unknown', clean: true, files: [] };
    }
  }
}

/**
 * Create a git plugin with default configuration
 */
export function createGitPlugin(projectRoot: string, autoCommit = false): GitPlugin {
  return new GitPlugin({ projectRoot, autoCommit });
}
