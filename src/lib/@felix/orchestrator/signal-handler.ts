/**
 * Signal Handler Module
 *
 * Handles graceful shutdown on SIGTERM/SIGINT signals.
 *
 * @module @felix/orchestrator/signal-handler
 */

import type { SQLiteSessionService } from '../services/sqlite-session.js';
import type { RalphLoopEvent, RalphLoopState } from '../types.js';

/**
 * Signal handler state
 */
export interface SignalHandlerState {
  signalHandlersBound: boolean;
  boundSignalHandler: (() => void) | null;
}

/**
 * Signal handler configuration
 */
export interface SignalHandlerConfig {
  getState: () => RalphLoopState;
  setState: (status: RalphLoopState['status']) => void;
  cancel: () => void;
  emit: (event: RalphLoopEvent) => void;
  now: () => string;
}

/**
 * Create signal handler state
 */
export function createSignalHandlerState(): SignalHandlerState {
  return {
    signalHandlersBound: false,
    boundSignalHandler: null,
  };
}

/**
 * Setup signal handlers for graceful shutdown (SIGTERM/SIGINT)
 */
export function setupSignalHandlers(state: SignalHandlerState, config: SignalHandlerConfig): void {
  if (state.signalHandlersBound) return;

  state.boundSignalHandler = () => {
    const currentState = config.getState();

    // If already cancelled or completed, ignore
    if (
      currentState.status === 'cancelled' ||
      currentState.status === 'completed' ||
      currentState.status === 'failed'
    ) {
      return;
    }

    // If paused, resume first to allow graceful shutdown
    if (currentState.status === 'paused') {
      config.setState('running');
    }

    // Cancel execution gracefully
    config.cancel();
    config.emit({ type: 'loop_cancelled', timestamp: config.now() });
  };

  process.on('SIGTERM', state.boundSignalHandler);
  process.on('SIGINT', state.boundSignalHandler);
  state.signalHandlersBound = true;
}

/**
 * Remove signal handlers
 */
export function removeSignalHandlers(state: SignalHandlerState): void {
  if (!state.signalHandlersBound || !state.boundSignalHandler) return;

  process.off('SIGTERM', state.boundSignalHandler);
  process.off('SIGINT', state.boundSignalHandler);
  state.signalHandlersBound = false;
  state.boundSignalHandler = null;
}

/**
 * Clean up resources (signal handlers)
 *
 * Note: Database connection is managed by the central @storage/database module
 * and doesn't need to be closed here.
 */
export async function cleanup(
  state: SignalHandlerState,
  _sessionService: SQLiteSessionService,
): Promise<void> {
  removeSignalHandlers(state);
  // Database connection is managed centrally - no need to close
}
