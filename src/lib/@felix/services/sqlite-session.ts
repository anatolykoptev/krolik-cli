/**
 * SQLiteSessionService - Persistent session storage for ADK
 *
 * Uses the central krolik.db database via @storage/database
 * Tables: ralph_adk_sessions, ralph_adk_events (created in migration 9)
 *
 * @module @felix/services/sqlite-session
 */

import { randomUUID } from 'node:crypto';
import { BaseSessionService } from '@google/adk';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { createComponentLogger } from '../utils/logger.js';

const logger = createComponentLogger('sqlite-session');

import type {
  AppendEventRequest,
  CreateSessionRequest,
  DeleteSessionRequest,
  Event,
  EventActions,
  GetSessionRequest,
  ListSessionsRequest,
  ListSessionsResponse,
  Session,
} from '@google/adk';
import type { Content } from '@google/genai';
import { getProjectDatabase } from '../../@storage/database.js';

// ============================================================================
// Zod Schemas for Safe JSON Parsing
// ============================================================================

const StateSchema = z.record(z.unknown());

const EventActionsSchema = z.object({
  stateDelta: z.record(z.unknown()).optional(),
  artifactDelta: z.record(z.unknown()).optional(),
  transferToAgent: z.string().optional(),
  escalate: z.boolean().optional(),
  skipSummarization: z.boolean().optional(),
  requestedAuthConfigs: z.record(z.unknown()).optional(),
});

const ContentSchema = z.object({
  role: z.string().optional(),
  parts: z.array(z.unknown()).optional(),
});

// Export type alias for backwards compatibility
export type SessionService = BaseSessionService;

interface SessionRow {
  id: string;
  app_name: string;
  user_id: string;
  state: string;
  created_at: string;
  updated_at: string;
}

interface EventRow {
  id: string;
  session_id: string;
  invocation_id: string;
  author: string | null;
  content: string | null;
  actions: string;
  branch: string | null;
  timestamp: number;
}

const TEMP_PREFIX = '__';

/**
 * Maximum allowed value for maxAgeDays to prevent SQL injection via large numbers
 * Security: Prevents potential integer overflow or DoS attacks
 */
const MAX_AGE_DAYS_LIMIT = 365 * 10; // 10 years max

/**
 * Validate maxAgeDays parameter (CWE-89 prevention)
 * @throws Error if maxAgeDays is not a safe positive integer
 */
function validateMaxAgeDays(maxAgeDays: number): void {
  if (!Number.isInteger(maxAgeDays) || maxAgeDays <= 0 || maxAgeDays > MAX_AGE_DAYS_LIMIT) {
    throw new Error(
      `Security: maxAgeDays must be a positive integer between 1 and ${MAX_AGE_DAYS_LIMIT}, got: ${maxAgeDays}`,
    );
  }
}

// ============================================================================
// Safe JSON Parsing Helpers
// ============================================================================

/**
 * Options for safe JSON parsing
 */
interface SafeParseOptions {
  /** Throw on parse error instead of returning default (default: false) */
  throwOnError?: boolean;
}

/**
 * Parse state JSON with Zod validation
 * @param json - JSON string to parse
 * @param options - Parse options
 * @returns Parsed state or empty object
 * @throws Error if throwOnError is true and parsing fails
 */
function safeParseState(json: string, options: SafeParseOptions = {}): Record<string, unknown> {
  try {
    return StateSchema.parse(JSON.parse(json));
  } catch (error) {
    const message = `Failed to parse state JSON: ${error instanceof Error ? error.message : String(error)}`;
    if (options.throwOnError) {
      throw new Error(message);
    }
    logger.error(message);
    return {};
  }
}

