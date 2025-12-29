/**
 * @module tests/unit/lib/@patterns/i18n.test
 * @description Unit tests for i18n detection patterns
 */

import { describe, expect, it } from 'vitest';
import {
  CYRILLIC_PATTERN,
  ENGLISH_TEXT_PATTERN,
  getCategoryFromAttribute,
  getCategoryFromComponent,
  getPriority,
  hasCyrillicText,
  I18N_RELEVANT_ATTRIBUTES,
  isI18nRelevantAttribute,
  isRussianText,
  isTechnicalString,
  RUSSIAN_TEXT_PATTERN,
  SKIP_ATTRIBUTES,
  shouldSkipFile,
} from '../../../../src/lib/@patterns/i18n';

describe('@patterns/i18n', () => {
  describe('CYRILLIC_PATTERN', () => {
    it('should match Cyrillic characters', () => {
      expect(CYRILLIC_PATTERN.test('Привет')).toBe(true);
      expect(CYRILLIC_PATTERN.test('Мир')).toBe(true);
      expect(CYRILLIC_PATTERN.test('ёЁ')).toBe(true);
    });

    it('should not match Latin characters', () => {
      expect(CYRILLIC_PATTERN.test('Hello')).toBe(false);
      expect(CYRILLIC_PATTERN.test('World')).toBe(false);
      expect(CYRILLIC_PATTERN.test('123')).toBe(false);
    });
  });

  describe('RUSSIAN_TEXT_PATTERN', () => {
    it('should match Russian text with 2+ Cyrillic chars', () => {
      expect(RUSSIAN_TEXT_PATTERN.test('Привет')).toBe(true);
      expect(RUSSIAN_TEXT_PATTERN.test('Да')).toBe(true);
      expect(RUSSIAN_TEXT_PATTERN.test('Нет')).toBe(true);
    });

    it('should not match single Cyrillic characters', () => {
      expect(RUSSIAN_TEXT_PATTERN.test('А')).toBe(false);
      expect(RUSSIAN_TEXT_PATTERN.test('Б')).toBe(false);
    });
  });

  describe('ENGLISH_TEXT_PATTERN', () => {
    it('should match English words with 3+ letters', () => {
      expect(ENGLISH_TEXT_PATTERN.test('Hello')).toBe(true);
      expect(ENGLISH_TEXT_PATTERN.test('World')).toBe(true);
      expect(ENGLISH_TEXT_PATTERN.test('Submit')).toBe(true);
    });

    it('should not match short words', () => {
      expect(ENGLISH_TEXT_PATTERN.test('Hi')).toBe(false);
      expect(ENGLISH_TEXT_PATTERN.test('OK')).toBe(false);
    });
  });

  describe('hasCyrillicText', () => {
    it('should detect Cyrillic text', () => {
      expect(hasCyrillicText('Привет мир')).toBe(true);
      expect(hasCyrillicText('Hello мир')).toBe(true);
      expect(hasCyrillicText('Сохранить')).toBe(true);
    });

    it('should return false for Latin-only text', () => {
      expect(hasCyrillicText('Hello World')).toBe(false);
      expect(hasCyrillicText('Submit')).toBe(false);
    });
  });

  describe('isRussianText', () => {
    it('should identify primarily Russian text', () => {
      expect(isRussianText('Привет мир')).toBe(true);
      expect(isRussianText('Сохранить изменения')).toBe(true);
    });

    it('should identify mixed text as not primarily Russian', () => {
      expect(isRussianText('Hello мир')).toBe(false); // More Latin
    });

    it('should return false for Latin-only text', () => {
      expect(isRussianText('Hello World')).toBe(false);
    });
  });

  describe('isTechnicalString', () => {
    it('should identify hex colors', () => {
      expect(isTechnicalString('#fff')).toBe(true);
      expect(isTechnicalString('#ffffff')).toBe(true);
      expect(isTechnicalString('#FF5733')).toBe(true);
    });

    it('should identify CSS values', () => {
      expect(isTechnicalString('px')).toBe(true);
      expect(isTechnicalString('em')).toBe(true);
      expect(isTechnicalString('flex')).toBe(true);
      expect(isTechnicalString('grid')).toBe(true);
    });

    it('should identify UUIDs', () => {
      expect(isTechnicalString('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should identify URLs', () => {
      expect(isTechnicalString('https://example.com')).toBe(true);
      expect(isTechnicalString('http://localhost:3000')).toBe(true);
    });

    it('should identify file paths', () => {
      expect(isTechnicalString('/api/users')).toBe(true);
      expect(isTechnicalString('./config')).toBe(true);
      expect(isTechnicalString('../parent')).toBe(true);
    });

    it('should identify dot notation paths', () => {
      expect(isTechnicalString('user.profile.name')).toBe(true);
    });

    it('should reject user-facing text', () => {
      expect(isTechnicalString('Привет мир')).toBe(false);
      expect(isTechnicalString('Hello World')).toBe(false);
      expect(isTechnicalString('Submit button')).toBe(false);
    });

    it('should reject very short strings', () => {
      expect(isTechnicalString('A')).toBe(true); // Too short
    });

    it('should reject very long strings', () => {
      const longString = 'A'.repeat(600);
      expect(isTechnicalString(longString)).toBe(true); // Too long
    });
  });

  describe('shouldSkipFile', () => {
    it('should skip test files', () => {
      expect(shouldSkipFile('Component.test.tsx')).toBe(true);
      expect(shouldSkipFile('Component.spec.ts')).toBe(true);
      expect(shouldSkipFile('__tests__/Component.tsx')).toBe(true);
    });

    it('should skip story files', () => {
      expect(shouldSkipFile('Component.stories.tsx')).toBe(true);
    });

    it('should skip type definition files', () => {
      expect(shouldSkipFile('types.d.ts')).toBe(true);
    });

    it('should skip translation files', () => {
      expect(shouldSkipFile('i18n/locales/ru.ts')).toBe(true);
      expect(shouldSkipFile('translations/en.json')).toBe(true);
    });

    it('should skip config files', () => {
      expect(shouldSkipFile('tailwind.config.ts')).toBe(true);
      expect(shouldSkipFile('next.config.js')).toBe(true);
    });

    it('should skip build artifacts', () => {
      expect(shouldSkipFile('dist/bundle.js')).toBe(true);
      expect(shouldSkipFile('.next/static/chunks.js')).toBe(true);
      expect(shouldSkipFile('node_modules/react/index.js')).toBe(true);
    });

    it('should not skip regular component files', () => {
      expect(shouldSkipFile('src/components/Button.tsx')).toBe(false);
      expect(shouldSkipFile('app/page.tsx')).toBe(false);
    });
  });

  describe('I18N_RELEVANT_ATTRIBUTES', () => {
    it('should include common UI attributes', () => {
      expect(I18N_RELEVANT_ATTRIBUTES.has('placeholder')).toBe(true);
      expect(I18N_RELEVANT_ATTRIBUTES.has('title')).toBe(true);
      expect(I18N_RELEVANT_ATTRIBUTES.has('alt')).toBe(true);
      expect(I18N_RELEVANT_ATTRIBUTES.has('label')).toBe(true);
    });

    it('should include accessibility attributes', () => {
      expect(I18N_RELEVANT_ATTRIBUTES.has('aria-label')).toBe(true);
      expect(I18N_RELEVANT_ATTRIBUTES.has('aria-description')).toBe(true);
    });

    it('should include action text attributes', () => {
      expect(I18N_RELEVANT_ATTRIBUTES.has('buttonText')).toBe(true);
      expect(I18N_RELEVANT_ATTRIBUTES.has('submitText')).toBe(true);
      expect(I18N_RELEVANT_ATTRIBUTES.has('cancelText')).toBe(true);
    });
  });

  describe('SKIP_ATTRIBUTES', () => {
    it('should include styling attributes', () => {
      expect(SKIP_ATTRIBUTES.has('className')).toBe(true);
      expect(SKIP_ATTRIBUTES.has('style')).toBe(true);
    });

    it('should include technical identifiers', () => {
      expect(SKIP_ATTRIBUTES.has('id')).toBe(true);
      expect(SKIP_ATTRIBUTES.has('key')).toBe(true);
      expect(SKIP_ATTRIBUTES.has('ref')).toBe(true);
    });

    it('should include URL attributes', () => {
      expect(SKIP_ATTRIBUTES.has('href')).toBe(true);
      expect(SKIP_ATTRIBUTES.has('src')).toBe(true);
    });

    it('should include testing attributes', () => {
      expect(SKIP_ATTRIBUTES.has('data-testid')).toBe(true);
      expect(SKIP_ATTRIBUTES.has('data-cy')).toBe(true);
    });
  });

  describe('isI18nRelevantAttribute', () => {
    it('should return true for relevant attributes', () => {
      expect(isI18nRelevantAttribute('placeholder')).toBe(true);
      expect(isI18nRelevantAttribute('title')).toBe(true);
      expect(isI18nRelevantAttribute('aria-label')).toBe(true);
    });

    it('should return false for skip attributes', () => {
      expect(isI18nRelevantAttribute('className')).toBe(false);
      expect(isI18nRelevantAttribute('id')).toBe(false);
      expect(isI18nRelevantAttribute('href')).toBe(false);
    });
  });

  describe('getPriority', () => {
    it('should return highest priority for JSX text', () => {
      expect(getPriority('jsx-text')).toBe(1);
    });

    it('should return high priority for important attributes', () => {
      expect(getPriority('jsx-attribute:title')).toBe(1);
      expect(getPriority('jsx-attribute:placeholder')).toBe(1);
    });

    it('should return medium priority for messages', () => {
      expect(getPriority('jsx-attribute:errorMessage')).toBe(2);
      expect(getPriority('template-literal')).toBe(2);
    });

    it('should return lower priority for edge cases', () => {
      expect(getPriority('conditional')).toBe(4);
      expect(getPriority('array-element')).toBe(4);
    });

    it('should return default priority for unknown contexts', () => {
      expect(getPriority('unknown-context')).toBe(5);
    });
  });

  describe('getCategoryFromAttribute', () => {
    it('should return correct category for known attributes', () => {
      expect(getCategoryFromAttribute('placeholder')).toBe('placeholder');
      expect(getCategoryFromAttribute('title')).toBe('title');
      expect(getCategoryFromAttribute('label')).toBe('ui-label');
      expect(getCategoryFromAttribute('description')).toBe('description');
      expect(getCategoryFromAttribute('errorMessage')).toBe('validation');
    });

    it('should return null for unknown attributes', () => {
      expect(getCategoryFromAttribute('unknown')).toBe(null);
    });
  });

  describe('getCategoryFromComponent', () => {
    it('should return correct category for known components', () => {
      expect(getCategoryFromComponent('Button')).toBe('action');
      expect(getCategoryFromComponent('Link')).toBe('navigation');
      expect(getCategoryFromComponent('Modal')).toBe('modal');
      expect(getCategoryFromComponent('Toast')).toBe('toast');
      expect(getCategoryFromComponent('Input')).toBe('placeholder');
    });

    it('should return null for unknown components', () => {
      expect(getCategoryFromComponent('CustomComponent')).toBe(null);
    });
  });
});
