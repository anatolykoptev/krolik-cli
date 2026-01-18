import path from 'node:path';
import { loadContextMemories } from '../src/lib/@context/memory';
import { logger } from '../src/lib/@core/logger/logger';
import { formatInjectedContext, injectContext } from '../src/lib/@ralph/context/injector';

// Mock logger to avoid clutter
// logger.level = 'error';

async function verifySmartContext() {
  console.log('🧪 Verifying Smart Context Logic...\n');

  const projectRoot = process.cwd();
  console.log(`📂 Project Root: ${projectRoot}`);

  // 1. Test Shared Memory Loader
  console.log('\n--- Testing loadContextMemories ---');
  const memories = loadContextMemories(projectRoot, 'authentication', 'auth', 3);

  if (memories.length > 0) {
    console.log(`✅ Loaded ${memories.length} memories related to "authentication"`);
    // biome-ignore lint/suspicious/useIterableCallbackReturn: This is a test script, the return value is not used.
    memories.forEach((m) => console.log(`   - [${m.type}] ${m.title} (${m.importance})`));
  } else {
    console.log('⚠️ No memories found (expected if DB is empty, but function call worked)');
  }

  // 2. Test Ralph Injector
  console.log('\n--- Testing Ralph injectContext ---');
  const mockTask = {
    id: 'test-task-1',
    title: 'Verify Smart Context verify-smart-context', // Keywords to match this file
    description: 'Running verification.',
    files_affected: [],
    acceptance_criteria: ['User can login'],
    complexity: 'medium',
    dependencies: [],
    tags: ['auth', 'security'],
    labels: [],
  };

  try {
    const context = await injectContext(mockTask as any, projectRoot, {
      includeSchema: false,
      includeRoutes: false,
      includeMemories: true,
      memoryLimit: 3,
    });

    const formatted = formatInjectedContext(context);
    console.log(`✅ Context Injection Successful`);
    console.log(`   Context Length: ${formatted.length} chars`);

    if (formatted.includes('<memory-context>')) {
      console.log('   ✅ Contains <memory-context> section');
    } else {
      console.log('   ℹ️ No memories in context (DB empty?)');
    }

    if (formatted.includes('<discovered-files>')) {
      console.log('   ✅ Contains <discovered-files> section');
    } else {
      console.log('   ℹ️ No discovered files (failed to find verification script?)');
    }
  } catch (error) {
    console.error('❌ Context Injection Failed:', error);
  }
}

verifySmartContext().catch(console.error);
