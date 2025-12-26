# Universal Reusable Code Detection System

> Design document for a zero-configuration system that identifies reusable modules across any TypeScript/JavaScript codebase.

## Problem Statement

Current implementation uses hardcoded `lib/@*` pattern to find reusable modules. This fails for:
- Different folder structures (`utils/`, `helpers/`, `shared/`)
- UI component libraries (`components/`, `src/ui/`)
- React hooks (`hooks/`, `src/hooks/`)
- Monorepo packages with various structures
- Backend services and API layers

## Design Goals

1. **Zero Configuration**: Works out of the box on any project
2. **Smart Detection**: Uses multiple signals, not just folder names
3. **Accurate Categorization**: Automatically classifies modules by purpose
4. **Configurable**: Power users can override defaults
5. **Fast**: Leverages existing SWC-based analysis

---

## Detection Algorithm

### Phase 1: Directory Heuristics (Fast Pass)

Scan project structure for common reusable code patterns:

```
REUSABLE_DIRECTORY_PATTERNS = [
  // Explicit reusable directories
  'lib/**',           'libs/**',
  'utils/**',         'utilities/**',
  'helpers/**',       'shared/**',
  'common/**',        'core/**',

  // UI patterns
  'components/**',    'ui/**',
  'primitives/**',    'atoms/**',
  'molecules/**',     'organisms/**',

  // React-specific
  'hooks/**',         'contexts/**',
  'providers/**',     'hocs/**',

  // Type/Schema patterns
  'types/**',         'interfaces/**',
  'schemas/**',       'models/**',
  'contracts/**',     'dtos/**',

  // Service patterns
  'services/**',      'api/**',
  'clients/**',       'integrations/**',

  // Config patterns
  'config/**',        'constants/**',
  'settings/**',

  // Monorepo patterns
  'packages/*/src/**',
  'packages/shared/**',
  'packages/common/**',
  'packages/ui/**',
]
```

**Scoring for directory match:**
- Exact match (e.g., `lib/`): +30 points
- Nested match (e.g., `src/lib/`): +25 points
- Deep nested (e.g., `apps/web/lib/`): +20 points

### Phase 2: Export Pattern Analysis

Analyze each file's exports to determine reusability:

```typescript
interface ExportAnalysis {
  namedExportCount: number;      // Named exports indicate reusability
  defaultExportOnly: boolean;    // Single default = less reusable
  hasBarrelFile: boolean;        // index.ts re-exports = organized module
  exportedFunctions: number;
  exportedTypes: number;
  exportedClasses: number;
  exportedConstants: number;
}
```

**Scoring:**
- 3+ named exports: +20 points
- Has index.ts barrel: +15 points
- Exports types/interfaces: +10 points
- Default export only: -10 points (likely a component/page)

### Phase 3: Import Frequency Analysis

Count how often each module is imported across the codebase:

```typescript
interface ImportStats {
  importedByCount: number;       // How many files import this
  importedByDifferentDirs: number; // Diversity of consumers
  isImportedAcrossPackages: boolean; // Cross-package usage
}
```

**Scoring:**
- Imported by 5+ files: +25 points
- Imported from 3+ different directories: +20 points
- Cross-package imports: +30 points

### Phase 4: Naming Convention Analysis

Detect common naming patterns:

```typescript
REUSABLE_NAME_PATTERNS = {
  hooks: /^use[A-Z]/,           // useAuth, useState
  utilities: /^(get|set|create|build|parse|format|validate|convert|transform)/,
  guards: /^(is|has|can|should|will)/,
  constants: /^[A-Z_]+$/,       // CONSTANTS
  types: /^(I[A-Z]|T[A-Z]|.*Type$|.*Props$|.*Config$)/,
  schemas: /(Schema|Validator|Dto)$/,
  services: /(Service|Client|Api|Repository)$/,
  components: /^[A-Z][a-z].*$/,  // PascalCase
}
```

