# Модуль Hardcoded Detection для KROLIK CLI (audit command)

## Архитектура

`hardcoded-detection` интегрируется как **аудитор** в команду `krolik audit`.

Отчет выводится в формате **XML** по пути `.krolik/REPORT.xml`.

## Структура проекта

```
src/
├── commands/
│   ├── audit.ts              # Команда: krolik audit
│   └── index.ts
├── auditors/
│   ├── hardcoded-detection/
│   │   ├── index.ts          # HardcodedDetectionAuditor
│   │   ├── detector.ts       # Основной детектор
│   │   ├── patterns.ts       # Регулярные выражения
│   │   ├── fixer.ts          # Автоматическое исправление
│   │   ├── formatter.ts      # Форматирование отчетов (XML, JSON, Markdown)
│   │   └── types.ts          # TypeScript интерфейсы
│   ├── security-auditor/     # Другие аудиторы
│   ├── performance-auditor/
│   └── index.ts              # Registry аудиторов
└── index.ts
```

## 1. Типы и интерфейсы (`src/auditors/hardcoded-detection/types.ts`)

```typescript
export type IssueType = 
  | 'ip-address' 
  | 'password' 
  | 'api-key' 
  | 'secret' 
  | 'magic-number' 
  | 'db-url' 
  | 'aws-credential'
  | 'gcp-credential'

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export interface Location {
  file: string
  line: number
  column: number
}

export interface AuditIssue {
  id: string
  type: IssueType
  severity: Severity
  location: Location
  value: string
  context: string
  description: string
  suggestion: string
  cwe?: string
  confidence: number
  falsePositiveRisk: number
}

export interface AuditResult {
  auditorName: string
  auditorVersion: string
  timestamp: Date
  
  issues: AuditIssue[]
  
  summary: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
    byType: Record<IssueType, number>
  }
  
  files: {
    scanned: number
    affected: number
  }
  
  executionTime: number
  priority: number // 0-100
  impact: string  // 'critical' | 'high' | 'medium' | 'low'
}

export interface IAuditor {
  name: string
  version: string
  description: string
  
  run(options: AuditOptions): Promise<AuditResult>
  canFix(): boolean
  fix?(issues: AuditIssue[], dryRun: boolean): Promise<FixResult>
}

export interface AuditOptions {
  projectPath: string
  severity?: Severity
  verbose?: boolean
  dryRun?: boolean
  exclude?: string[]
  include?: string[]
}

export interface FixResult {
  timestamp: Date
  issuesFixed: number
  issuesFailed: number
  files: Array<{
    path: string
    changes: number
    fixed: AuditIssue[]
    failed: AuditIssue[]
  }>
}
```

## 2. Главный Auditor (`src/auditors/hardcoded-detection/index.ts`)

```typescript
import { IAuditor, AuditOptions, AuditResult, AuditIssue, FixResult } from './types'
import { HardcodedDetector } from './detector'
import { HardcodedFixer } from './fixer'

export class HardcodedDetectionAuditor implements IAuditor {
  name = 'hardcoded-detection'
  version = '1.0.0'
  description = 'Detect hardcoded values in TypeScript code (secrets, IP addresses, passwords, etc.)'

  async run(options: AuditOptions): Promise<AuditResult> {
    const startTime = Date.now()
    
    try {
      const detector = new HardcodedDetector(options)
      const detectionResult = await detector.detect()

      const auditResult: AuditResult = {
        auditorName: this.name,
        auditorVersion: this.version,
        timestamp: new Date(),
        
        issues: detectionResult.issues,
        summary: detectionResult.summary,
        files: {
          scanned: detectionResult.files.scanned,
          affected: detectionResult.files.affected,
        },
        
        executionTime: Date.now() - startTime,
        priority: this.calculatePriority(detectionResult.summary),
        impact: this.calculateImpact(detectionResult.summary),
      }

      return auditResult
    } catch (error) {
      throw new Error(`Hardcoded detection audit failed: ${error.message}`)
    }
  }

  canFix(): boolean {
    return true
  }

  async fix(issues: AuditIssue[], dryRun: boolean = false): Promise<FixResult> {
    const fixer = new HardcodedFixer()
    return await fixer.fixIssues(issues, dryRun)
  }

  private calculatePriority(summary: any): number {
    if (summary.critical > 0) return 100
    if (summary.high > 0) return 75
    if (summary.medium > 0) return 50
    return 25
  }

  private calculateImpact(summary: any): string {
    if (summary.critical > 0) return 'critical'
    if (summary.high > 0) return 'high'
    if (summary.medium > 0) return 'medium'
    return 'low'
  }
}

export * from './types'
export * from './detector'
export * from './fixer'
```

