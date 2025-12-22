/**
 * @module commands/context/parsers
 * @description Parsers for Zod schemas, components, and tests
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Zod schema field definition
 */
export interface ZodField {
  name: string;
  type: string;
  required: boolean;
  validation?: string; // e.g., "min: 1, max: 100"
}

/**
 * Zod schema definition
 */
export interface ZodSchemaInfo {
  name: string;
  type: 'input' | 'output' | 'filter';
  fields: ZodField[];
  file: string;
}

/**
 * Component analysis result
 */
export interface ComponentInfo {
  name: string;
  file: string;
  type: 'client' | 'server';
  purpose?: string;
  imports: string[];
  hooks: string[];
  state?: string;
  fields?: string[];
  errorHandling?: string;
  features?: string[];
}

/**
 * Test file analysis result
 */
export interface TestInfo {
  file: string;
  describes: {
    name: string;
    tests: string[];
  }[];
}

/**
 * Parse Zod schema files to extract input/output schemas
 */
export function parseZodSchemas(schemasDir: string, patterns: string[]): ZodSchemaInfo[] {
  const results: ZodSchemaInfo[] = [];

  if (!fs.existsSync(schemasDir)) return results;

  function scanFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileName = path.basename(filePath);

      // Find schema definitions: export const fooSchema = z.object({...})
      const schemaRegex = /export\s+const\s+(\w+Schema)\s*=\s*z\.object\(\{([^}]+)\}\)/gs;
      let match: RegExpExecArray | null;

      while ((match = schemaRegex.exec(content)) !== null) {
        const schemaName = match[1];
        const fieldsBlock = match[2];

        if (!schemaName || !fieldsBlock) continue;

        // Determine schema type from name
        let type: 'input' | 'output' | 'filter' = 'input';
        if (schemaName.toLowerCase().includes('output') || schemaName.toLowerCase().includes('response')) {
          type = 'output';
        } else if (schemaName.toLowerCase().includes('filter') || schemaName.toLowerCase().includes('query')) {
          type = 'filter';
        }

        // Parse fields
        const fields = parseZodFields(fieldsBlock);

        results.push({
          name: schemaName,
          type,
          fields,
          file: fileName,
        });
      }
    } catch {
      // File not readable
    }
  }

  function scanDir(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          const nameLower = entry.name.toLowerCase();
          if (patterns.length === 0 || patterns.some((p) => nameLower.includes(p.toLowerCase()))) {
            scanFile(fullPath);
          }
        }
      }
    } catch {
      // Directory not readable
    }
  }

  scanDir(schemasDir);
  return results;
}

/**
 * Parse Zod field definitions
 */
function parseZodFields(fieldsBlock: string): ZodField[] {
  const fields: ZodField[] = [];

  // Match: fieldName: z.string().min(1).max(100).optional()
  const fieldRegex = /(\w+):\s*z\.(\w+)\((.*?)\)([^,\n]*)/g;
  let match: RegExpExecArray | null;

  while ((match = fieldRegex.exec(fieldsBlock)) !== null) {
    const name = match[1];
    const baseType = match[2];
    const chain = match[4] ?? '';

    if (!name || !baseType) continue;

    const isOptional = chain.includes('.optional()') || chain.includes('.nullable()');

    // Extract validation constraints
    const validations: string[] = [];
    const minMatch = chain.match(/\.min\((\d+)\)/);
    const maxMatch = chain.match(/\.max\((\d+)\)/);
    const lengthMatch = chain.match(/\.length\((\d+)\)/);

    if (minMatch) validations.push(`min: ${minMatch[1]}`);
    if (maxMatch) validations.push(`max: ${maxMatch[1]}`);
    if (lengthMatch) validations.push(`length: ${lengthMatch[1]}`);

    const field: ZodField = {
      name,
      type: baseType,
      required: !isOptional,
    };
    if (validations.length > 0) {
      field.validation = validations.join(', ');
    }
    fields.push(field);
  }

  return fields;
}

/**
 * Parse React component files to extract metadata
 */
