/**
 * @module commands/routes/parser
 * @description tRPC router file parser
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractInlineSchema, type InlineField } from './inline-schema';

/**
 * tRPC procedure definition
 */
export interface TrpcProcedure {
  name: string;
  type: 'query' | 'mutation' | 'subscription' | 'unknown';
  hasInput: boolean;
  inputSchema?: string;
  /** Detailed input fields when schema is inline z.object */
  inputFields?: InlineField[];
  outputSchema?: string;
  isProtected: boolean;
  description?: string;
}

/**
 * tRPC router definition
 */
export interface TrpcRouter {
  name: string;
  file: string;
  procedures: TrpcProcedure[];
  subRouters: string[];
  description?: string;
}

/**
 * Parse a tRPC router file
 */
export function parseRouterFile(filePath: string): TrpcRouter | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath, '.ts');

  // Skip index files
  if (fileName === 'index' || fileName === '_app') return null;

  const procedures: TrpcProcedure[] = [];
  const subRouters: string[] = [];

  // Find router definition
  const routerMatch = content.match(/(?:export\s+const\s+)?(\w+Router)\s*=\s*(?:create)?(?:T|t)rpc(?:Router)?/);
  const routerName = routerMatch?.[1] || `${fileName}Router`;

  // Parse procedures with access level
  parseProcedures(content, procedures);

  // Parse chained calls (alternative syntax)
  parseChainedProcedures(content, procedures);

  // Find merged routers
  parseSubRouters(content, subRouters);

  // Extract description from JSDoc
  const descMatch = content.match(/\/\*\*[\s\S]*?@description\s+([^\n*]+)/);
  const description = descMatch?.[1]?.trim();

  return {
    name: routerName,
    file: fileName,
    procedures,
    subRouters,
    description,
  };
}

/**
 * Parse procedures with access level (protected/public/admin)
 */
function parseProcedures(content: string, procedures: TrpcProcedure[]): void {
  // Find all procedure definitions: name: (protected|public|admin)Procedure
  const procStartRegex = /(\w+)\s*:\s*(protected|public|admin)Procedure/g;
  let match;

  while ((match = procStartRegex.exec(content)) !== null) {
    const name = match[1];
    const accessLevel = match[2];
    if (!name) continue;

    // Already found this procedure
    if (procedures.find((p) => p.name === name)) continue;

    // Get the text after the procedure declaration (up to next procedure or end)
    const startPos = match.index + match[0].length;
    const nextProcMatch = content.slice(startPos).match(/\n\s*\w+\s*:\s*(protected|public|admin)Procedure/);
    const endPos = nextProcMatch ? startPos + nextProcMatch.index! : Math.min(startPos + 2000, content.length);
    const procBlock = content.slice(startPos, endPos);

    // Determine procedure type
    let type: TrpcProcedure['type'] = 'unknown';
    if (procBlock.includes('.query(')) type = 'query';
    else if (procBlock.includes('.mutation(')) type = 'mutation';
    else if (procBlock.includes('.subscription(')) type = 'subscription';

    // Check for .input()
    const hasInput = procBlock.includes('.input(');

    // Extract input schema name and fields
    let inputSchema: string | undefined;
    let inputFields: InlineField[] | undefined;
    if (hasInput) {
      // Try to find schema name: .input(SomeSchema) or .input(z.object({...}))
      const inputMatch = procBlock.match(/\.input\(\s*(\w+Schema|\w+Input)/);
      if (inputMatch) {
        inputSchema = inputMatch[1];
      } else if (procBlock.match(/\.input\(\s*z\.object/)) {
        inputSchema = 'inline';
        // Extract inline schema fields for AI context
        const inlineSchema = extractInlineSchema(procBlock);
        if (inlineSchema && inlineSchema.fields.length > 0) {
          inputFields = inlineSchema.fields;
        }
      }
    }

    // Extract output schema name
    let outputSchema: string | undefined;
    const hasOutput = procBlock.includes('.output(');
    if (hasOutput) {
      const outputMatch = procBlock.match(/\.output\(\s*(\w+Schema|\w+Output)/);
      if (outputMatch) {
        outputSchema = outputMatch[1];
      } else if (procBlock.match(/\.output\(\s*z\.object/)) {
        outputSchema = 'inline';
      } else {
        // Check for z.array(Schema)
        const arrayMatch = procBlock.match(/\.output\(\s*z\.array\(\s*(\w+)/);
        if (arrayMatch) {
          outputSchema = `${arrayMatch[1]}[]`;
        }
      }
    }

    if (type !== 'unknown') {
      const proc: TrpcProcedure = {
        name,
        type,
        hasInput,
        isProtected: accessLevel !== 'public',
      };
      if (inputSchema) proc.inputSchema = inputSchema;
      if (inputFields) proc.inputFields = inputFields;
      if (outputSchema) proc.outputSchema = outputSchema;
      procedures.push(proc);
    }
  }
}

/**
 * Parse chained procedure calls
 */
function parseChainedProcedures(content: string, procedures: TrpcProcedure[]): void {
  const chainedRegex = /\.(query|mutation|subscription)\s*\(\s*['"](\w+)['"]/g;
  let match;

  while ((match = chainedRegex.exec(content)) !== null) {
    const [, type, name] = match;
    if (!type || !name) continue;

    // Check if not already added
    if (!procedures.find((p) => p.name === name)) {
      procedures.push({
        name,
        type: type as TrpcProcedure['type'],
        hasInput: false,
        isProtected: content.includes('protectedProcedure'),
      });
    }
  }
}

/**
 * Parse merged sub-routers
 */
function parseSubRouters(content: string, subRouters: string[]): void {
  const mergeRegex = /\.merge\s*\(\s*['"](\w+)['"]\s*,\s*(\w+)\s*\)/g;
  let match;

  while ((match = mergeRegex.exec(content)) !== null) {
    if (match[1]) {
      subRouters.push(match[1]);
    }
  }
}

/**
 * Parse all router files in a directory
 */
export function parseRoutersDirectory(routersDir: string): TrpcRouter[] {
  if (!fs.existsSync(routersDir)) {
    return [];
  }

  const routers: TrpcRouter[] = [];
  const files = fs.readdirSync(routersDir).filter((f) => f.endsWith('.ts'));

  for (const file of files) {
    const router = parseRouterFile(path.join(routersDir, file));
    if (router && router.procedures.length > 0) {
      routers.push(router);
    }
  }

  // Also check subdirectories (e.g., business/)
  const subdirs = fs.readdirSync(routersDir).filter((f) => {
    const fullPath = path.join(routersDir, f);
    return fs.statSync(fullPath).isDirectory() && !f.startsWith('.');
  });

  for (const subdir of subdirs) {
    const subPath = path.join(routersDir, subdir);
    const subFiles = fs.readdirSync(subPath).filter((f) => f.endsWith('.ts'));

    for (const file of subFiles) {
      const router = parseRouterFile(path.join(subPath, file));
      if (router && router.procedures.length > 0) {
        router.file = `${subdir}/${router.file}`;
        routers.push(router);
      }
    }
  }

  // Sort by procedure count
  routers.sort((a, b) => b.procedures.length - a.procedures.length);

  return routers;
}