## 3. Registry аудиторов (`src/auditors/index.ts`)

```typescript
import { IAuditor } from './hardcoded-detection/types'
import { HardcodedDetectionAuditor } from './hardcoded-detection'
import { SecurityAuditor } from './security-auditor'
import { PerformanceAuditor } from './performance-auditor'

export const AUDITORS: Record<string, IAuditor> = {
  'hardcoded-detection': new HardcodedDetectionAuditor(),
  'security-auditor': new SecurityAuditor(),
  'performance-auditor': new PerformanceAuditor(),
}

export function getAuditor(name: string): IAuditor | undefined {
  return AUDITORS[name]
}

export function getAllAuditors(): IAuditor[] {
  return Object.values(AUDITORS)
}

export * from './hardcoded-detection'
```

## 4. Команда audit (`src/commands/audit.ts`)

```typescript
import { Command } from 'commander'
import { getAllAuditors, getAuditor } from '../auditors'
import { formatAuditReport, formatAuditSummary } from '../auditors/hardcoded-detection/formatter'
import { writeFileSync, mkdirSync } from 'fs'

export function createAuditCommand(): Command {
  return new Command('audit')
    .description('Analyze entire codebase and create a prioritized quality report')
    .option('--only <auditor>', 'Run only specific auditor (hardcoded-detection, security-auditor, etc.)')
    .option('--exclude <auditors>', 'Exclude specific auditors (comma-separated)')
    .option('--severity <level>', 'Minimum severity level: critical, high, medium, low')
    .option('--fix', 'Fix detected issues automatically')
    .option('--dry-run', 'Preview fixes without applying')
    .option('--report <format>', 'Output format: xml, json, markdown, html (default: xml)')
    .option('--output <path>', 'Output file path (default: .krolik/REPORT.xml)')
    .option('--verbose', 'Verbose output')
    .action(async (options) => {
      await runAudit(process.cwd(), options)
    })
}

async function runAudit(projectPath: string, options: any) {
  const startTime = Date.now()
  const allAuditors = getAllAuditors()
  
  let auditorsToRun = allAuditors
  
  if (options.only) {
    const auditor = getAuditor(options.only)
    if (!auditor) {
      console.error(`Auditor '${options.only}' not found`)
      process.exit(1)
    }
    auditorsToRun = [auditor]
  }
  
  if (options.exclude) {
    const excluded = options.exclude.split(',').map((s: string) => s.trim())
    auditorsToRun = auditorsToRun.filter(a => !excluded.includes(a.name))
  }

  const auditOptions = {
    projectPath,
    severity: options.severity as any,
    verbose: options.verbose || false,
    dryRun: options.dryRun || false,
  }

  console.log('🔍 Starting comprehensive code audit...\n')
  
  const allResults = []
  for (const auditor of auditorsToRun) {
    console.log(`📊 Running ${auditor.name}...`)
    try {
      const result = await auditor.run(auditOptions)
      allResults.push(result)
      console.log(`   Found ${result.summary.total} issues`)
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`)
    }
  }

  allResults.sort((a, b) => b.priority - a.priority)

  if (options.fix) {
    console.log('\n🔧 Fixing detected issues...\n')
    for (const auditor of auditorsToRun) {
      if (auditor.canFix()) {
        const auditResult = allResults.find(r => r.auditorName === auditor.name)
        if (auditResult && auditResult.issues.length > 0) {
          try {
            const fixResult = await auditor.fix!(auditResult.issues, options.dryRun)
            console.log(`✅ ${auditor.name}: Fixed ${fixResult.issuesFixed} issues`)
          } catch (error) {
            console.error(`❌ ${auditor.name}: Failed to fix - ${error.message}`)
          }
        }
      }
    }
  }

  const reportFormat = options.report || 'xml'
  const outputPath = options.output || '.krolik/REPORT.xml'
  
  const report = formatAuditReport(allResults, reportFormat)
  
  const dir = outputPath.substring(0, outputPath.lastIndexOf('/'))
  if (dir) {
    mkdirSync(dir, { recursive: true })
  }
  
  writeFileSync(outputPath, report)
  
  console.log(`\n✨ Audit complete! Report saved to: ${outputPath}`)
  console.log(`\n${formatAuditSummary(allResults)}`)

  const executionTime = Date.now() - startTime
  console.log(`\n⏱️  Total execution time: ${executionTime}ms`)
  
  const hasCritical = allResults.some(r => r.summary.critical > 0)
  process.exit(hasCritical ? 1 : 0)
}
```

## 5. Форматер отчетов (`src/auditors/hardcoded-detection/formatter.ts`)

```typescript
import { AuditResult } from './types'

