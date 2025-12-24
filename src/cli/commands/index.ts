/**
 * @module cli/commands
 * @description Command registration barrel
 */

import type { Command } from 'commander';
import { registerAgentCommand } from './agent';
import { registerAuditCommand } from './audit';
import { registerCodegenCommand } from './codegen';
import { registerContextCommand } from './context';
import { registerFixCommand } from './fix';
import { registerInitCommand } from './init';
import { registerIssueCommand } from './issue';
import { registerMcpCommand } from './mcp';
import { registerQualityCommand } from './quality';
import { registerRefactorCommand } from './refactor';
import { registerReviewCommand } from './review';
import { registerRoutesCommand } from './routes';
import { registerSchemaCommand } from './schema';
import { registerSecurityCommand } from './security';
import { registerSetupCommand } from './setup';
import { registerStatusCommand } from './status';
import { registerSyncCommand } from './sync';

/**
 * Register all commands on the program
 */
export function registerCommands(program: Command): void {
  // Core diagnostic commands
  registerStatusCommand(program);
  registerAuditCommand(program);
  registerReviewCommand(program);

  // Analysis commands
  registerSchemaCommand(program);
  registerRoutesCommand(program);
  registerContextCommand(program);
  registerIssueCommand(program);

  // Code generation and modification
  registerCodegenCommand(program);
  registerFixCommand(program);
  registerRefactorCommand(program);

  // Utility commands
  registerSecurityCommand(program);
  registerInitCommand(program);
  registerSyncCommand(program);

  // Integration commands
  registerMcpCommand(program);
  registerSetupCommand(program);
  registerAgentCommand(program);

  // Deprecated commands
  registerQualityCommand(program);
}
