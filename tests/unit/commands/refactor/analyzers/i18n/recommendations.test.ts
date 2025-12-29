/**
 * @module tests/unit/commands/refactor/analyzers/i18n/recommendations.test
 * @description Unit tests for i18n recommendation generation
 */

import { describe, expect, it } from 'vitest';
import {
  calculateEffort,
  generateCodeFix,
  groupByComponent,
} from '../../../../../../src/commands/refactor/analyzers/i18n/recommendations';
import type {
  HardcodedStringInfo,
  SuggestedI18nKey,
} from '../../../../../../src/commands/refactor/analyzers/i18n/types';

describe('i18n/recommendations', () => {
  const createMockInfo = (overrides: Partial<HardcodedStringInfo> = {}): HardcodedStringInfo => ({
    id: 'test-id-123',
    value: 'Тестовый текст',
    language: 'ru',
    context: 'jsx-text',
    category: 'ui-label',
    priority: 1,
    location: {
      file: 'apps/web/components/Button.tsx',
      line: 10,
      column: 5,
      start: 100,
      end: 120,
    },
    isTechnical: false,
    confidence: 0.9,
    ...overrides,
  });

  const createMockKey = (overrides: Partial<SuggestedI18nKey> = {}): SuggestedI18nKey => ({
    key: 'common.button.testText',
    namespace: 'common',
    name: 'testText',
    source: 'content',
    confidence: 0.8,
    ...overrides,
  });

  describe('calculateEffort', () => {
    it('should return trivial for simple jsx-text', () => {
      const info = createMockInfo({ context: 'jsx-text' });
      expect(calculateEffort(info)).toBe('trivial');
    });

    it('should return trivial for simple jsx-attribute', () => {
      const info = createMockInfo({
        context: 'jsx-attribute',
        attributeName: 'placeholder',
      });
      expect(calculateEffort(info)).toBe('trivial');
    });

    it('should return trivial for simple string-literal', () => {
      const info = createMockInfo({ context: 'string-literal' });
      expect(calculateEffort(info)).toBe('trivial');
    });

    it('should return trivial for template-literal without interpolations', () => {
      const info = createMockInfo({
        context: 'template-literal',
        interpolations: [],
      });
      expect(calculateEffort(info)).toBe('trivial');
    });

    it('should return low for template-literal with 1 interpolation', () => {
      const info = createMockInfo({
        context: 'template-literal',
        interpolations: ['name'],
      });
      expect(calculateEffort(info)).toBe('low');
    });

    it('should return medium for template-literal with 2-3 interpolations', () => {
      const info = createMockInfo({
        context: 'template-literal',
        interpolations: ['name', 'count', 'date'],
      });
      expect(calculateEffort(info)).toBe('medium');
    });

    it('should return high for 4+ interpolations', () => {
      const info = createMockInfo({
        context: 'template-literal',
        interpolations: ['a', 'b', 'c', 'd'],
      });
      expect(calculateEffort(info)).toBe('high');
    });

    it('should return medium for conditional context', () => {
      const info = createMockInfo({ context: 'conditional' });
      expect(calculateEffort(info)).toBe('medium');
    });

    it('should return low for object-property', () => {
      const info = createMockInfo({ context: 'object-property' });
      expect(calculateEffort(info)).toBe('low');
    });

    it('should return medium for array-element', () => {
      const info = createMockInfo({ context: 'array-element' });
      expect(calculateEffort(info)).toBe('medium');
    });
  });

  describe('generateCodeFix', () => {
    describe('jsx-text context', () => {
      it('should wrap text with {t(...)}', () => {
        const info = createMockInfo({
          context: 'jsx-text',
          value: 'Привет мир',
          snippet: 'Привет мир',
        });
        const key = createMockKey({ key: 'common.greeting' });

        const fix = generateCodeFix(info, key);

        expect(fix.original).toBe('Привет мир');
        expect(fix.replacement).toBe("{t('common.greeting')}");
        expect(fix.imports).toContain("import { t } from '@piternow/shared';");
      });

      it('should handle interpolations', () => {
        const info = createMockInfo({
          context: 'jsx-text',
          value: 'Привет, ${name}!',
          interpolations: ['name'],
        });
        const key = createMockKey({ key: 'common.greeting' });

        const fix = generateCodeFix(info, key);

        expect(fix.replacement).toBe("{t('common.greeting', { name })}");
      });
    });

    describe('jsx-attribute context', () => {
      it('should generate attribute with t() expression', () => {
        const info = createMockInfo({
          context: 'jsx-attribute',
          attributeName: 'placeholder',
          value: 'Введите имя',
          snippet: 'placeholder="Введите имя"',
        });
        const key = createMockKey({ key: 'form.enterName' });

        const fix = generateCodeFix(info, key);

        expect(fix.original).toBe('placeholder="Введите имя"');
        expect(fix.replacement).toBe("placeholder={t('form.enterName')}");
      });

      it('should handle interpolations in attributes', () => {
        const info = createMockInfo({
          context: 'jsx-attribute',
          attributeName: 'title',
          value: 'Пользователь ${name}',
          interpolations: ['name'],
        });
        const key = createMockKey({ key: 'user.title' });

        const fix = generateCodeFix(info, key);

        expect(fix.replacement).toBe("title={t('user.title', { name })}");
      });
    });

    describe('template-literal context', () => {
      it('should convert template literal to t() call', () => {
        const info = createMockInfo({
          context: 'template-literal',
          value: 'Привет, ${name}!',
          snippet: '`Привет, ${name}!`',
          interpolations: ['name'],
        });
        const key = createMockKey({ key: 'greeting.withName' });

        const fix = generateCodeFix(info, key);

        expect(fix.replacement).toBe("t('greeting.withName', { name })");
      });

      it('should handle multiple interpolations', () => {
        const info = createMockInfo({
          context: 'template-literal',
          value: '${count} из ${total}',
          interpolations: ['count', 'total'],
        });
        const key = createMockKey({ key: 'progress.countOf' });

        const fix = generateCodeFix(info, key);

        expect(fix.replacement).toBe("t('progress.countOf', { count, total })");
      });

      it('should deduplicate interpolation params', () => {
        const info = createMockInfo({
          context: 'template-literal',
          value: '${name} + ${name}',
          interpolations: ['name', 'name'],
        });
        const key = createMockKey({ key: 'duplicate.test' });

        const fix = generateCodeFix(info, key);

        expect(fix.replacement).toBe("t('duplicate.test', { name })");
      });
    });

    describe('string-literal context', () => {
      it('should replace string literal with t() call', () => {
        const info = createMockInfo({
          context: 'string-literal',
          value: 'Сообщение',
          snippet: '"Сообщение"',
        });
        const key = createMockKey({ key: 'message.text' });

        const fix = generateCodeFix(info, key);

        expect(fix.replacement).toBe("t('message.text')");
      });
    });

    describe('conditional context', () => {
      it('should replace value with t() call', () => {
        const info = createMockInfo({
          context: 'conditional',
          value: 'Да',
          snippet: '"Да"',
        });
        const key = createMockKey({ key: 'common.yes' });

        const fix = generateCodeFix(info, key);

        expect(fix.replacement).toBe("t('common.yes')");
      });
    });

    describe('object-property context', () => {
      it('should replace property value with t() call', () => {
        const info = createMockInfo({
          context: 'object-property',
          value: 'Кнопка',
          snippet: '"Кнопка"',
        });
        const key = createMockKey({ key: 'ui.button' });

        const fix = generateCodeFix(info, key);

        expect(fix.replacement).toBe("t('ui.button')");
      });
    });

    describe('array-element context', () => {
      it('should replace array element with t() call', () => {
        const info = createMockInfo({
          context: 'array-element',
          value: 'Опция 1',
          snippet: '"Опция 1"',
        });
        const key = createMockKey({ key: 'options.option1' });

        const fix = generateCodeFix(info, key);

        expect(fix.replacement).toBe("t('options.option1')");
      });
    });
  });

  describe('groupByComponent', () => {
    it('should group strings by parent component', () => {
      const strings: HardcodedStringInfo[] = [
        createMockInfo({
          id: '1',
          parentContext: 'LoginForm',
          location: { file: 'src/auth/LoginForm.tsx', line: 10, column: 5, start: 100, end: 120 },
        }),
        createMockInfo({
          id: '2',
          parentContext: 'LoginForm',
          location: { file: 'src/auth/LoginForm.tsx', line: 15, column: 5, start: 200, end: 220 },
        }),
        createMockInfo({
          id: '3',
          parentContext: 'Header',
          location: { file: 'src/layout/Header.tsx', line: 20, column: 5, start: 300, end: 320 },
        }),
      ];

      const groups = groupByComponent(strings);

      expect(groups).toHaveLength(2);

      const loginGroup = groups.find((g) => g.componentName === 'LoginForm');
      expect(loginGroup?.strings).toHaveLength(2);

      const headerGroup = groups.find((g) => g.componentName === 'Header');
      expect(headerGroup?.strings).toHaveLength(1);
    });

    it('should derive component name from file path when parentContext missing', () => {
      const strings: HardcodedStringInfo[] = [
        createMockInfo({
          id: '1',
          parentContext: undefined,
          location: {
            file: 'src/components/Button.tsx',
            line: 10,
            column: 5,
            start: 100,
            end: 120,
          },
        }),
      ];

      const groups = groupByComponent(strings);

      expect(groups[0].componentName).toBe('Button');
    });

    it('should handle index.tsx files', () => {
      const strings: HardcodedStringInfo[] = [
        createMockInfo({
          id: '1',
          parentContext: undefined,
          location: {
            file: 'src/components/Modal/index.tsx',
            line: 10,
            column: 5,
            start: 100,
            end: 120,
          },
        }),
      ];

      const groups = groupByComponent(strings);

      expect(groups[0].componentName).toBe('Modal');
    });

    it('should generate suggested namespace', () => {
      const strings: HardcodedStringInfo[] = [
        createMockInfo({
          id: '1',
          parentContext: 'EventCard',
          location: { file: 'src/events/EventCard.tsx', line: 10, column: 5, start: 100, end: 120 },
        }),
      ];

      const groups = groupByComponent(strings);

      expect(groups[0].suggestedNamespace).toBeTruthy();
      expect(typeof groups[0].suggestedNamespace).toBe('string');
    });

    it('should handle empty array', () => {
      const groups = groupByComponent([]);
      expect(groups).toHaveLength(0);
    });

    it('should sort groups by file path', () => {
      const strings: HardcodedStringInfo[] = [
        createMockInfo({
          id: '1',
          parentContext: 'ZComponent',
          location: { file: 'z/ZComponent.tsx', line: 10, column: 5, start: 100, end: 120 },
        }),
        createMockInfo({
          id: '2',
          parentContext: 'AComponent',
          location: { file: 'a/AComponent.tsx', line: 10, column: 5, start: 100, end: 120 },
        }),
      ];

      const groups = groupByComponent(strings);

      expect(groups[0].file).toBe('a/AComponent.tsx');
      expect(groups[1].file).toBe('z/ZComponent.tsx');
    });
  });
});
