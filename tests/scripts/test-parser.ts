/**
 * Test script to compare regex-based and SWC-based type parsers
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import both parsers
const regexParserPath = './src/commands/context/parsers/types-parser.ts';
const swcParserPath = './src/commands/context/parsers/types-parser-swc.ts';

async function testParsers() {
  console.log('Testing Type Parsers\n');
  console.log('='.repeat(60));

  const testFile = path.join(__dirname, 'test-types-sample.ts');

  if (!fs.existsSync(testFile)) {
    console.error('Test file not found:', testFile);
    process.exit(1);
  }

  console.log('\nTest file:', testFile);
  console.log('='.repeat(60));

  try {
    // Test SWC parser
    console.log('\n📦 SWC-based Parser Results:\n');
    const { parseTypesInDir: parseSwc } = await import(swcParserPath);
    const swcResults = parseSwc(__dirname, ['test-types-sample']);

    console.log(`Found ${swcResults.length} types:\n`);
    swcResults.forEach((type, i) => {
      console.log(`${i + 1}. ${type.kind} ${type.name}`);
      if (type.extends) {
        console.log(`   extends: ${type.extends.join(', ')}`);
      }
      if (type.description) {
        console.log(`   description: ${type.description}`);
      }
      if (type.properties) {
        console.log(`   properties (${type.properties.length}):`);
        type.properties.forEach((prop) => {
          console.log(`     - ${prop.name}${prop.optional ? '?' : ''}: ${prop.type}`);
        });
      }
      console.log();
    });

    console.log('='.repeat(60));

    // Test regex parser for comparison
    console.log('\n📝 Regex-based Parser Results (for comparison):\n');
    const { parseTypesInDir: parseRegex } = await import(regexParserPath);
    const regexResults = parseRegex(__dirname, ['test-types-sample']);

    console.log(`Found ${regexResults.length} types:\n`);
    regexResults.forEach((type, i) => {
      console.log(`${i + 1}. ${type.kind} ${type.name}`);
      if (type.extends) {
        console.log(`   extends: ${type.extends.join(', ')}`);
      }
      if (type.description) {
        console.log(`   description: ${type.description}`);
      }
      if (type.properties) {
        console.log(`   properties (${type.properties.length}):`);
        type.properties.forEach((prop) => {
          console.log(`     - ${prop.name}${prop.optional ? '?' : ''}: ${prop.type}`);
        });
      }
      console.log();
    });

    console.log('='.repeat(60));
    console.log('\n✅ Both parsers executed successfully');
  } catch (error) {
    console.error('\n❌ Error during testing:', error);
    process.exit(1);
  }
}

testParsers().catch(console.error);
