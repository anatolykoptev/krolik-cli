# Environment Variables Parser - Usage Examples

## Quick Start

```typescript
import { parseEnvVars, formatEnvVarsXml } from '@/commands/context/parsers';

// Analyze your project
const report = parseEnvVars('/path/to/your/project');

console.log('Missing vars:', report.missing);
console.log('Unused vars:', report.unused);
```

## Example 1: Basic Analysis

```typescript
import { parseEnvVars } from '@/commands/context/parsers';

const report = parseEnvVars(projectDir);

// Check for missing environment variables
if (report.missing.length > 0) {
  console.error('⚠️  Missing environment variables:');
  for (const name of report.missing) {
    const usages = report.usages.filter(u => u.name === name);
    console.error(`  ${name} (used ${usages.length} times)`);

    // Show where it's used
    for (const usage of usages.slice(0, 3)) {
      console.error(`    → ${usage.file}:${usage.line}`);
    }
  }
  process.exit(1);
}
```

## Example 2: Generate .env.example

```typescript
import { parseEnvVars } from '@/commands/context/parsers';
import * as fs from 'node:fs';

const report = parseEnvVars(projectDir);

// Collect all unique variable names from code
const allVars = new Set(report.usages.map(u => u.name));

// Build .env.example content
const lines: string[] = [];
lines.push('# Auto-generated .env.example');
lines.push('# Generated from code analysis\n');

for (const name of Array.from(allVars).sort()) {
  // Check if already defined
  const existing = report.definitions.find(d => d.name === name);

  if (existing?.comment) {
    lines.push(`# ${existing.comment}`);
  } else {
    // Find first usage to get context
    const usage = report.usages.find(u => u.name === name);
    if (usage) {
      lines.push(`# Used in ${usage.file}`);
    }
  }

  // Check if it has a default
  const hasDefault = report.usages.some(u => u.name === name && u.hasDefault);
  if (hasDefault) {
    lines.push(`# Optional (has default in code)`);
  }

  lines.push(`${name}=""\n`);
}

fs.writeFileSync('.env.example.new', lines.join('\n'));
console.log('✅ Generated .env.example.new');
```

## Example 3: Pre-commit Hook

```typescript
#!/usr/bin/env node
import { parseEnvVars } from '@/commands/context/parsers';

const report = parseEnvVars(process.cwd());

// Fail if missing variables found
if (report.missing.length > 0) {
  console.error('❌ Commit blocked: Missing environment variables\n');
  console.error('The following variables are used in code but not defined:\n');

  for (const name of report.missing) {
    const count = report.usages.filter(u => u.name === name).length;
    console.error(`  • ${name} (used ${count}x)`);
  }

  console.error('\nPlease add them to .env.example before committing.');
  process.exit(1);
}

console.log('✅ Environment variables check passed');
```

## Example 4: CI/CD Validation

```typescript
import { parseEnvVars } from '@/commands/context/parsers';

