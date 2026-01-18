/**
 * ValidationPlugin - Run validation after model responses
 *
 * Runs typecheck, lint, and tests after AI makes changes.
 * Stores results in session state for retry decisions.
 */

import { spawn } from 'node:child_process';
import type { CallbackContext, LlmResponse } from '@google/adk';
import { BasePlugin } from '@google/adk';

export type ValidationStep = 'typecheck' | 'lint' | 'test:unit' | 'test:e2e' | 'build';

export interface StepResult {
  step: ValidationStep;
  passed: boolean;
  output: string;
  duration: number;
}

export interface ValidationResult {
  passed: boolean;
  steps: StepResult[];
  totalDuration: number;
}

export interface ValidationPluginConfig {
  projectRoot: string;
  steps: ValidationStep[];
  failFast?: boolean;
  timeout?: number;
}

const DEFAULT_COMMANDS: Record<ValidationStep, string> = {
  typecheck: 'npx tsc --noEmit',
  lint: 'npx eslint . --max-warnings 0',
  'test:unit': 'npx vitest run --reporter=json',
  'test:e2e': 'npx playwright test',
  build: 'npm run build',
};

export class ValidationPlugin extends BasePlugin {
  private config: ValidationPluginConfig;
  private customCommands: Partial<Record<ValidationStep, string>> = {};

  constructor(config: ValidationPluginConfig) {
    super('validation');
    this.config = {
      failFast: true,
      timeout: 120000, // 2 minutes default
      ...config,
    };
  }

  /**
   * Set custom command for a validation step
   */
  setCommand(step: ValidationStep, command: string): void {
    this.customCommands[step] = command;
  }

  /**
   * After model response, run validation pipeline
   */
  override async afterModelCallback({
    callbackContext,
    llmResponse,
  }: {
    callbackContext: CallbackContext;
    llmResponse: LlmResponse;
  }): Promise<LlmResponse | undefined> {
    // Skip partial responses (streaming)
    if (llmResponse.partial) {
      return undefined;
    }

    // Skip if response has errors
    if (llmResponse.errorCode) {
      return undefined;
    }

    // Run validation pipeline
    const result = await this.runValidation();

    // Store result in session state for other plugins (e.g., RetryPlugin)
    callbackContext.eventActions.stateDelta['__validation'] = {
      passed: result.passed,
      failedSteps: result.steps.filter((s) => !s.passed).map((s) => s.step),
      totalDuration: result.totalDuration,
    };

    // If validation failed, append error info to response
    if (!result.passed) {
      return this.appendValidationErrors(llmResponse, result);
    }

    // Validation passed, continue normally
    return undefined;
  }

  /**
   * Run all validation steps
   */
  async runValidation(): Promise<ValidationResult> {
    const steps: StepResult[] = [];
    const startTime = Date.now();

    for (const step of this.config.steps) {
      const stepResult = await this.runStep(step);
      steps.push(stepResult);

      // Stop on first failure if failFast is enabled
      if (!stepResult.passed && this.config.failFast) {
        break;
      }
    }

    return {
      passed: steps.every((s) => s.passed),
      steps,
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * Run a single validation step
   */
  private async runStep(step: ValidationStep): Promise<StepResult> {
    const command = this.customCommands[step] ?? DEFAULT_COMMANDS[step];
    const startTime = Date.now();

    const { exitCode, output } = await this.exec(command);

    return {
      step,
      passed: exitCode === 0,
      output: this.truncateOutput(output),
      duration: Date.now() - startTime,
    };
  }

  /**
   * Execute a command
   */
  private exec(command: string): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve) => {
      const proc = spawn('sh', ['-c', command], {
        cwd: this.config.projectRoot,
        env: {
          ...process.env,
          CI: 'true',
          FORCE_COLOR: '0',
          NO_COLOR: '1',
        },
        timeout: this.config.timeout,
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      proc.stderr.on('data', (data) => {
        output += data.toString();
      });

      proc.on('error', (error) => {
        resolve({ exitCode: 1, output: error.message });
      });

      proc.on('close', (code) => {
        resolve({ exitCode: code ?? 1, output });
      });
    });
  }

  /**
   * Truncate long output for error messages
   */
  private truncateOutput(output: string, maxLength = 2000): string {
    if (output.length <= maxLength) {
      return output;
    }
    return `${output.slice(0, maxLength)}\n... (truncated)}`;
  }

  /**
   * Append validation errors to the LLM response
   */
  private appendValidationErrors(llmResponse: LlmResponse, result: ValidationResult): LlmResponse {
    const failedSteps = result.steps.filter((s) => !s.passed);

    const errorMessage = failedSteps
      .map((s) => `## ${s.step} FAILED\n\`\`\`\n${s.output}\n\`\`\``)
      .join('\n\n');

    // Add validation errors to custom metadata
    return {
      ...llmResponse,
      customMetadata: {
        ...llmResponse.customMetadata,
        validationFailed: true,
        validationErrors: errorMessage,
        failedSteps: failedSteps.map((s) => s.step),
      },
    };
  }
}

/**
 * Create a validation plugin with common configuration
 */
export function createValidationPlugin(
  projectRoot: string,
  steps: ValidationStep[] = ['typecheck', 'lint'],
): ValidationPlugin {
  return new ValidationPlugin({ projectRoot, steps });
}
