import * as fs from 'node:fs';
import * as path from 'node:path';
import { ActionPlugin } from '../src/lib/@ralph/plugins/action-plugin';

async function verifyRalphActions() {
  console.log('🧪 Verifying Ralph Actions logic...\n');
  const projectRoot = process.cwd();

  // 1. Initialize Plugin
  const plugin = new ActionPlugin({ projectRoot });
  console.log('✅ ActionPlugin initialized');

  const tools = plugin.getTools();
  console.log(`✅ Loaded ${tools.length} tools: ${tools.map((t) => t.name).join(', ')}`);

  // Mock tool context
  const toolContext = {} as any;

  // 2. Test fs tools
  const testFile = 'test-ralph-action.txt';
  const testContent = 'Hello from Ralph Action Plugin!';

  try {
    // Write
    const writeTool = tools.find((t) => t.name === 'write_file');
    if (writeTool) {
      await writeTool.runAsync({ args: { path: testFile, content: testContent }, toolContext });
      console.log('✅ write_file executed successfully');

      if (fs.existsSync(testFile) && fs.readFileSync(testFile, 'utf-8') === testContent) {
        console.log('   -> File verified on disk');
      } else {
        console.error('   -> File check failed');
      }
    }

    // Read
    const readTool = tools.find((t) => t.name === 'read_file');
    if (readTool) {
      const content = await readTool.runAsync({ args: { path: testFile }, toolContext });
      console.log(`✅ read_file executed: "${content}"`);
    }

    // Replace
    const replaceTool = tools.find((t) => t.name === 'replace_in_file');
    if (replaceTool) {
      // @ts-expect-error
      await replaceTool.runAsync({
        args: { path: testFile, search: 'Ralph', replace: 'Super Ralph' },
        toolContext,
      });
      const content = fs.readFileSync(testFile, 'utf-8');
      if (content.includes('Super Ralph')) {
        console.log('✅ replace_in_file executed successfully');
      } else {
        console.error('   -> Replace failed');
      }
    }

    // Cleanup
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  } catch (e) {
    console.error('❌ FS Tools check failed:', e);
  }

  // 3. Test Shell Tool
  try {
    const shellTool = tools.find((t) => t.name === 'run_command');
    if (shellTool) {
      // @ts-expect-error
      const output = await shellTool.runAsync({
        args: { command: 'echo "Ralph Shell Test"' },
        toolContext,
      });
      // Output might be unknown, cast to string
      if (String(output).includes('Ralph Shell Test')) {
        console.log('✅ run_command executed successfully');
      } else {
        console.error('   -> Command output mismatch:', output);
      }
    }
    // 4. Test Grep Tool
    try {
      const grepTool = tools.find((t) => t.name === 'grep_search');
      if (grepTool) {
        // @ts-expect-error
        const output = await grepTool.runAsync({
          args: { query: 'ActionPlugin', includes: ['*.ts'] },
          toolContext,
        });
        if (String(output).includes('export class ActionPlugin')) {
          console.log('✅ grep_search executed successfully');
        } else {
          console.warn(
            "   ⚠️ grep_search ran but maybe didn't find expected content (or grep mismatch)",
          );
          console.log('Output:', output);
        }
      }
    } catch (e) {
      console.error('❌ Grep Tool check failed:', e);
    }
  } catch (e) {
    console.error('❌ Shell Tool check failed:', e);
  }
}

verifyRalphActions().catch(console.error);