**Scoring:**
- Matches utility pattern: +15 points
- Matches hook pattern: +15 points
- Matches schema pattern: +10 points

### Phase 5: JSDoc/Comment Analysis

Extract metadata from documentation:

```typescript
interface DocAnalysis {
  hasModuleDoc: boolean;         // @module tag
  hasExamples: boolean;          // @example blocks
  hasPublicApi: boolean;         // @public or @api tags
  mentionsReusable: boolean;     // "reusable", "shared", "utility"
  hasSeeAlso: boolean;           // @see references
}
```

**Scoring:**
- Has @module doc: +15 points
- Has @example: +10 points
- Has @public/@api: +10 points
- Mentions reusability: +5 points

---

## Final Reusability Score

```typescript
type ReusabilityLevel = 'core' | 'high' | 'medium' | 'low' | 'none';

function calculateReusabilityLevel(score: number): ReusabilityLevel {
  if (score >= 80) return 'core';    // Essential shared utilities
  if (score >= 50) return 'high';    // Frequently reused
  if (score >= 30) return 'medium';  // Occasionally reused
  if (score >= 10) return 'low';     // Potentially reusable
  return 'none';                     // Not reusable
}
```

---

## Category Classification

### Auto-Classification Rules

```typescript
type ModuleCategory =
  | 'ui-component'    // React/Vue/Svelte components
  | 'hook'            // React hooks
  | 'utility'         // Pure functions, helpers
  | 'type'            // TypeScript types/interfaces
  | 'schema'          // Zod, Yup, validation schemas
  | 'service'         // API clients, data services
  | 'constant'        // Configuration, constants
  | 'context'         // React contexts, providers
  | 'hoc'             // Higher-order components
  | 'model'           // Data models, entities
  | 'unknown';        // Unclassified

interface ClassificationSignals {
  // Path-based
  isInComponentsDir: boolean;
  isInHooksDir: boolean;
  isInServicesDir: boolean;

  // Content-based
  exportsJSX: boolean;
  usesReactHooks: boolean;
  exportsZodSchema: boolean;

  // Naming-based
  startsWithUse: boolean;
  endsWithService: boolean;
  isPascalCase: boolean;
}
```

### Classification Decision Tree

```
1. IF exports JSX elements → 'ui-component'
2. ELSE IF name starts with 'use' AND uses React hooks → 'hook'
3. ELSE IF exports Zod/Yup schemas → 'schema'
4. ELSE IF name ends with Service/Client/Api → 'service'
5. ELSE IF only exports types/interfaces → 'type'
6. ELSE IF only exports constants (UPPER_CASE) → 'constant'
7. ELSE IF creates React context → 'context'
8. ELSE IF is pure function exporting → 'utility'
9. ELSE → 'unknown'
```

---

## Configuration Schema

For power users who want to customize detection:

```typescript
interface ReusableDetectionConfig {
  // Include/exclude patterns
  include?: string[];          // Additional patterns to scan
  exclude?: string[];          // Patterns to ignore

  // Override detection
  forceReusable?: string[];    // Always mark as reusable
  forceNotReusable?: string[]; // Never mark as reusable

  // Scoring overrides
  directoryScores?: Record<string, number>;
  minImportCount?: number;     // Min imports to consider reusable

  // Category overrides
  categoryOverrides?: Record<string, ModuleCategory>;

  // Output preferences
  minReusabilityLevel?: ReusabilityLevel;
}
```

### Example Configuration

```json
{
  "reusable": {
    "include": ["my-utils/**"],
    "exclude": ["**/__tests__/**", "**/stories/**"],
    "forceReusable": ["src/legacy-helpers/**"],
    "minImportCount": 3,
    "directoryScores": {
      "src/shared": 50
    }
  }
}
```

---

## Output Format

### Discovered Module Schema

