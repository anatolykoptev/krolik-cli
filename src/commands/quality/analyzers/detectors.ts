/**
 * @module commands/quality/analyzers/detectors
 * @description File type detection based on path and content
 */

import * as path from 'node:path';
import type { FileAnalysis } from '../types';

/**
 * Detect file type based on path and content
 */
export function detectFileType(filepath: string, content: string): FileAnalysis['fileType'] {
  const basename = path.basename(filepath);
  const dir = path.dirname(filepath);

  // Test files
  if (basename.includes('.test.') || basename.includes('.spec.') || dir.includes('__tests__')) {
    return 'test';
  }

  // Config files
  if (basename.includes('.config.') || basename === 'tailwind.config.ts') {
    return 'config';
  }

  // Hooks
  if (basename.startsWith('use') && basename.endsWith('.ts')) {
    return 'hook';
  }

  // Schemas (Zod, Prisma)
  if (basename.includes('.schema.') || dir.includes('schemas') || filepath.endsWith('.prisma')) {
    return 'schema';
  }

  // Routers (tRPC)
  if (dir.includes('routers') || content.includes('createTRPCRouter') || content.includes('router({')) {
    return 'router';
  }

  // Components (React)
  if (filepath.endsWith('.tsx') && (content.includes('return (') || content.includes('return <'))) {
    return 'component';
  }

  // Utils/lib
  if (dir.includes('lib') || dir.includes('utils') || dir.includes('helpers')) {
    return 'util';
  }

  return 'unknown';
}
