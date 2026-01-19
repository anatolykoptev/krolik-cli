/**
 * @module cli/commands
 * @description Command registration barrel
 */

import type { Command } from 'commander';
import { registerAgentCommand } from './agent';
import { registerAuditCommand } from './audit';
import { registerCodegenCommand } from './codegen';
import { registerContextCommand } from './context';
import { registerDocsCommand } from './docs';
import { registerFelixCommand } from './felix';
import { registerFixCommand } from './fix';
import { registerInitCommand } from './init';
import { registerIssueCommand } from './issue';
import { registerMcpCommand } from './mcp';
import { registerMemCommand } from './mem';
import { registerModulesCommand } from './modules';
import { registerProgressCommand } from './progress';
import { registerRefactorCommand } from './refactor';
import { registerReviewCommand } from './review';
import { registerRoutesCommand } from './routes';
import { registerSchemaCommand } from './schema';
import { registerSecurityCommand } from './security';
import { registerSetupCommand } from './setup';
import { registerSkillsCommand } from './skills';
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
  registerModulesCommand(program);
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
  registerMemCommand(program);
  registerDocsCommand(program);
  registerSetupCommand(program);
  registerAgentCommand(program);
  registerSkillsCommand(program);

  // Progress tracking
  registerProgressCommand(program);

  // Krolik Felix (autonomous agent orchestration)
  registerFelixCommand(program);
}
