/**
 * @module commands/routes/parser
 * @description tRPC router file parser
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * tRPC procedure definition
 */
export interface TrpcProcedure {
  name: string;
  type: 'query' | 'mutation' | 'subscription' | 'unknown';
  hasInput: boolean;
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
  const procedureRegex =
    /(\w+)\s*:\s*(protected|public|admin)Procedure(?:\.input\([^)]+\))?\s*\.(query|mutation|subscription)/g;
  let match;

  while ((match = procedureRegex.exec(content)) !== null) {
    const [fullMatch, name, accessLevel, type] = match;
    if (!name || !type) continue;

    procedures.push({
      name,
      type: type as TrpcProcedure['type'],
      hasInput: fullMatch.includes('.input('),
      isProtected: accessLevel !== 'public',
    });
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