function safeParseActions(json: string): EventActions {
  try {
    return EventActionsSchema.parse(JSON.parse(json)) as EventActions;
  } catch (error) {
    logger.error(
      `Failed to parse actions JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      stateDelta: {},
      artifactDelta: {},
      requestedAuthConfigs: {},
      requestedToolConfirmations: {},
    };
  }
}

function safeParseContent(json: string): Content | undefined {
  try {
    const parsed = ContentSchema.parse(JSON.parse(json));
    if (parsed.role || parsed.parts) {
      const content: Content = {};
      if (parsed.role) content.role = parsed.role;
      if (parsed.parts && parsed.parts.length > 0) {
        (content as { parts: unknown[] }).parts = parsed.parts;
      }
      return content;
    }
    return undefined;
  } catch (error) {
    logger.error(
      `Failed to parse content JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}

/**
 * SQLiteSessionService - ADK session service using central krolik.db
 *
 * Tables used (from migration 9):
 * - ralph_adk_sessions: Session metadata
 * - ralph_adk_events: Conversation events
 */
export class SQLiteSessionService extends BaseSessionService {
  private db: Database.Database;

  /**
   * Create session service with existing database connection
   * @param db - Database instance from getProjectDatabase()
   */
  constructor(db: Database.Database) {
    super();
    this.db = db;
  }

  async createSession(request: CreateSessionRequest): Promise<Session> {
    const id = request.sessionId ?? randomUUID();
    const state = request.state ?? {};

    this.db
      .prepare(
        `INSERT INTO ralph_adk_sessions (id, app_name, user_id, state)
         VALUES (?, ?, ?, ?)`,
      )
      .run(id, request.appName, request.userId, JSON.stringify(state));

    return {
      id,
      appName: request.appName,
      userId: request.userId,
      state,
      events: [],
      lastUpdateTime: Date.now(),
    };
  }

  async getSession(request: GetSessionRequest): Promise<Session | undefined> {
    const row = this.db
      .prepare(
        `SELECT * FROM ralph_adk_sessions
         WHERE id = ? AND app_name = ? AND user_id = ?`,
      )
      .get(request.sessionId, request.appName, request.userId) as SessionRow | undefined;

    if (!row) return undefined;

    let eventsQuery = `SELECT * FROM ralph_adk_events WHERE session_id = ?`;
    const params: (string | number)[] = [request.sessionId];

    if (request.config?.afterTimestamp) {
      eventsQuery += ` AND timestamp > ?`;
      params.push(request.config.afterTimestamp);
    }

    eventsQuery += ` ORDER BY timestamp ASC`;

    if (request.config?.numRecentEvents) {
      eventsQuery += ` LIMIT ?`;
      params.push(request.config.numRecentEvents);
    }

    const eventRows = this.db.prepare(eventsQuery).all(...params) as EventRow[];

    const events: Event[] = eventRows.map((e) => {
      const event: Event = {
        id: e.id,
        invocationId: e.invocation_id,
        actions: safeParseActions(e.actions),
        timestamp: e.timestamp,
      };
      if (e.author) event.author = e.author;
      if (e.content) {
        const parsedContent = safeParseContent(e.content);
        if (parsedContent) {
          event.content = parsedContent;
        }
      }
      if (e.branch) event.branch = e.branch;
      return event;
    });

    return {
      id: row.id,
      appName: row.app_name,
      userId: row.user_id,
      state: safeParseState(row.state),
      events,
      lastUpdateTime: new Date(row.updated_at).getTime(),
    };
  }

  async listSessions(request: ListSessionsRequest): Promise<ListSessionsResponse> {
    const rows = this.db
      .prepare(
        `SELECT id, app_name, user_id, state, updated_at
         FROM ralph_adk_sessions
         WHERE app_name = ? AND user_id = ?
         ORDER BY updated_at DESC`,
      )
      .all(request.appName, request.userId) as SessionRow[];

    const sessions: Session[] = rows.map((row) => ({
      id: row.id,
      appName: row.app_name,
      userId: row.user_id,
      state: safeParseState(row.state),
      events: [],
      lastUpdateTime: new Date(row.updated_at).getTime(),
    }));

    return { sessions };
  }

  async deleteSession(request: DeleteSessionRequest): Promise<void> {
    this.db
      .prepare(
        `DELETE FROM ralph_adk_sessions
         WHERE id = ? AND app_name = ? AND user_id = ?`,
      )
      .run(request.sessionId, request.appName, request.userId);
  }

  override async appendEvent({ session, event }: AppendEventRequest): Promise<Event> {
    if (event.partial) {
      return event;
    }

    this.applyStateDelta(session, event);

    this.db
      .prepare(
        `INSERT INTO ralph_adk_events (id, session_id, invocation_id, author, content, actions, branch, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        session.id,
        event.invocationId,
        event.author ?? null,
        event.content ? JSON.stringify(event.content) : null,
        JSON.stringify(event.actions),
        event.branch ?? null,
        event.timestamp,
      );

    this.db
      .prepare(
        `UPDATE ralph_adk_sessions
         SET state = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(JSON.stringify(session.state), session.id);

    session.events.push(event);

    return event;
  }

  private applyStateDelta(session: Session, event: Event): void {
    if (!event.actions?.stateDelta) {
      return;
    }

    for (const [key, value] of Object.entries(event.actions.stateDelta)) {
      if (key.startsWith(TEMP_PREFIX)) {
        continue;
      }
      session.state[key] = value;
    }
  }

  /**
   * Get all sessions for an app (admin use)
   */
  getAllSessions(appName: string): Session[] {
    const rows = this.db
      .prepare(
        `SELECT id, app_name, user_id, state, updated_at
         FROM ralph_adk_sessions
         WHERE app_name = ?
         ORDER BY updated_at DESC`,
      )
      .all(appName) as SessionRow[];

    return rows.map((row) => ({
      id: row.id,
      appName: row.app_name,
      userId: row.user_id,
      state: safeParseState(row.state),
      events: [],
      lastUpdateTime: new Date(row.updated_at).getTime(),
    }));
  }

  /**
   * Clean up old sessions
   * @param appName - Application name to filter by
   * @param maxAgeDays - Maximum age in days (must be positive integer, max 3650)
   * @throws Error if maxAgeDays is invalid (CWE-89 prevention)
   */
  cleanupOldSessions(appName: string, maxAgeDays: number): number {
    // Security: Validate maxAgeDays to prevent SQL injection (CWE-89)
    validateMaxAgeDays(maxAgeDays);

    const result = this.db
      .prepare(
        `DELETE FROM ralph_adk_sessions
         WHERE app_name = ?
         AND updated_at < datetime('now', '-' || ? || ' days')`,
      )
      .run(appName, maxAgeDays);

    return result.changes;
  }

  /**
   * Clean up all old sessions across all apps
   * @param maxAgeDays - Maximum age in days (must be positive integer, max 3650)
   * @throws Error if maxAgeDays is invalid (CWE-89 prevention)
   */
  cleanupAllOldSessions(maxAgeDays: number): number {
    // Security: Validate maxAgeDays to prevent SQL injection (CWE-89)
    validateMaxAgeDays(maxAgeDays);

    const result = this.db
      .prepare(
        `DELETE FROM ralph_adk_sessions
         WHERE updated_at < datetime('now', '-' || ? || ' days')`,
      )
      .run(maxAgeDays);

    return result.changes;
  }

  getStats(): { totalSessions: number; totalEvents: number; oldestSession: string | null } {
    const sessionCount = this.db
      .prepare(`SELECT COUNT(*) as count FROM ralph_adk_sessions`)
      .get() as { count: number };

    const eventCount = this.db.prepare(`SELECT COUNT(*) as count FROM ralph_adk_events`).get() as {
      count: number;
    };

    const oldest = this.db
      .prepare(`SELECT MIN(created_at) as oldest FROM ralph_adk_sessions`)
      .get() as { oldest: string | null };

    return {
      totalSessions: sessionCount.count,
      totalEvents: eventCount.count,
      oldestSession: oldest.oldest,
    };
  }

  /**
   * Close the underlying database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

/** Default TTL for session cleanup (30 days) */
const DEFAULT_SESSION_TTL_DAYS = 30;

export interface SessionServiceOptions {
  /** TTL in days for automatic session cleanup (default: 30) */
  sessionTtlDays?: number;
  /** Run cleanup on creation (default: true) */
  autoCleanup?: boolean;
}

/**
 * Create a SQLite session service using the central krolik.db
 * Automatically cleans up old sessions on creation
 *
 * @param projectRoot - Absolute path to project root
 * @param options - Session service options
 */
export function createSQLiteSessionService(
  projectRoot: string,
  options: SessionServiceOptions = {},
): SQLiteSessionService {
  // Validate path to prevent directory traversal
  if (projectRoot.includes('..')) {
    throw new Error('path traversal detected');
  }

  // Validate sensitive directories
  // Note: /var is excluded to allow macOS temp directories (e.g., /var/folders/...)
  const sensitive = ['/etc', '/usr', '/bin', '/sbin'];
  if (sensitive.some((p) => projectRoot.startsWith(p))) {
    throw new Error('cannot write to system directory');
  }

  // Use central database manager (handles path validation, WAL mode, etc.)
  const db = getProjectDatabase(projectRoot);
  const service = new SQLiteSessionService(db);

  // Automatic cleanup of old sessions
  const autoCleanup = options.autoCleanup ?? true;
  if (autoCleanup) {
    const ttlDays = options.sessionTtlDays ?? DEFAULT_SESSION_TTL_DAYS;
    const deleted = service.cleanupAllOldSessions(ttlDays);
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old session(s) (TTL: ${ttlDays} days)`);
    }
  }

  return service;
}