export function formatAuditReport(results: AuditResult[], format: string = 'xml'): string {
  if (format === 'json') {
    return JSON.stringify(results, null, 2)
  }

  if (format === 'html') {
    return formatHtmlReport(results)
  }

  if (format === 'markdown') {
    return formatMarkdownReport(results)
  }

  return formatXmlReport(results)
}

function formatXmlReport(results: AuditResult[]): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
  xml += `<audit-report generated="${new Date().toISOString()}">\n`
  xml += `  <summary>\n`

  const totalIssues = results.reduce((sum, r) => sum + r.summary.total, 0)
  const totalCritical = results.reduce((sum, r) => sum + r.summary.critical, 0)
  const totalHigh = results.reduce((sum, r) => sum + r.summary.high, 0)
  const totalMedium = results.reduce((sum, r) => sum + r.summary.medium, 0)
  const totalLow = results.reduce((sum, r) => sum + r.summary.low, 0)

  xml += `    <total-issues>${totalIssues}</total-issues>\n`
  xml += `    <critical>${totalCritical}</critical>\n`
  xml += `    <high>${totalHigh}</high>\n`
  xml += `    <medium>${totalMedium}</medium>\n`
  xml += `    <low>${totalLow}</low>\n`
  xml += `  </summary>\n\n`

  for (const result of results.sort((a, b) => b.priority - a.priority)) {
    xml += `  <auditor name="${escapeXml(result.auditorName)}" version="${result.auditorVersion}">\n`
    xml += `    <priority>${result.priority}</priority>\n`
    xml += `    <impact>${result.impact}</impact>\n`
    xml += `    <execution-time>${result.executionTime}ms</execution-time>\n`
    xml += `    <files-scanned>${result.files.scanned}</files-scanned>\n`
    xml += `    <files-affected>${result.files.affected}</files-affected>\n`

    if (result.issues.length > 0) {
      xml += `    <issues count="${result.issues.length}">\n`

      for (const issue of result.issues) {
        xml += `      <issue severity="${issue.severity}" type="${issue.type}">\n`
        xml += `        <id>${issue.id}</id>\n`
        xml += `        <file>${escapeXml(issue.location.file)}</file>\n`
        xml += `        <line>${issue.location.line}</line>\n`
        xml += `        <column>${issue.location.column}</column>\n`
        xml += `        <value>${escapeXml(issue.value)}</value>\n`
        xml += `        <context>${escapeXml(issue.context)}</context>\n`
        xml += `        <description>${escapeXml(issue.description)}</description>\n`
        xml += `        <suggestion>${escapeXml(issue.suggestion)}</suggestion>\n`
        xml += `        <confidence>${issue.confidence}</confidence>\n`
        xml += `        <false-positive-risk>${issue.falsePositiveRisk}</false-positive-risk>\n`
        if (issue.cwe) {
          xml += `        <cwe>${issue.cwe}</cwe>\n`
        }
        xml += `      </issue>\n`
      }

      xml += `    </issues>\n`
    }

    xml += `  </auditor>\n\n`
  }

  xml += `</audit-report>`
  return xml
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatMarkdownReport(results: AuditResult[]): string {
  let md = `# Code Audit Report\n\n`
  md += `Generated: ${new Date().toISOString()}\n\n`
  md += `## Executive Summary\n\n`
  
  const totalIssues = results.reduce((sum, r) => sum + r.summary.total, 0)
  const totalCritical = results.reduce((sum, r) => sum + r.summary.critical, 0)
  const totalHigh = results.reduce((sum, r) => sum + r.summary.high, 0)
  
  md += `- **Total Issues**: ${totalIssues}\n`
  md += `- **Critical**: ${totalCritical}\n`
  md += `- **High**: ${totalHigh}\n\n`

  for (const result of results.sort((a, b) => b.priority - a.priority)) {
    md += `## ${result.auditorName}\n\n`
    md += `**Priority**: ${result.priority}/100 | **Impact**: ${result.impact}\n\n`
    md += `- Total: ${result.summary.total}\n`
    md += `- Critical: ${result.summary.critical}\n`
    md += `- High: ${result.summary.high}\n`
    md += `- Execution Time: ${result.executionTime}ms\n\n`

    if (result.issues.length > 0) {
      md += `### Issues\n\n`
      for (const issue of result.issues) {
        md += `- **${issue.severity}** ${issue.type} (${issue.location.file}:${issue.location.line})\n`
        md += `  ${issue.description}\n`
        md += `  💡 ${issue.suggestion}\n\n`
      }
    }
  }

  return md
}