```typescript
interface DiscoveredModule {
  // Identity
  path: string;                 // Relative path from project root
  name: string;                 // Module name (folder or file name)

  // Classification
  category: ModuleCategory;
  reusabilityLevel: ReusabilityLevel;
  reusabilityScore: number;

  // Exports
  exports: ExportedMember[];
  exportCount: number;

  // Usage stats
  importedBy: string[];         // Paths of importing files
  importedByCount: number;

  // Signals that led to detection
  detectionSignals: {
    directoryMatch?: string;
    namingPattern?: string;
    importFrequency: number;
    hasBarrelFile: boolean;
    hasDocumentation: boolean;
  };
}

interface DiscoveryResult {
  modules: DiscoveredModule[];

  // Summary by category
  byCategory: Record<ModuleCategory, DiscoveredModule[]>;

  // Summary by reusability
  byReusability: Record<ReusabilityLevel, DiscoveredModule[]>;

  // Stats
  totalModules: number;
  scanDurationMs: number;
}
```

---

## Implementation Plan

### File Structure

```
src/lib/@reusable/
├── index.ts              # Public API
├── types.ts              # Type definitions
├── detector.ts           # Main detection orchestrator
├── signals/
│   ├── directory.ts      # Directory pattern matching
│   ├── exports.ts        # Export pattern analysis
│   ├── imports.ts        # Import frequency analysis
│   ├── naming.ts         # Naming convention analysis
│   └── documentation.ts  # JSDoc analysis
├── classifier.ts         # Category classification
├── scorer.ts             # Final score calculation
└── config.ts             # Configuration loading
```

### Public API

```typescript
// Main detection function
export function discoverReusableModules(
  projectRoot: string,
  config?: ReusableDetectionConfig
): Promise<DiscoveryResult>;

// Individual analyzers (for advanced use)
export function analyzeExportPatterns(filePath: string): ExportAnalysis;
export function analyzeImportFrequency(projectRoot: string): ImportGraph;
export function classifyModule(module: AnalyzedModule): ModuleCategory;
export function calculateReusabilityScore(signals: AllSignals): number;

// Formatters
export function formatAsMarkdown(result: DiscoveryResult): string;
export function formatAsXML(result: DiscoveryResult): string;
```

---

## Performance Considerations

1. **Parallel Processing**: Scan files in parallel using worker threads
2. **Caching**: Cache import graph analysis (most expensive operation)
3. **Early Exit**: Skip files that clearly aren't reusable (tests, stories)
4. **Incremental Updates**: Only re-analyze changed files

### Expected Performance

| Project Size | Files | Expected Time |
|--------------|-------|---------------|
| Small        | <100  | <500ms        |
| Medium       | <1000 | <2s           |
| Large        | <5000 | <10s          |
| Monorepo     | 10k+  | <30s (cached) |

---

## Integration with Existing System

This system replaces the current `scanLibModules()` which only scans `lib/@*`:

```typescript
// Before (hardcoded)
const modules = scanLibModules(projectRoot); // Only lib/@*

// After (universal)
const result = await discoverReusableModules(projectRoot);
const modules = result.modules.filter(m =>
  m.reusabilityLevel !== 'none'
);
```

The existing `ModuleInfo` and `ModuleExport` types remain compatible for backward compatibility.

---

## Future Enhancements

1. **Machine Learning**: Train a model on labeled codebases
2. **Cross-Project Learning**: Learn patterns from popular open-source projects
3. **IDE Integration**: VS Code extension for real-time detection
4. **Dependency Graph Visualization**: Interactive visualization of module relationships
5. **Refactoring Suggestions**: Suggest modules that should be extracted

---

## References

- [Dependency Cruiser](https://github.com/sverweij/dependency-cruiser) - Rule-based dependency validation
- [Madge](https://github.com/pahen/madge) - Module dependency graph generation
- [Cal.com Structure](https://github.com/calcom/cal.com) - Well-organized monorepo example
- [shadcn/ui](https://github.com/shadcn-ui/ui) - Component library patterns
