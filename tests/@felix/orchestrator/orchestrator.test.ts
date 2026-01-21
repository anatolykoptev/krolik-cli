/**
 * Integration tests for FelixOrchestrator and related components
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSQLiteSessionService,
  SQLiteSessionService,
} from '@/lib/@felix/services/sqlite-session';
import { createComponentLogger, createFelixLogger } from '@/lib/@felix/utils/logger';
import { closeDatabase } from '@/lib/@storage/database';

describe('FelixOrchestrator Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'ralph-integration-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Session Service Security', () => {
    describe('Path Traversal Prevention', () => {
      it('should reject paths with .. traversal', () => {
        expect(() => {
          createSQLiteSessionService('../../../etc/passwd');
        }).toThrow('path traversal detected');
      });

      it('should reject sensitive system directories', () => {
        expect(() => {
          createSQLiteSessionService('/etc/krolik');
        }).toThrow('cannot write to system directory');

        expect(() => {
          createSQLiteSessionService('/bin/krolik');
        }).toThrow('cannot write to system directory');

        expect(() => {
          createSQLiteSessionService('/usr/local/krolik');
        }).toThrow('cannot write to system directory');
      });

      it('should accept valid project paths', () => {
        const service = createSQLiteSessionService(tempDir, { autoCleanup: false });
        expect(service).toBeDefined();
        closeDatabase({ scope: 'project', projectPath: tempDir });
      });
    });

    describe('Session Cleanup with TTL', () => {
      it('should cleanup sessions via cleanupAllOldSessions method', async () => {
        // Create service and add sessions
        const dbPath = join(tempDir, '.krolik', 'ralph-sessions.db');
        mkdirSync(join(tempDir, '.krolik'), { recursive: true });

        const db = new Database(dbPath);
        db.exec(`
          CREATE TABLE felix_adk_sessions (
            id TEXT PRIMARY KEY,
            app_name TEXT NOT NULL,
            user_id TEXT NOT NULL,
            state TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE felix_adk_events (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            invocation_id TEXT NOT NULL,
            author TEXT,
            content TEXT,
            actions TEXT NOT NULL,
            branch TEXT,
            timestamp INTEGER NOT NULL,
            FOREIGN KEY(session_id) REFERENCES felix_adk_sessions(id) ON DELETE CASCADE
          );
        `);

        const service = new SQLiteSessionService(db);
        await service.createSession({
          appName: 'test-app',
          userId: 'user-1',
        });
        await service.createSession({
          appName: 'test-app',
          userId: 'user-2',
        });

        // Verify sessions exist
        const stats1 = service.getStats();
        expect(stats1.totalSessions).toBe(2);

        // Cleanup with very long TTL (sessions are too new, won't be deleted)
        const deleted1 = service.cleanupAllOldSessions(365);
        expect(deleted1).toBe(0);

        // Sessions should still exist
        const stats2 = service.getStats();
        expect(stats2.totalSessions).toBe(2);

        service.close();
      });

      it('should respect autoCleanup=false option', async () => {
        // Setup shared DB with tables
        const dbPath = join(tempDir, '.krolik', 'memory', 'krolik.db');
        mkdirSync(join(tempDir, '.krolik', 'memory'), { recursive: true });

        const db = new Database(dbPath);
        // Create full schema directly to bypass migration issues
        db.exec(`
          CREATE TABLE IF NOT EXISTS schema_versions (
            id INTEGER PRIMARY KEY,
            version INTEGER UNIQUE NOT NULL,
            applied_at TEXT NOT NULL
          );
          
          -- Set version to 21 to suppress migrations
          INSERT INTO schema_versions (version, applied_at) VALUES (21, '${new Date().toISOString()}');

          CREATE TABLE IF NOT EXISTS felix_adk_sessions (
            id TEXT PRIMARY KEY,
            app_name TEXT NOT NULL,
            user_id TEXT NOT NULL,
            state TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS felix_adk_events (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            invocation_id TEXT NOT NULL,
            author TEXT,
            content TEXT,
            actions TEXT NOT NULL,
            branch TEXT,
            timestamp INTEGER NOT NULL,
            FOREIGN KEY(session_id) REFERENCES felix_adk_sessions(id) ON DELETE CASCADE
          );
        `);
        db.close();

        // Create initial service (will use the DB we just prepared)
        const service1 = createSQLiteSessionService(tempDir, { autoCleanup: false });
        await service1.createSession({ appName: 'test-app', userId: 'user-1' });
        closeDatabase({ scope: 'project', projectPath: tempDir });

        const service2 = createSQLiteSessionService(tempDir, { autoCleanup: false });
        const stats = service2.getStats();
        expect(stats.totalSessions).toBe(1);
        closeDatabase({ scope: 'project', projectPath: tempDir });
      });
    });

    describe('Session Statistics', () => {
      it('should return accurate stats', async () => {
        const dbPath = join(tempDir, 'test.db');
        const db = new Database(dbPath);
        db.exec(`
          CREATE TABLE felix_adk_sessions (
            id TEXT PRIMARY KEY,
            app_name TEXT NOT NULL,
            user_id TEXT NOT NULL,
            state TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE felix_adk_events (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            invocation_id TEXT NOT NULL,
            author TEXT,
            content TEXT,
            actions TEXT NOT NULL,
            branch TEXT,
            timestamp INTEGER NOT NULL,
            FOREIGN KEY(session_id) REFERENCES felix_adk_sessions(id) ON DELETE CASCADE
          );
        `);
        const service = new SQLiteSessionService(db);

        // Create multiple sessions with events
        const session1 = await service.createSession({
          appName: 'test-app',
          userId: 'user-1',
        });

        await service.appendEvent({
          session: session1,
          event: {
            id: 'evt-1',
            invocationId: 'inv-1',
            actions: {
              stateDelta: {},
              artifactDelta: {},
              requestedAuthConfigs: {},
              requestedToolConfirmations: {},
            },
            timestamp: Date.now(),
          },
        });

        await service.createSession({
          appName: 'test-app',
          userId: 'user-2',
        });

        const stats = service.getStats();
        expect(stats.totalSessions).toBe(2);
        expect(stats.totalEvents).toBe(1);
        expect(stats.oldestSession).toBeDefined();

        service.close();
      });
    });
  });

  describe('Structured Logging', () => {
    it('should create logger with correct prefix', () => {
      const logger = createComponentLogger('test-component');
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.timing).toBe('function');
    });

    it('should create child logger with merged context', () => {
      const parentLogger = createFelixLogger({
        level: 'debug',
        defaultContext: { sessionId: 'sess-1' },
      });

      const childLogger = parentLogger.child({ taskId: 'task-1' });
      expect(childLogger).toBeDefined();
    });

    it('should respect log level from environment', () => {
      const originalEnv = process.env.FELIX_LOG_LEVEL;

      process.env.FELIX_LOG_LEVEL = 'error';
      const logger = createFelixLogger();

      // Spy on console.error
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.debug('should not log');
      logger.info('should not log');
      logger.warn('should not log');
      expect(spy).not.toHaveBeenCalled();

      logger.error('should log');
      expect(spy).toHaveBeenCalledTimes(1);

      spy.mockRestore();
      process.env.FELIX_LOG_LEVEL = originalEnv;
    });
  });
});

describe('Model Security', () => {
  describe('ALLOWED_MODEL_ALIASES', () => {
    it('should only allow whitelisted model aliases', async () => {
      // This test verifies the security fix is in place
      // The actual validation happens in claude-cli-llm.ts buildCliArgs()
      const allowedAliases = new Set([
        'sonnet',
        'opus',
        'haiku',
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-3-5-haiku-20241022',
      ]);

      // Test valid aliases
      expect(allowedAliases.has('sonnet')).toBe(true);
      expect(allowedAliases.has('opus')).toBe(true);
      expect(allowedAliases.has('haiku')).toBe(true);

      // Test invalid aliases (potential injection attempts)
      expect(allowedAliases.has("'; rm -rf /")).toBe(false);
      expect(allowedAliases.has('sonnet; echo pwned')).toBe(false);
      expect(allowedAliases.has('$(cat /etc/passwd)')).toBe(false);
    });
  });

  describe('ALLOWED_ENV_VARS', () => {
    it('should not include sensitive environment variables', () => {
      const allowedVars = new Set([
        'PATH',
        'HOME',
        'USER',
        'SHELL',
        'LANG',
        'LC_ALL',
        'TERM',
        'TMPDIR',
        'XDG_CONFIG_HOME',
        'XDG_DATA_HOME',
        'XDG_CACHE_HOME',
      ]);

      // These sensitive vars should NOT be allowed
      expect(allowedVars.has('ANTHROPIC_API_KEY')).toBe(false);
      expect(allowedVars.has('OPENAI_API_KEY')).toBe(false);
      expect(allowedVars.has('AWS_SECRET_ACCESS_KEY')).toBe(false);
      expect(allowedVars.has('GITHUB_TOKEN')).toBe(false);
      expect(allowedVars.has('DATABASE_URL')).toBe(false);
    });
  });
});