function formatHtmlReport(results: AuditResult[]): string {
  return `<html><!-- TODO: Implement HTML report --></html>`
}

export function formatAuditSummary(results: AuditResult[]): string {
  const lines: string[] = []
  
  lines.push('📋 Audit Summary by Priority:')
  lines.push('')
  
  for (const result of results.sort((a, b) => b.priority - a.priority)) {
    const emoji = 
      result.impact === 'critical' ? '🔴' :
      result.impact === 'high' ? '🟠' :
      result.impact === 'medium' ? '🟡' : '🟢'
    
    lines.push(`${emoji} ${result.auditorName}: ${result.summary.total} issues (priority: ${result.priority}/100)`)
    
    if (result.summary.critical > 0) {
      lines.push(`   ⚠️  ${result.summary.critical} critical`)
    }
  }
  
  return lines.join('\n')
}
```

## Использование

```bash
# Полный аудит (все аудиторы)
krolik audit

# Результат: .krolik/REPORT.xml

# Только hardcoded-detection
krolik audit --only hardcoded-detection

# Исключить аудиторы
krolik audit --exclude security-auditor,performance-auditor

# Исправить issues
krolik audit --fix

# Preview исправлений
krolik audit --fix --dry-run

# Фильтр по severity
krolik audit --severity critical

# JSON формат
krolik audit --report json

# Markdown формат
krolik audit --report markdown

# Пользовательский путь
krolik audit --output ./reports/security-audit.xml
```

## Преимущества архитектуры

1. **Модульность** - независимые аудиторы
2. **Приоритизация** - автоматическая сортировка по важности
3. **XML-формат** - легко парсить и интегрировать в CI/CD
4. **Исправления** - встроенная система автоматического фикса
5. **Гибкость** - поддержка JSON, Markdown, HTML форматов
