/**
 * @module lib/@swc/detectors/hardcoded-detector
 * @deprecated Use '@/lib/@patterns/hardcoded/detector' instead.
 *
 * This module re-exports all functions from the canonical source.
 * It is kept for backward compatibility only.
 */

export {
  detectHardcodedUrl,
  detectHardcodedValue,
  detectHexColor,
  detectMagicNumber,
  isArrayIndex,
  isInConstDeclaration,
} from '@/lib/@patterns/hardcoded/detector';