async function validateEnvVars() {
  const report = parseEnvVars(process.cwd());

  const errors: string[] = [];

  // Check for missing critical variables
  const critical = ['DATABASE_URL', 'API_SECRET', 'AUTH_SECRET'];
  const missing = critical.filter(name =>
    !report.definitions.some(d => d.name === name)
  );

  if (missing.length > 0) {
    errors.push(`Missing critical vars: ${missing.join(', ')}`);
  }

  // Check for vars used in production code without defaults
  const productionFiles = report.usages.filter(u =>
    u.file.includes('src/') && !u.hasDefault
  );

  const requiredVars = new Set(productionFiles.map(u => u.name));
  const undefined = Array.from(requiredVars).filter(name =>
    !report.definitions.some(d => d.name === name && !d.isEmpty)
  );

  if (undefined.length > 0) {
    errors.push(`Required vars without values: ${undefined.join(', ')}`);
  }

  // Report results
  if (errors.length > 0) {
    console.error('❌ Environment validation failed:\n');
    for (const error of errors) {
      console.error(`  • ${error}`);
    }
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
  console.log(`  ${report.definitions.length} variables defined`);
  console.log(`  ${report.usages.length} usages found`);
}

validateEnvVars();
```

## Example 5: Package-specific Report

```typescript
import { parseEnvVars } from '@/commands/context/parsers';

const report = parseEnvVars(projectDir);

// Generate report for each package
console.log('Environment Variables by Package\n');

for (const [pkg, usages] of Object.entries(report.byPackage)) {
  console.log(`📦 ${pkg}`);
  console.log(`   Total usages: ${usages.length}\n`);

  // Group by variable
  const byVar: Record<string, typeof usages> = {};
  for (const usage of usages) {
    if (!byVar[usage.name]) byVar[usage.name] = [];
    byVar[usage.name]!.push(usage);
  }

  // Show variables
  for (const [name, varUsages] of Object.entries(byVar).slice(0, 10)) {
    const isDefined = report.definitions.some(d => d.name === name);
    const icon = isDefined ? '✓' : '✗';
    const hasDefaults = varUsages.some(u => u.hasDefault);

    console.log(`   ${icon} ${name} (${varUsages.length}x)${hasDefaults ? ' [has default]' : ''}`);

    // Show files
    const files = new Set(varUsages.map(u => u.file));
    for (const file of Array.from(files).slice(0, 2)) {
      console.log(`      → ${file}`);
    }
  }

  console.log('');
}
```

## Example 6: Integration with krolik context

```typescript
import { parseEnvVars, formatEnvVarsXml } from '@/commands/context/parsers';

// In context command
export async function generateContext(options: ContextOptions) {
  const sections: string[] = [];

  // ... other context sections

  // Add environment variables analysis
  const envReport = parseEnvVars(options.projectDir);

  if (envReport.missing.length > 0) {
    sections.push(`
<warnings>
  <missing-env-vars count="${envReport.missing.length}">
    ${envReport.missing.map(name => `<var>${name}</var>`).join('\n    ')}
  </missing-env-vars>
</warnings>
    `.trim());
  }

  // Include full env analysis
  sections.push(formatEnvVarsXml(envReport));

  return sections.join('\n\n');
}
```

## Example 7: VS Code Extension Integration

```typescript
import { parseEnvVars } from '@/commands/context/parsers';
import * as vscode from 'vscode';

async function showEnvVarDiagnostics() {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return;

  const report = parseEnvVars(workspaceRoot);

  // Create diagnostics for missing vars
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('env-vars');

  for (const usage of report.usages) {
    if (!report.missing.includes(usage.name)) continue;

    const uri = vscode.Uri.file(usage.file);
    const line = usage.line - 1;
    const range = new vscode.Range(line, usage.column, line, usage.column + usage.name.length);

    const diagnostic = new vscode.Diagnostic(
      range,
      `Environment variable "${usage.name}" is not defined in .env.example`,
      vscode.DiagnosticSeverity.Warning
    );

    diagnostic.code = 'missing-env-var';
    diagnostic.source = 'krolik';

    const existing = diagnosticCollection.get(uri) ?? [];
    diagnosticCollection.set(uri, [...existing, diagnostic]);
  }
}
```

## Example 8: Documentation Generator

```typescript
import { parseEnvVars } from '@/commands/context/parsers';
import * as fs from 'node:fs';

const report = parseEnvVars(projectDir);

// Generate markdown documentation
const lines: string[] = [];
lines.push('# Environment Variables\n');
lines.push('> Auto-generated from code analysis\n');

// Group by category (based on prefix)
const byCategory: Record<string, typeof report.definitions> = {
  'Database': [],
  'Auth': [],
  'API': [],
  'Features': [],
  'Other': [],
};

for (const def of report.definitions) {
  if (def.name.includes('DATABASE') || def.name.includes('DB_')) {
    byCategory['Database']!.push(def);
  } else if (def.name.includes('AUTH') || def.name.includes('SECRET')) {
    byCategory['Auth']!.push(def);
  } else if (def.name.includes('API') || def.name.includes('URL')) {
    byCategory['API']!.push(def);
  } else if (def.name.startsWith('NEXT_PUBLIC_') || def.name.startsWith('EXPO_PUBLIC_')) {
    byCategory['Features']!.push(def);
  } else {
    byCategory['Other']!.push(def);
  }
}

for (const [category, defs] of Object.entries(byCategory)) {
  if (defs.length === 0) continue;

  lines.push(`## ${category}\n`);

  for (const def of defs) {
    const usage = report.usages.filter(u => u.name === def.name);
    const required = usage.some(u => !u.hasDefault);

    lines.push(`### \`${def.name}\`${required ? ' *(required)*' : ' *(optional)*'}\n`);

    if (def.comment) {
      lines.push(`${def.comment}\n`);
    }

    if (def.value && !def.isEmpty) {
      lines.push(`**Example:** \`${def.value}\`\n`);
    }

    if (usage.length > 0) {
      lines.push(`**Used in:**`);
      const files = new Set(usage.map(u => u.file));
      for (const file of Array.from(files).slice(0, 3)) {
        lines.push(`- \`${file}\``);
      }
      lines.push('');
    }
  }
}

fs.writeFileSync('ENV_VARS.md', lines.join('\n'));
console.log('✅ Generated ENV_VARS.md');
```

## Example 9: Required vs Optional Report

```typescript
import { parseEnvVars } from '@/commands/context/parsers';

const report = parseEnvVars(projectDir);

// Categorize variables
const required: string[] = [];
const optional: string[] = [];

for (const name of new Set(report.usages.map(u => u.name))) {
  const usages = report.usages.filter(u => u.name === name);
  const allHaveDefaults = usages.every(u => u.hasDefault);

  if (allHaveDefaults) {
    optional.push(name);
  } else {
    required.push(name);
  }
}

console.log('Required Environment Variables:');
for (const name of required.sort()) {
  const def = report.definitions.find(d => d.name === name);
  const status = def ? '✓' : '✗';
  console.log(`  ${status} ${name}`);
}

console.log('\nOptional Environment Variables (have defaults):');
for (const name of optional.sort()) {
  const usage = report.usages.find(u => u.name === name);
  console.log(`  • ${name} (default: ${usage?.defaultValue ?? 'yes'})`);
}
```

## Example 10: Monorepo Package Isolation

```typescript
import { parseEnvVars } from '@/commands/context/parsers';

const report = parseEnvVars(projectDir);

// Check for cross-package variable usage
const problems: string[] = [];

// Web should only use NEXT_PUBLIC_* in client code
const webUsages = report.byPackage['web'] ?? [];
const clientVars = webUsages.filter(u =>
  u.file.includes('app/') || u.file.includes('components/')
);

for (const usage of clientVars) {
  if (!usage.name.startsWith('NEXT_PUBLIC_')) {
    problems.push(
      `❌ ${usage.file}:${usage.line} - Client code uses server var: ${usage.name}`
    );
  }
}

// API should not use NEXT_PUBLIC_*
const apiUsages = report.byPackage['api'] ?? [];
for (const usage of apiUsages) {
  if (usage.name.startsWith('NEXT_PUBLIC_')) {
    problems.push(
      `❌ ${usage.file}:${usage.line} - Server code uses client var: ${usage.name}`
    );
  }
}

if (problems.length > 0) {
  console.error('Environment variable usage violations:\n');
  for (const problem of problems) {
    console.error(problem);
  }
  process.exit(1);
}
```

## Running Examples

```bash
# Test parser
npx tsx src/commands/context/parsers/env-vars.test.ts

# Full example
npx tsx src/commands/context/parsers/env-vars.example.ts

# Use in your own script
npx tsx your-script.ts
```
