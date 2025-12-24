/**
 * @module commands/fix/analyzers/detectors
 * @description File type detection - now uses shared @context library
 */

import { detectFileType as detectFileTypeFromContext } from '../../../lib/@context';
import type { FileAnalysis } from '../types';

/**
 * Detect file type based on path and content
 * Uses shared context library for detection
 */
export function detectFileType(filepath: string, _content: string): FileAnalysis['fileType'] {
  const type = detectFileTypeFromContext(filepath);

  // Map context types to analysis types
  switch (type) {
    case 'component':
      return 'component';
    case 'hook':
      return 'hook';
    case 'util':
      return 'util';
    case 'api':
      return 'router';
    case 'schema':
      return 'schema';
    case 'test':
      return 'test';
    case 'config':
      return 'config';
    case 'cli':
      return 'util'; // CLI files are treated as util
    case 'output':
      return 'util';
    default:
      return 'unknown';
  }
}
