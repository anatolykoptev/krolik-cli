/**
 * Tests for SQLiteSessionService
 */

import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SQLiteSessionService } from '@/lib/@felix/services/sqlite-session';

describe('SQLiteSessionService', () => {
  let service: SQLiteSessionService;
  let db: Database.Database;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ralph-test-'));
    const dbPath = join(tempDir, 'test.db');
    db = new Database(dbPath);

    // Create required tables
    db.exec(`
      CREATE TABLE ralph_adk_sessions (
        id TEXT PRIMARY KEY,
        app_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE ralph_adk_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        invocation_id TEXT NOT NULL,
        author TEXT,
        content TEXT,
        actions TEXT NOT NULL,
        branch TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY(session_id) REFERENCES ralph_adk_sessions(id) ON DELETE CASCADE
      );
    `);

    service = new SQLiteSessionService(db);
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('createSession', () => {
    it('should create a session with generated ID', async () => {
      const session = await service.createSession({
        appName: 'test-app',
        userId: 'user-1',
      });

      expect(session.id).toBeDefined();
      expect(session.appName).toBe('test-app');
      expect(session.userId).toBe('user-1');
      expect(session.state).toEqual({});
      expect(session.events).toEqual([]);
    });

    it('should create a session with custom ID', async () => {
      const customId = randomUUID();
      const session = await service.createSession({
        appName: 'test-app',
        userId: 'user-1',
        sessionId: customId,
      });

      expect(session.id).toBe(customId);
    });

    it('should create a session with initial state', async () => {
      const session = await service.createSession({
        appName: 'test-app',
        userId: 'user-1',
        state: { counter: 0, name: 'Test' },
      });

      expect(session.state).toEqual({ counter: 0, name: 'Test' });
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', async () => {
      const created = await service.createSession({
        appName: 'test-app',
        userId: 'user-1',
        state: { foo: 'bar' },
      });

      const retrieved = await service.getSession({
        appName: 'test-app',
        userId: 'user-1',
        sessionId: created.id,
      });

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.state).toEqual({ foo: 'bar' });
    });

    it('should return undefined for non-existent session', async () => {
      const session = await service.getSession({
        appName: 'test-app',
        userId: 'user-1',
        sessionId: 'non-existent',
      });

      expect(session).toBeUndefined();
    });
  });

  describe('listSessions', () => {
    it('should list all sessions for a user', async () => {
      await service.createSession({ appName: 'test-app', userId: 'user-1' });
      await service.createSession({ appName: 'test-app', userId: 'user-1' });
      await service.createSession({ appName: 'test-app', userId: 'user-2' });

      const result = await service.listSessions({
        appName: 'test-app',
        userId: 'user-1',
      });

      expect(result.sessions).toHaveLength(2);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const session = await service.createSession({
        appName: 'test-app',
        userId: 'user-1',
      });

      await service.deleteSession({
        appName: 'test-app',
        userId: 'user-1',
        sessionId: session.id,
      });

      const retrieved = await service.getSession({
        appName: 'test-app',
        userId: 'user-1',
        sessionId: session.id,
      });

      expect(retrieved).toBeUndefined();
    });
  });

  describe('appendEvent', () => {
    it('should append an event to a session', async () => {
      const session = await service.createSession({
        appName: 'test-app',
        userId: 'user-1',
      });

      const event = await service.appendEvent({
        session,
        event: {
          id: randomUUID(),
          invocationId: 'inv-1',
          author: 'agent',
          content: { role: 'model', parts: [{ text: 'Hello' }] },
          actions: {
            stateDelta: { greeting: 'done' },
            artifactDelta: {},
            requestedAuthConfigs: {},
            requestedToolConfirmations: {},
          },
          timestamp: Date.now(),
        },
      });

      expect(event.id).toBeDefined();
      expect(session.events).toHaveLength(1);
      expect(session.state.greeting).toBe('done');
    });

    it('should skip partial events', async () => {
      const session = await service.createSession({
        appName: 'test-app',
        userId: 'user-1',
      });

      await service.appendEvent({
        session,
        event: {
          id: randomUUID(),
          invocationId: 'inv-1',
          actions: {
            stateDelta: {},
            artifactDelta: {},
            requestedAuthConfigs: {},
            requestedToolConfirmations: {},
          },
          timestamp: Date.now(),
          partial: true,
        },
      });

      expect(session.events).toHaveLength(0);
    });

    it('should not persist temporary state', async () => {
      const session = await service.createSession({
        appName: 'test-app',
        userId: 'user-1',
      });

      await service.appendEvent({
        session,
        event: {
          id: randomUUID(),
          invocationId: 'inv-1',
          actions: {
            stateDelta: {
              permanent: 'value',
              __temp: 'should-not-persist',
            },
            artifactDelta: {},
            requestedAuthConfigs: {},
            requestedToolConfirmations: {},
          },
          timestamp: Date.now(),
        },
      });

      expect(session.state.permanent).toBe('value');
      expect(session.state.__temp).toBeUndefined();
    });
  });

  describe('getAllSessions', () => {
    it('should get all sessions for an app', async () => {
      await service.createSession({ appName: 'app-1', userId: 'user-1' });
      await service.createSession({ appName: 'app-1', userId: 'user-2' });
      await service.createSession({ appName: 'app-2', userId: 'user-1' });

      const sessions = service.getAllSessions('app-1');
      expect(sessions).toHaveLength(2);
    });
  });
});
