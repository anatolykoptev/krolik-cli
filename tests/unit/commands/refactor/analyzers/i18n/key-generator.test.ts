/**
 * @module tests/unit/commands/refactor/analyzers/i18n/key-generator.test
 * @description Unit tests for i18n key generation utilities
 */

import { describe, expect, it } from 'vitest';
import {
  detectNamespace,
  generateI18nKey,
  textToKey,
  transliterate,
} from '../../../../../../src/commands/refactor/analyzers/i18n/key-generator';
import type { HardcodedStringInfo } from '../../../../../../src/commands/refactor/analyzers/i18n/types';

describe('i18n/key-generator', () => {
  describe('transliterate', () => {
    it('should transliterate Russian lowercase letters', () => {
      expect(transliterate('привет')).toBe('privet');
      expect(transliterate('мир')).toBe('mir');
      expect(transliterate('сохранить')).toBe('sohranit');
    });

    it('should transliterate Russian uppercase letters', () => {
      expect(transliterate('ПРИВЕТ')).toBe('privet');
      expect(transliterate('Мир')).toBe('mir');
    });

    it('should handle special characters', () => {
      expect(transliterate('ёлка')).toBe('yolka');
      expect(transliterate('щука')).toBe('schuka');
      expect(transliterate('чай')).toBe('chay');
      expect(transliterate('шаг')).toBe('shag');
      expect(transliterate('жук')).toBe('zhuk');
    });

    it('should lowercase Latin characters for key generation', () => {
      expect(transliterate('hello')).toBe('hello');
      // English plugin lowercases for consistent key generation
      expect(transliterate('Hello World')).toBe('hello world');
    });

    it('should handle mixed text based on primary language', () => {
      // English detected as primary (more Latin chars), lowercases all
      expect(transliterate('Hello мир')).toBe('hello мир');
      // Russian detected as primary (6 Cyrillic vs 3 Latin), transliterates
      expect(transliterate('API запрос')).toBe('API zapros');
    });

    it('should handle empty string', () => {
      expect(transliterate('')).toBe('');
    });

    it('should handle soft and hard signs', () => {
      expect(transliterate('объект')).toBe('obekt');
      expect(transliterate('семья')).toBe('semya');
    });
  });

  describe('textToKey', () => {
    it('should convert Russian text to snake_case key', () => {
      expect(textToKey('Привет мир')).toBe('privet_mir');
      expect(textToKey('Сохранить изменения')).toBe('sohranit_izmeneniya');
    });

    it('should convert English text to snake_case key', () => {
      expect(textToKey('Hello World')).toBe('hello_world');
      expect(textToKey('Submit Form')).toBe('submit_form');
    });

    it('should remove punctuation', () => {
      expect(textToKey('Hello!')).toBe('hello');
      // "your" is a stop word and gets filtered
      expect(textToKey('Enter your email...')).toBe('enter_email');
      expect(textToKey('What?')).toBe('what');
    });

    it('should filter stop words', () => {
      expect(textToKey('The quick brown fox')).toBe('quick_brown_fox');
      expect(textToKey('A simple test')).toBe('simple_test');
    });

    it('should limit number of words', () => {
      const longText = 'One two three four five six seven eight';
      const result = textToKey(longText);
      expect(result.split('_').length).toBeLessThanOrEqual(5);
    });

    it('should truncate very long keys', () => {
      const longText =
        'This is a very long text that should be truncated to fit within the maximum key length limit';
      const result = textToKey(longText);
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('should handle empty string', () => {
      expect(textToKey('')).toBe('text');
      expect(textToKey('   ')).toBe('text');
    });

    it('should handle multiple spaces', () => {
      expect(textToKey('Hello    World')).toBe('hello_world');
    });
  });

  describe('detectNamespace', () => {
    it('should detect panel namespace', () => {
      expect(detectNamespace('apps/web/app/panel/events/page.tsx')).toBe('panel.events');
      expect(detectNamespace('apps/web/app/panel/places/[id]/edit.tsx')).toBe('panel.places');
    });

    it('should detect public namespace', () => {
      expect(detectNamespace('apps/web/app/(public)/explore/page.tsx')).toBe('public.explore');
    });

    it('should detect auth namespace', () => {
      expect(detectNamespace('apps/web/app/(auth)/login/page.tsx')).toBe('auth');
    });

    it('should detect components namespace', () => {
      expect(detectNamespace('apps/web/components/cards/PlaceCard.tsx')).toBe('components.cards');
      expect(detectNamespace('apps/web/components/forms/LoginForm.tsx')).toBe('components.forms');
    });

    it('should detect UI package namespace', () => {
      expect(detectNamespace('packages/ui/src/button/Button.tsx')).toBe('ui.button');
    });

    it('should detect shared package namespace', () => {
      expect(detectNamespace('packages/shared/src/utils/format.ts')).toBe('shared');
    });

    it('should detect mobile app namespace', () => {
      expect(detectNamespace('apps/mobile/src/screens/Home.tsx')).toBe('mobile');
    });

    it('should return common for unknown paths', () => {
      expect(detectNamespace('unknown/path/file.ts')).toBe('common');
      expect(detectNamespace('')).toBe('common');
    });

    it('should handle Windows-style paths', () => {
      expect(detectNamespace('apps\\web\\app\\panel\\events\\page.tsx')).toBe('panel.events');
    });
  });

  describe('generateI18nKey', () => {
    const createMockInfo = (overrides: Partial<HardcodedStringInfo> = {}): HardcodedStringInfo => ({
      id: 'test-id',
      value: 'Тестовый текст',
      language: 'ru',
      context: 'jsx-text',
      category: 'ui-label',
      priority: 1,
      location: {
        file: 'apps/web/app/panel/events/EventForm.tsx',
        line: 10,
        column: 5,
        start: 100,
        end: 120,
      },
      isTechnical: false,
      confidence: 0.9,
      ...overrides,
    });

    it('should generate key with namespace from file path', () => {
      const info = createMockInfo();
      const result = generateI18nKey(info, 'EventForm');

      expect(result.namespace).toBe('panel.events');
      expect(result.key).toContain('panel.events');
    });

    it('should use component context when available', () => {
      const info = createMockInfo();
      const result = generateI18nKey(info, 'EventForm');

      expect(result.source).toBe('component');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should use attribute context for jsx-attribute', () => {
      const info = createMockInfo({
        context: 'jsx-attribute',
        attributeName: 'placeholder',
        value: 'Введите имя',
      });
      const result = generateI18nKey(info, 'InputField');

      expect(result.source).toBe('attribute');
      expect(result.name).toContain('placeholder');
    });

    it('should generate content-based key when no context', () => {
      const info = createMockInfo({
        parentContext: undefined,
        location: {
          file: 'some/unknown/path.tsx',
          line: 1,
          column: 1,
          start: 0,
          end: 10,
        },
      });
      const result = generateI18nKey(info);

      expect(result.source).toBe('content');
      expect(result.namespace).toBe('common');
    });

    it('should have confidence between 0 and 1', () => {
      const info = createMockInfo();
      const result = generateI18nKey(info, 'TestComponent');

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should generate transliterated key for Russian action words', () => {
      const info = createMockInfo({ value: 'Сохранить' });
      const result = generateI18nKey(info, 'Button');

      // Russian 'Сохранить' is transliterated to 'sohranit', not translated to 'save'
      expect(result.name).toContain('sohranit');
    });
  });
});
