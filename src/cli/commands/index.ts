/**
 * @module cli/commands
 * @description Command registration barrel
 */

import type { Command } from 'commander';
import { registerStatusCommand } from './status';
import { registerAuditCommand } from './audit';
import { registerReviewCommand } from './review';
import { registerSchemaCommand } from './schema';
import { registerRoutesCommand } from './routes';
import { registerContextCommand } from './context';
import { registerIssueCommand } from './issue';
import { registerCodegenCommand } from './codegen';
import { registerSecurityCommand } from './security';
import { registerRefactorCommand } from './refactor';
import { registerFixCommand } from './fix';
import { registerQualityCommand } from './quality';
import { registerInitCommand } from './init';
import { registerSyncCommand } from './sync';
import { registerMcpCommand } from './mcp';
import { registerSetupCommand } from './setup';
import { registerAgentCommand } from './agent';

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
