/**
 * @module commands/refactor/analyzers/i18n/key-generator
 * @description Re-exports from lib/@i18n/ for backward compatibility
 *
 * All functionality has been moved to the reusable lib/@i18n/ module.
 * This file exists only for import path compatibility.
 */

// Re-export transliteration for direct access
export { transliterate } from '@/lib/@i18n';
// Re-export all key generation functions
export {
  generateI18nKey,
  generateKeyFromContent,
  textToKey,
} from '@/lib/@i18n/key-builder';
// Re-export language plugins for direct access
export { englishPlugin, russianPlugin } from '@/lib/@i18n/languages';
// Re-export namespace detection
export {
  createNamespaceRule,
  detectNamespace,
  NAMESPACE_RULES,
  type NamespaceRule,
  normalizeNamespacePart,
} from '@/lib/@i18n/namespace-resolver';
