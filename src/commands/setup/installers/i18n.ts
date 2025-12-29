/**
 * @module commands/setup/installers/i18n
 * @description Installer for i18next-cli and i18n configuration
 *
 * Installs i18next-cli for hardcoded string detection and extraction.
 * Creates default i18next.config.ts if not exists.
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CommandContext } from '../../../types';

// ============================================================================
// TYPES
// ============================================================================

interface I18nInstallerOptions {
  dryRun: boolean;
  force?: boolean;
  logger: CommandContext['logger'];
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_I18N_CONFIG = `import { defineConfig } from 'i18next-cli';

export default defineConfig({
  // Supported locales
  locales: ['ru', 'en'],
  defaultLocale: 'ru',

  // Extraction configuration
  extract: {
    input: [
      'apps/web/**/*.{ts,tsx}',
      'packages/shared/**/*.{ts,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/__tests__/**',
      '**/*.stories.{ts,tsx}',
      '**/dist/**',
      '**/*.d.ts',
    ],
    output: 'apps/web/public/locales/{{language}}/{{namespace}}.json',
    defaultNS: 'common',
    functions: ['t', 'i18next.t', 'i18n.t'],
    transComponents: ['Trans'],
  },

  // Linting configuration
  lint: {
    input: [
      'apps/web/app/**/*.{ts,tsx}',
      'apps/web/components/**/*.{ts,tsx}',
    ],
    exclude: [
      '**/*.test.{ts,tsx}',
      '**/i18n/**',
      '**/locales/**',
    ],
    rules: {
      'no-hardcoded-strings': 'warn',
    },
  },

  // TypeScript generation
  types: {
    output: 'packages/shared/src/i18n/types.ts',
    strict: true,
  },
});
`;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if i18next-cli is installed in project
 */
function isI18nextCliInstalled(projectRoot: string): boolean {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return false;

  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return 'i18next-cli' in deps;
  } catch {
    return false;
  }
}

/**
 * Check if i18next.config.ts exists
 */
function hasI18nextConfig(projectRoot: string): boolean {
  const configFiles = ['i18next.config.ts', 'i18next.config.js', 'i18next.config.mjs'];

  return configFiles.some((f) => fs.existsSync(path.join(projectRoot, f)));
}

/**
 * Detect package manager
 */
function detectPackageManager(projectRoot: string): 'pnpm' | 'npm' | 'yarn' {
  if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

// ============================================================================
// INSTALLER
// ============================================================================

/**
 * Install i18next-cli in project
 */
export async function installI18nextCli(
  projectRoot: string,
  options: I18nInstallerOptions,
): Promise<boolean> {
  const { dryRun, force, logger } = options;

  logger.info('📦 i18next-cli Installation\n');

  // Check if already installed
  if (isI18nextCliInstalled(projectRoot) && !force) {
    logger.info('  ✓ i18next-cli already installed\n');
  } else {
    const pm = detectPackageManager(projectRoot);
    const installCmd =
      pm === 'pnpm'
        ? 'pnpm add -D i18next-cli'
        : pm === 'yarn'
          ? 'yarn add -D i18next-cli'
          : 'npm install -D i18next-cli';

    if (dryRun) {
      logger.info(`  [DRY RUN] Would run: ${installCmd}\n`);
    } else {
      logger.info(`  Installing i18next-cli...\n`);
      try {
        execSync(installCmd, { cwd: projectRoot, stdio: 'inherit' });
        logger.info('  ✓ i18next-cli installed\n');
      } catch (error) {
        logger.error(`  ✗ Failed to install i18next-cli\n`);
        return false;
      }
    }
  }

  // Create config if not exists
  if (!hasI18nextConfig(projectRoot)) {
    const configPath = path.join(projectRoot, 'i18next.config.ts');

    if (dryRun) {
      logger.info(`  [DRY RUN] Would create: i18next.config.ts\n`);
    } else {
      logger.info('  Creating i18next.config.ts...\n');
      fs.writeFileSync(configPath, DEFAULT_I18N_CONFIG);
      logger.info('  ✓ i18next.config.ts created\n');
    }
  } else {
    logger.info('  ✓ i18next.config.ts already exists\n');
  }

  // Print next steps
  logger.info('\n📝 i18n Setup Complete!\n');
  logger.info('   Commands available:\n');
  logger.info('   • krolik fix --category i18n --all    - Fix hardcoded strings\n');
  logger.info('   • npx i18next-cli extract             - Extract translation keys\n');
  logger.info('   • npx i18next-cli lint                - Check for hardcoded strings\n');
  logger.info('   • npx i18next-cli sync                - Sync locales\n');

  return true;
}

/**
 * Check i18n setup status
 */
export function checkI18nStatus(projectRoot: string): {
  installed: boolean;
  hasConfig: boolean;
} {
  return {
    installed: isI18nextCliInstalled(projectRoot),
    hasConfig: hasI18nextConfig(projectRoot),
  };
}
