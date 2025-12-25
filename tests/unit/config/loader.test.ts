import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearConfigCache,
  defineConfig,
  findProjectRoot,
  loadConfig,
} from '../../../src/config/loader';

describe('config/loader', () => {
  beforeEach(() => {
    clearConfigCache();
  });

  describe('findProjectRoot', () => {
    it('should find project root from current directory', () => {
      const root = findProjectRoot();
      expect(root).toBeTruthy();
      expect(root).toContain('krolik-cli');
    });

    it('should return start dir if no package.json found', () => {
      const root = findProjectRoot('/');
      expect(root).toBe('/');
    });
  });

  describe('loadConfig', () => {
    it('should load and resolve config', async () => {
      const config = await loadConfig();

      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('projectRoot');
      expect(config).toHaveProperty('paths');
      expect(config).toHaveProperty('features');
      expect(config).toHaveProperty('prisma');
      expect(config).toHaveProperty('trpc');
      expect(config).toHaveProperty('exclude');
    });

    it('should cache config by default', async () => {
      const config1 = await loadConfig();
      const config2 = await loadConfig();

      expect(config1).toBe(config2);
    });

    it('should not cache when noCache is true', async () => {
      const config1 = await loadConfig();
      const config2 = await loadConfig({ noCache: true });

      // Objects are different instances but have same values
      expect(config1).not.toBe(config2);
      expect(config1.projectRoot).toBe(config2.projectRoot);
    });
  });

  describe('defineConfig', () => {
    it('should return the same config object', () => {
      const input = { name: 'test' };
      const output = defineConfig(input);
      expect(output).toBe(input);
    });

    it('should provide type checking', () => {
      const config = defineConfig({
        name: 'my-project',
        paths: { web: 'apps/web' },
        features: { prisma: true },
      });

      expect(config.name).toBe('my-project');
      expect(config.paths?.web).toBe('apps/web');
      expect(config.features?.prisma).toBe(true);
    });
  });
});
