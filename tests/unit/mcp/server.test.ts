import { describe, expect, it } from 'vitest';
import { MCPServer, TOOLS } from '../../../src/mcp/server';
import type { ResolvedConfig } from '../../../src/types';

describe('mcp/server', () => {
  const mockConfig: ResolvedConfig = {
    name: 'test-project',
    projectRoot: process.cwd(),
    paths: {},
    features: {},
    prisma: {},
    trpc: {},
    templates: {},
    exclude: [],
    extensions: {},
  };

  describe('TOOLS', () => {
    it('should export tools array', () => {
      expect(Array.isArray(TOOLS)).toBe(true);
      expect(TOOLS.length).toBeGreaterThan(0);
    });

    it('should have required tool properties', () => {
      for (const tool of TOOLS) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(tool.inputSchema).toHaveProperty('properties');
      }
    });

    it('should include krolik_status tool', () => {
      const statusTool = TOOLS.find((t) => t.name === 'krolik_status');
      expect(statusTool).toBeDefined();
      expect(statusTool?.inputSchema.properties).toHaveProperty('fast');
    });

    it('should include krolik_context tool', () => {
      const contextTool = TOOLS.find((t) => t.name === 'krolik_context');
      expect(contextTool).toBeDefined();
      expect(contextTool?.inputSchema.properties).toHaveProperty('feature');
      expect(contextTool?.inputSchema.properties).toHaveProperty('issue');
    });
  });

  describe('MCPServer', () => {
    it('should create server instance', () => {
      const server = new MCPServer(mockConfig);
      expect(server).toBeDefined();
    });

    describe('handleRequest', () => {
      it('should handle initialize request', () => {
        const server = new MCPServer(mockConfig);
        const response = server.handleRequest({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {},
        });

        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe(1);
        expect(response.result).toHaveProperty('protocolVersion');
        expect(response.result).toHaveProperty('serverInfo');
        expect(response.result).toHaveProperty('capabilities');
      });

      it('should handle tools/list request', () => {
        const server = new MCPServer(mockConfig);
        const response = server.handleRequest({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        });

        expect(response.id).toBe(2);
        expect(response.result).toHaveProperty('tools');
        expect(Array.isArray((response.result as { tools: unknown[] }).tools)).toBe(true);
      });

      it('should handle resources/list request', () => {
        const server = new MCPServer(mockConfig);
        const response = server.handleRequest({
          jsonrpc: '2.0',
          id: 3,
          method: 'resources/list',
          params: {},
        });

        expect(response.id).toBe(3);
        expect(response.result).toHaveProperty('resources');
      });

      it('should return error for unknown method', () => {
        const server = new MCPServer(mockConfig);
        const response = server.handleRequest({
          jsonrpc: '2.0',
          id: 4,
          method: 'unknown/method',
          params: {},
        });

        expect(response.error).toBeDefined();
        expect(response.error?.code).toBe(-32601);
      });

      it('should handle notification without id', () => {
        const server = new MCPServer(mockConfig);
        const response = server.handleRequest({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
          params: {},
        });

        expect(response.id).toBeUndefined();
      });
    });
  });
});