export function parseComponents(componentsDir: string, patterns: string[]): ComponentInfo[] {
  const results: ComponentInfo[] = [];

  if (!fs.existsSync(componentsDir)) return results;

  function analyzeComponent(filePath: string): ComponentInfo | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileName = path.basename(filePath);
      const componentName = fileName.replace(/\.tsx?$/, '');

      // Detect client/server component
      const isClient = content.includes("'use client'") || content.includes('"use client"');

      // Extract imports
      const imports: string[] = [];
      const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
      let match: RegExpExecArray | null;

      while ((match = importRegex.exec(content)) !== null) {
        const importedItems = match[1]?.split(',').map((s) => s.trim()) ?? [];
        const source = match[2] ?? '';
        // Only include relevant imports (not React, etc.)
        if (!source.includes('react') && !source.includes('next')) {
          imports.push(...importedItems.filter((i) => i.length > 0));
        }
      }

      // Extract hooks used
      const hooks: string[] = [];
      const hookRegex = /use\w+/g;
      const hookMatches = content.match(hookRegex) || [];
      hooks.push(...new Set(hookMatches.filter((h) => !['useCallback', 'useEffect', 'useMemo', 'useState', 'useRef'].includes(h))));

      // Try to extract purpose from first comment or component description
      let purpose: string | undefined;
      const purposeMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+)\n/);
      if (purposeMatch?.[1]) {
        purpose = purposeMatch[1].trim();
      }

      // Extract features from comments or component structure
      const features: string[] = [];
      const featureMatches = content.matchAll(/@feature\s+(.+)/g);
      for (const fm of featureMatches) {
        if (fm[1]) features.push(fm[1].trim());
      }

      // Extract form fields (Input, Select, DatePicker, etc.)
      const fields: string[] = [];
      const fieldPatterns = [
        // JSX components with name/id
        /<Input[^>]*(?:name|id)=["'](\w+)["']/g,
        /<Select[^>]*(?:name|id)=["'](\w+)["']/g,
        /<DatePicker[^>]*(?:name|id)=["'](\w+)["']/g,
        /<Textarea[^>]*(?:name|id)=["'](\w+)["']/g,
        // HTML inputs with name
        /<input[^>]*name=["'](\w+)["']/g,
        /<select[^>]*name=["'](\w+)["']/g,
        /<textarea[^>]*name=["'](\w+)["']/g,
        // react-hook-form
        /register\(["'](\w+)["']\)/g,
        /Controller[^}]+name:\s*["'](\w+)["']/g,
        // shadcn/ui FormField
        /<FormField[^}]*name=["'](\w+)["']/g,
        /FormField\s+name=["'](\w+)["']/g,
        // useState with object initialization (e.g., useState({ date: '', time: '' }))
        /useState\(\{\s*(\w+):/g,
        // formData.fieldName or data.fieldName patterns
        /formData\.(\w+)/g,
        // e.target.name === 'fieldName' or handleChange for 'fieldName'
        /\[e\.target\.name\]:\s*e\.target\.value/g,
      ];
      for (const pattern of fieldPatterns) {
        const matches = content.matchAll(pattern);
        for (const m of matches) {
          if (m[1] && !fields.includes(m[1]) && m[1].length > 1) {
            fields.push(m[1]);
          }
        }
      }

      // Also extract fields from useState object literal
      const useStateMatch = content.match(/useState\(\{([^}]+)\}\)/);
      if (useStateMatch?.[1]) {
        const stateObj = useStateMatch[1];
        const stateFields = stateObj.match(/(\w+)\s*:/g);
        if (stateFields) {
          for (const f of stateFields) {
            const fieldName = f.replace(/\s*:$/, '');
            if (fieldName && !fields.includes(fieldName) && fieldName.length > 1) {
              fields.push(fieldName);
            }
          }
        }
      }

      // Detect state management
      let state: string | undefined;
      if (content.includes('useForm') || content.includes('react-hook-form')) {
        state = 'react-hook-form';
      } else if (content.includes('useState')) {
        state = 'useState';
      } else if (content.includes('useReducer')) {
        state = 'useReducer';
      } else if (content.includes('zustand') || content.includes('create(')) {
        state = 'zustand';
      }

      // Detect error handling patterns
      let errorHandling: string | undefined;
      const errorPatterns: string[] = [];
      if (content.includes('try') && content.includes('catch')) errorPatterns.push('try-catch');
      if (content.includes('onError') || content.includes('error:')) errorPatterns.push('callback');
      if (content.includes('toast.error') || content.includes('showError')) errorPatterns.push('toast');
      if (content.includes('setError') || content.includes('formState.errors')) errorPatterns.push('form-errors');
      if (content.includes('ErrorBoundary')) errorPatterns.push('boundary');
      if (errorPatterns.length > 0) {
        errorHandling = errorPatterns.join(', ');
      }

      const result: ComponentInfo = {
        name: componentName,
        file: fileName,
        type: isClient ? 'client' : 'server',
        imports: imports.slice(0, 10),
        hooks: hooks.slice(0, 5),
      };
      if (purpose) result.purpose = purpose;
      if (state) result.state = state;
      if (fields.length > 0) result.fields = fields.slice(0, 10);
      if (errorHandling) result.errorHandling = errorHandling;
      if (features.length > 0) result.features = features;
      return result;
    } catch {
      return null;
    }
  }

  function scanDir(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
          const nameLower = entry.name.toLowerCase();
          if (patterns.some((p) => nameLower.includes(p.toLowerCase()))) {
            const info = analyzeComponent(fullPath);
            if (info) results.push(info);
          }
        }
      }
    } catch {
      // Directory not readable
    }
  }

  scanDir(componentsDir);
  return results;
}

/**
 * Parse test files to extract describe/it blocks
 */
export function parseTestFiles(testsDir: string, patterns: string[]): TestInfo[] {
  const results: TestInfo[] = [];

  if (!fs.existsSync(testsDir)) return results;

  function analyzeTest(filePath: string): TestInfo | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileName = path.basename(filePath);

      const describes: TestInfo['describes'] = [];

      // Match describe blocks
      const describeRegex = /describe\(['"](.+?)['"],\s*\(\)\s*=>\s*\{/g;
      let descMatch: RegExpExecArray | null;

      while ((descMatch = describeRegex.exec(content)) !== null) {
        const describeName = descMatch[1];
        if (!describeName) continue;

        const tests: string[] = [];

        // Find it() blocks within this describe (simplified - takes all it blocks)
        const itRegex = /it\(['"](.+?)['"]/g;
        let itMatch: RegExpExecArray | null;

        // Reset and search for it blocks
        const startPos = descMatch.index;
        const searchContent = content.slice(startPos, startPos + 2000); // Search within ~2000 chars

        while ((itMatch = itRegex.exec(searchContent)) !== null) {
          if (itMatch[1]) tests.push(itMatch[1]);
        }

        if (tests.length > 0) {
          describes.push({ name: describeName, tests: tests.slice(0, 10) });
        }
      }

      if (describes.length > 0) {
        return { file: fileName, describes };
      }
      return null;
    } catch {
      return null;
    }
  }

  function scanDir(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          scanDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx'))) {
          const nameLower = entry.name.toLowerCase();
          if (patterns.length === 0 || patterns.some((p) => nameLower.includes(p.toLowerCase()))) {
            const info = analyzeTest(fullPath);
            if (info) results.push(info);
          }
        }
      }
    } catch {
      // Directory not readable
    }
  }

  scanDir(testsDir);
  return results;
}

/**
 * Generate context hints based on project patterns
 */
export function generateContextHints(domains: string[]): Record<string, string> {
  const hints: Record<string, string> = {
    'no-placeholders': 'Zero TODOs. All features fully implemented. Error handling for every edge case.',
    'quality': 'Components must be: responsive, accessible (a11y), performant (no unnecessary re-renders).',
  };

  // Add domain-specific hints
  if (domains.includes('booking')) {
    hints['concurrency'] = 'Booking creation must prevent double-booking via Prisma $transaction.';
    hints['timezone'] = 'All dates stored as UTC in DB. Convert to user timezone in UI using date-fns-tz.';
    hints['relations'] = 'Booking.place is required (cascade delete). Booking.user is optional (set null on delete).';
    hints['validation'] = 'Validate: minAdvanceHours, maxAdvanceDays, minPartySize, maxPartySize from BookingSettings.';
  }

  if (domains.includes('events')) {
    hints['tickets'] = 'Ticket quantity must be tracked atomically. Use $transaction for purchases.';
    hints['capacity'] = 'Check venue capacity before ticket creation. Track soldCount + reservedCount.';
    hints['relations'] = 'Event.place is optional. TicketType.event is required (cascade delete).';
    hints['pricing'] = 'Prices stored as integers (kopecks/cents). Convert for display only.';
  }

  if (domains.includes('crm')) {
    hints['privacy'] = 'Customer data is sensitive. Apply proper access controls via ctx.session.';
    hints['deduplication'] = 'Customers identified by phone+placeId. Merge duplicates on conflict.';
    hints['relations'] = 'Customer.place is required (cascade delete). CustomerNote/Tag cascade with customer.';
  }

  if (domains.includes('places')) {
    hints['relations'] = 'Place.owner (User) required. Delete place cascades to bookings, events, customers.';
    hints['geolocation'] = 'Latitude/longitude stored as Float. Use PostGIS or calculate distance in app.';
  }

  if (domains.includes('users')) {
    hints['auth'] = 'Use ctx.session.user for authenticated user. Never trust client-provided userId.';
    hints['relations'] = 'User deletion sets null on bookings/interactions. Does NOT delete owned places.';
  }

  return hints;
}
