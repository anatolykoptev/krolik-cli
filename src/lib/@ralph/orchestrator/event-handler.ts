/**
 * Event Handler Module
 *
 * Handles ADK event processing and event emission to subscribers.
 *
 * @module @ralph/orchestrator/event-handler
 */

import type { Event } from '@google/adk';
import type { RalphLoopEvent, RalphLoopEventHandler } from '../types.js';
import { createComponentLogger } from '../utils/logger.js';
import type { CostState, RetryState, ValidationState } from './types.js';

const logger = createComponentLogger('event-handler');

/**
 * Event handler configuration
 */
export interface EventHandlerConfig {
  onEvent: (event: RalphLoopEvent) => void;
  eventHandlers: Set<RalphLoopEventHandler>;
  now: () => string;
}

/**
 * Emit event to all handlers
 */
export function emitEvent(event: RalphLoopEvent, config: EventHandlerConfig): void {
  // Call config handler
  config.onEvent(event);

  // Call subscribed handlers
  for (const handler of config.eventHandlers) {
    try {
      handler(event);
    } catch (error) {
      // Security: Log handler errors instead of silently swallowing them
      logger.error(
        `Handler failed for ${event.type}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Create an emit function bound to config
 */
export function createEmitter(config: EventHandlerConfig): (event: RalphLoopEvent) => void {
  return (event: RalphLoopEvent) => emitEvent(event, config);
}

/**
 * Handle events from ADK runner
 */
export async function handleAdkEvent(
  event: Event,
  taskId: string,
  config: EventHandlerConfig,
): Promise<void> {
  const stateDelta = event.actions?.stateDelta;
  if (!stateDelta) return;

  const emit = createEmitter(config);

  // Extract validation status
  const validation = stateDelta['__validation'] as ValidationState | undefined;
  if (validation) {
    emit({
      type: 'validation_completed',
      timestamp: config.now(),
      taskId,
      passed: validation.passed,
    });
  }

  // Extract cost updates
  const cost = stateDelta['__cost'] as CostState | undefined;
  if (cost) {
    emit({
      type: 'cost_update',
      timestamp: config.now(),
      cost: {
        inputCost: cost.current.costUsd * 0.2, // Approximate
        outputCost: cost.current.costUsd * 0.8,
        totalCost: cost.current.costUsd,
      },
      totalCost: cost.total.costUsd,
    });
  }

  // Extract retry info
  const retry = stateDelta['__retry'] as RetryState | undefined;
  if (retry) {
    emit({
      type: 'attempt_started',
      timestamp: config.now(),
      taskId,
      attempt: retry.attempt,
    });
  }
}

/**
 * Create event handler bound to config
 */
export function createEventHandler(
  config: EventHandlerConfig,
): (event: Event, taskId: string) => Promise<void> {
  return (event: Event, taskId: string) => handleAdkEvent(event, taskId, config);
}
