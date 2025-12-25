/**
 * Example usage of env-vars parser
 *
 * Run with: npx tsx src/commands/context/parsers/env-vars.example.ts
 */

import { formatEnvVarsXml, parseEnvVars } from './env-vars';

// Example: analyze a project
// Adjust this path to your project location
const projectDir = process.cwd();

console.log('🔍 Analyzing environment variables...\n');
console.log(`Project: ${projectDir}\n`);

const report = parseEnvVars(projectDir);

console.log('📊 Summary:');
console.log(`  Total usages: ${report.usages.length}`);
console.log(`  Total definitions: ${report.definitions.length}`);
console.log(`  Missing variables: ${report.missing.length}`);
console.log(`  Unused variables: ${report.unused.length}`);
console.log('');

if (report.missing.length > 0) {
  console.log('⚠️  Missing variables (used but not defined):');
  for (const name of report.missing.slice(0, 10)) {
    const usageCount = report.usages.filter((u) => u.name === name).length;
    const firstUsage = report.usages.find((u) => u.name === name);
    console.log(`  - ${name} (used ${usageCount}x)`);
    if (firstUsage) {
      console.log(`    → ${firstUsage.file}:${firstUsage.line}`);
    }
  }
  if (report.missing.length > 10) {
    console.log(`  ... and ${report.missing.length - 10} more`);
  }
  console.log('');
}

if (report.unused.length > 0) {
  console.log('ℹ️  Unused variables (defined but never used):');
  for (const name of report.unused.slice(0, 10)) {
    const def = report.definitions.find((d) => d.name === name);
    console.log(`  - ${name} (${def?.file})`);
  }
  if (report.unused.length > 10) {
    console.log(`  ... and ${report.unused.length - 10} more`);
  }
  console.log('');
}

console.log('📦 Usage by package:');
const packages = Object.keys(report.byPackage).sort();
for (const pkg of packages) {
  const pkgUsages = report.byPackage[pkg] ?? [];
  console.log(`  ${pkg}: ${pkgUsages.length} usages`);

  // Show top 3 variables
  const byName: Record<string, number> = {};
  for (const usage of pkgUsages) {
    byName[usage.name] = (byName[usage.name] ?? 0) + 1;
  }
  const sorted = Object.entries(byName)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [name, count] of sorted) {
    const isDefined = !report.missing.includes(name);
    const marker = isDefined ? '✓' : '✗';
    console.log(`    ${marker} ${name} (${count}x)`);
  }
}
console.log('');

// Generate XML report
console.log('📄 Generating XML report...');
const xml = formatEnvVarsXml(report);
console.log(`\n${xml.split('\n').slice(0, 30).join('\n')}`);
console.log('...\n');

console.log('✅ Analysis complete!');
