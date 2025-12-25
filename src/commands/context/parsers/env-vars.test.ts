/**
 * Quick test for env-vars parser
 *
 * Run with: npx tsx src/commands/context/parsers/env-vars.test.ts
 */

import { formatEnvVarsXml, parseEnvVars } from './env-vars';

// Test with krolik-cli itself (should find minimal env vars if any)
const projectDir = process.cwd();

console.log('Testing env-vars parser...\n');
console.log(`Project: ${projectDir}\n`);

const report = parseEnvVars(projectDir);

console.log('✅ Parser executed successfully!');
console.log('');
console.log('📊 Results:');
console.log(`  Usages found: ${report.usages.length}`);
console.log(`  Definitions found: ${report.definitions.length}`);
console.log(`  Missing: ${report.missing.length}`);
console.log(`  Unused: ${report.unused.length}`);
console.log('');

if (report.usages.length > 0) {
  console.log('🔍 Sample usages (first 5):');
  for (const usage of report.usages.slice(0, 5)) {
    console.log(`  - ${usage.name} in ${usage.file}:${usage.line} (${usage.pattern})`);
    if (usage.hasDefault) {
      console.log(`    → has default: ${usage.defaultValue ?? 'yes'}`);
    }
  }
  console.log('');
}

if (report.definitions.length > 0) {
  console.log('📝 Definitions (first 5):');
  for (const def of report.definitions.slice(0, 5)) {
    console.log(`  - ${def.name} in ${def.file}`);
    if (def.comment) {
      console.log(`    → ${def.comment.split('\n')[0]}`);
    }
  }
  console.log('');
}

// Test XML generation
console.log('📄 Testing XML generation...');
const xml = formatEnvVarsXml(report);
const lines = xml.split('\n');
console.log(`✅ Generated ${lines.length} lines of XML`);
console.log('');

// Show structure
console.log('XML structure:');
console.log(lines.slice(0, 15).join('\n'));
if (lines.length > 15) {
  console.log('...');
}
console.log('');

console.log('✅ All tests passed!');
