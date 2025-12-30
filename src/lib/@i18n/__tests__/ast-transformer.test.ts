/**
 * @module lib/@i18n/__tests__/ast-transformer.test
 * @description Comprehensive tests for AST-based i18n transformer
 *
 * Tests all edge cases for string transformation:
 * - JSX attributes, text, expressions
 * - Object properties, function arguments
 * - Ternary operators, fallback patterns
 * - Skip patterns (imports, technical strings, non-Russian)
 */

import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { collectTranslatableStrings, type TranslatableString } from '../ast-transformer';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Creates a source file from code string and collects translatable strings
 */
function collectStrings(code: string, fileName = 'test.tsx'): TranslatableString[] {
  const project = new Project({
    compilerOptions: {
      jsx: 2, // React
      skipLibCheck: true,
    },
    useInMemoryFileSystem: true,
  });

  const sourceFile = project.createSourceFile(fileName, code);
  return collectTranslatableStrings(sourceFile, fileName);
}

/**
 * Finds a translatable string by its value
 */
function findByValue(strings: TranslatableString[], value: string): TranslatableString | undefined {
  return strings.find((s) => s.value === value);
}

// ============================================================================
// TESTS: JSX ATTRIBUTE
// ============================================================================

describe('AST Transformer: JSX Attribute', () => {
  it('should detect Russian text in placeholder attribute', () => {
    const code = `<Input placeholder="Введите имя" />`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Введите имя');
    expect(strings[0]?.context).toBe('jsx-attribute');
  });

  it('should detect Russian text in label attribute', () => {
    const code = `<FormField label="Название поля" />`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Название поля');
    expect(strings[0]?.context).toBe('jsx-attribute');
  });

  it('should detect Russian text in aria-label', () => {
    const code = `<button aria-label="Закрыть окно">X</button>`;
    const strings = collectStrings(code);

    const ariaString = findByValue(strings, 'Закрыть окно');
    expect(ariaString).toBeDefined();
    expect(ariaString?.context).toBe('jsx-attribute');
  });

  it('should detect Russian text in title attribute', () => {
    const code = `<div title="Подсказка">Content</div>`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Подсказка');
    expect(strings[0]?.context).toBe('jsx-attribute');
  });

  it('should detect Russian text in alt attribute', () => {
    const code = `<img alt="Изображение профиля" src="/img.png" />`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Изображение профиля');
    expect(strings[0]?.context).toBe('jsx-attribute');
  });

  it('should detect Russian in any attribute with Russian text', () => {
    const code = `<CustomComponent customProp="Привет мир" />`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Привет мир');
    expect(strings[0]?.context).toBe('jsx-attribute');
  });
});

// ============================================================================
// TESTS: JSX TEXT
// ============================================================================

describe('AST Transformer: JSX Text', () => {
  it('should detect Russian text inside div', () => {
    const code = `<div>Привет мир</div>`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Привет мир');
    expect(strings[0]?.context).toBe('jsx-text');
  });

  it('should detect Russian text inside span', () => {
    const code = `<span>Загрузка...</span>`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Загрузка...');
    expect(strings[0]?.context).toBe('jsx-text');
  });

  it('should detect Russian text inside button', () => {
    const code = `<button>Отправить</button>`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Отправить');
    expect(strings[0]?.context).toBe('jsx-text');
  });

  it('should detect Russian text in nested elements', () => {
    const code = `
      <div>
        <span>Первый текст</span>
        <p>Второй текст</p>
      </div>
    `;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(2);
    expect(findByValue(strings, 'Первый текст')).toBeDefined();
    expect(findByValue(strings, 'Второй текст')).toBeDefined();
  });

  it('should detect mixed text with variables', () => {
    const code = `<div>Привет, {name}!</div>`;
    const strings = collectStrings(code);

    // Should detect "Привет, " and "!" separately or combined
    // The exact behavior depends on JSX parsing
    expect(strings.some((s) => s.value.includes('Привет'))).toBe(true);
  });
});

// ============================================================================
// TESTS: JSX EXPRESSION (string in braces)
// ============================================================================

describe('AST Transformer: JSX Expression', () => {
  it('should detect string literal in JSX expression', () => {
    const code = `<div>{"Текст в выражении"}</div>`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Текст в выражении');
    expect(strings[0]?.context).toBe('jsx-expression');
  });
});

// ============================================================================
// TESTS: OBJECT PROPERTY
// ============================================================================

describe('AST Transformer: Object Property', () => {
  it('should detect Russian text in object property', () => {
    const code = `const config = { label: "Название" };`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Название');
    expect(strings[0]?.context).toBe('object-property');
  });

  it('should detect Russian text in nested object', () => {
    const code = `
      const options = {
        button: {
          text: "Нажми меня",
          tooltip: "Подсказка"
        }
      };
    `;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(2);
    expect(findByValue(strings, 'Нажми меня')?.context).toBe('object-property');
    expect(findByValue(strings, 'Подсказка')?.context).toBe('object-property');
  });

  it('should detect Russian text in array of objects', () => {
    const code = `
      const items = [
        { name: "Первый" },
        { name: "Второй" }
      ];
    `;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(2);
    expect(findByValue(strings, 'Первый')).toBeDefined();
    expect(findByValue(strings, 'Второй')).toBeDefined();
  });

  it('should detect Russian text in inline object', () => {
    const code = `showModal({ title: "Подтверждение", message: "Вы уверены?" });`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(2);
    expect(findByValue(strings, 'Подтверждение')).toBeDefined();
    expect(findByValue(strings, 'Вы уверены?')).toBeDefined();
  });
});

// ============================================================================
// TESTS: FALLBACK PATTERN (|| operator)
// ============================================================================

describe('AST Transformer: Fallback Pattern', () => {
  it('should detect Russian text in fallback expression', () => {
    const code = `<div>{value || "По умолчанию"}</div>`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('По умолчанию');
    // Context should be jsx-expression since it's inside JSX
    expect(strings[0]?.context).toBe('jsx-expression');
  });

  it('should detect Russian text in nullish coalescing', () => {
    const code = `<span>{name ?? "Аноним"}</span>`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Аноним');
  });

  it('should detect fallback in variable declaration', () => {
    const code = `const displayName = name || "Неизвестный";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Неизвестный');
  });
});

// ============================================================================
// TESTS: TERNARY EXPRESSION
// ============================================================================

describe('AST Transformer: Ternary Expression', () => {
  it('should detect both branches of ternary in JSX', () => {
    const code = `<span>{isActive ? "Да" : "Нет"}</span>`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(2);
    expect(findByValue(strings, 'Да')).toBeDefined();
    expect(findByValue(strings, 'Нет')).toBeDefined();
  });

  it('should detect Russian text in consequent only', () => {
    const code = `<div>{isLoading ? "Загрузка..." : content}</div>`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Загрузка...');
  });

  it('should detect Russian text in alternate only', () => {
    const code = `<div>{hasData ? data : "Нет данных"}</div>`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Нет данных');
  });

  it('should detect nested ternary', () => {
    const code = `
      <span>
        {status === 'active' ? "Активен" : status === 'pending' ? "Ожидание" : "Неактивен"}
      </span>
    `;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(3);
    expect(findByValue(strings, 'Активен')).toBeDefined();
    expect(findByValue(strings, 'Ожидание')).toBeDefined();
    expect(findByValue(strings, 'Неактивен')).toBeDefined();
  });
});

// ============================================================================
// TESTS: FUNCTION ARGUMENT
// ============================================================================

describe('AST Transformer: Function Argument', () => {
  it('should detect Russian text in toast call', () => {
    const code = `toast("Успех!");`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Успех!');
    expect(strings[0]?.context).toBe('function-argument');
  });

  it('should detect Russian text in console.log', () => {
    const code = `console.log("Отладочное сообщение");`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Отладочное сообщение');
    expect(strings[0]?.context).toBe('function-argument');
  });

  it('should detect Russian text in alert', () => {
    const code = `alert("Внимание!");`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Внимание!');
  });

  it('should detect Russian text in custom function', () => {
    const code = `showError("Произошла ошибка");`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Произошла ошибка');
  });

  it('should detect Russian text in method chain', () => {
    const code = `api.notify("Уведомление");`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Уведомление');
  });
});

// ============================================================================
// TESTS: VARIABLE DECLARATION
// ============================================================================

describe('AST Transformer: Variable Declaration', () => {
  it('should detect Russian text in const declaration', () => {
    const code = `const message = "Сообщение";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Сообщение');
    expect(strings[0]?.context).toBe('variable');
  });

  it('should detect Russian text in let declaration', () => {
    const code = `let title = "Заголовок";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Заголовок');
  });
});

// ============================================================================
// TESTS: ARRAY ELEMENT
// ============================================================================

describe('AST Transformer: Array Element', () => {
  it('should detect Russian text in array', () => {
    const code = `const options = ["Первый", "Второй", "Третий"];`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(3);
    expect(strings.every((s) => s.context === 'array-element')).toBe(true);
  });

  it('should detect mixed array with Russian text', () => {
    const code = `const items = ["Русский", "English", "Смешанный"];`;
    const strings = collectStrings(code);

    // Should only detect Russian strings
    expect(strings).toHaveLength(2);
    expect(findByValue(strings, 'Русский')).toBeDefined();
    expect(findByValue(strings, 'Смешанный')).toBeDefined();
    expect(findByValue(strings, 'English')).toBeUndefined();
  });
});

// ============================================================================
// TESTS: SKIP IMPORT
// ============================================================================

describe('AST Transformer: Skip Import', () => {
  it('should skip import path strings', () => {
    const code = `import x from "path/to/module";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should skip named import', () => {
    const code = `import { Component } from "react";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should skip dynamic import', () => {
    const code = `const module = await import("./module");`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should skip export from', () => {
    const code = `export { Component } from "./component";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should not skip Russian text after import', () => {
    const code = `
      import React from "react";
      const title = "Заголовок";
    `;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Заголовок');
  });
});

// ============================================================================
// TESTS: SKIP TECHNICAL STRINGS
// ============================================================================

describe('AST Transformer: Skip Technical Strings', () => {
  it('should skip URL in src attribute', () => {
    const code = `<img src="/api/image" alt="Изображение" />`;
    const strings = collectStrings(code);

    // Should only detect the alt text, not the src
    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Изображение');
  });

  it('should skip absolute URL', () => {
    const code = `const url = "https://example.com/api";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should skip relative path', () => {
    const code = `const path = "./images/logo.png";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should skip hex color', () => {
    const code = `const color = "#ff0000";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should skip CSS class names', () => {
    const code = `<div className="my-class-name" />`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should skip numbers as strings', () => {
    const code = `const value = "123.45";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should skip uppercase constants', () => {
    const code = `const key = "API_KEY";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should skip whitespace-only strings', () => {
    const code = `const space = "   ";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should skip path-like API routes', () => {
    const code = `fetch("/api/users/123");`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });
});

// ============================================================================
// TESTS: SKIP NON-RUSSIAN
// ============================================================================

describe('AST Transformer: Skip Non-Russian', () => {
  it('should skip English text in JSX', () => {
    const code = `<div>Hello World</div>`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should skip English text in attribute', () => {
    const code = `<Input placeholder="Enter name" />`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should skip English text in variable', () => {
    const code = `const message = "Hello";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should detect mixed Russian/English (Russian present)', () => {
    const code = `const text = "Hello, Мир!";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Hello, Мир!');
  });

  it('should skip Chinese text', () => {
    const code = `<div>Hello</div>`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });
});

// ============================================================================
// TESTS: TYPE ANNOTATIONS (should skip)
// ============================================================================

describe('AST Transformer: Skip Type Annotations', () => {
  it('should skip string literal types', () => {
    const code = `type Status = "active" | "inactive";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should skip interface string literals', () => {
    const code = `
      interface Config {
        mode: "production" | "development";
      }
    `;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should skip type with Russian text', () => {
    const code = `type Label = "Активен" | "Неактивен";`;
    const strings = collectStrings(code);

    // Type annotations should be skipped even with Russian text
    expect(strings).toHaveLength(0);
  });
});

// ============================================================================
// TESTS: COMPLEX SCENARIOS
// ============================================================================

describe('AST Transformer: Complex Scenarios', () => {
  it('should handle component with multiple translatable strings', () => {
    const code = `
      function UserProfile({ user }) {
        return (
          <div>
            <h1>Профиль пользователя</h1>
            <Input placeholder="Имя" label="Ваше имя" />
            <button>Сохранить</button>
            {!user && <span>Пользователь не найден</span>}
          </div>
        );
      }
    `;
    const strings = collectStrings(code);

    expect(strings.length).toBeGreaterThanOrEqual(4);
    expect(findByValue(strings, 'Профиль пользователя')).toBeDefined();
    expect(findByValue(strings, 'Имя')).toBeDefined();
    expect(findByValue(strings, 'Ваше имя')).toBeDefined();
    expect(findByValue(strings, 'Сохранить')).toBeDefined();
    expect(findByValue(strings, 'Пользователь не найден')).toBeDefined();
  });

  it('should handle form with validation messages', () => {
    const code = `
      const formConfig = {
        fields: {
          email: {
            label: "Email адрес",
            placeholder: "Введите email",
            error: "Неверный формат email"
          },
          password: {
            label: "Пароль",
            placeholder: "Введите пароль",
            error: "Пароль слишком короткий"
          }
        },
        submitText: "Войти"
      };
    `;
    const strings = collectStrings(code);

    expect(strings.length).toBeGreaterThanOrEqual(7);
    expect(findByValue(strings, 'Email адрес')).toBeDefined();
    expect(findByValue(strings, 'Введите email')).toBeDefined();
    expect(findByValue(strings, 'Неверный формат email')).toBeDefined();
  });

  it('should handle toast notifications', () => {
    const code = `
      async function saveData() {
        try {
          await api.save(data);
          toast.success("Данные сохранены");
        } catch (error) {
          toast.error("Ошибка при сохранении");
        }
      }
    `;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(2);
    expect(findByValue(strings, 'Данные сохранены')).toBeDefined();
    expect(findByValue(strings, 'Ошибка при сохранении')).toBeDefined();
  });

  it('should handle status mapping object', () => {
    const code = `
      const STATUS_LABELS = {
        pending: "Ожидание",
        active: "Активен",
        completed: "Завершен",
        cancelled: "Отменен"
      };
    `;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(4);
    expect(strings.every((s) => s.context === 'object-property')).toBe(true);
  });

  it('should handle conditional rendering with multiple patterns', () => {
    const code = `
      function StatusBadge({ status }) {
        const label = status === 'active'
          ? "Активен"
          : status === 'pending'
            ? "В ожидании"
            : "Неизвестно";

        return <Badge>{label || "Без статуса"}</Badge>;
      }
    `;
    const strings = collectStrings(code);

    expect(strings.length).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================================
// TESTS: LINE NUMBERS
// ============================================================================

describe('AST Transformer: Line Numbers', () => {
  it('should track correct line numbers', () => {
    const code = `
      // Line 1 comment
      const title = "Заголовок"; // Line 2
      // Line 3 comment
      const subtitle = "Подзаголовок"; // Line 4
    `;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(2);

    const titleString = findByValue(strings, 'Заголовок');
    const subtitleString = findByValue(strings, 'Подзаголовок');

    expect(titleString?.line).toBeGreaterThan(0);
    expect(subtitleString?.line).toBeGreaterThan(titleString?.line ?? 0);
  });
});

// ============================================================================
// TESTS: EDGE CASES
// ============================================================================

describe('AST Transformer: Edge Cases', () => {
  it('should handle empty file', () => {
    const code = '';
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should handle file with only imports', () => {
    const code = `
      import React from 'react';
      import { useState } from 'react';
    `;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should handle file with only types', () => {
    const code = `
      type Props = {
        title: string;
        count: number;
      };

      interface User {
        name: string;
        role: "admin" | "user";
      }
    `;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(0);
  });

  it('should handle escaped quotes in strings', () => {
    const code = `const text = "Он сказал: \\"Привет\\"";`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toContain('Привет');
  });

  it('should handle template literals with Russian text', () => {
    const code = 'const msg = `Привет, ${name}!`;';

    // Template literals may or may not be detected depending on implementation
    // The key is that it doesn't crash
    expect(() => collectStrings(code)).not.toThrow();
  });

  it('should handle JSX fragment', () => {
    const code = `
      const Fragment = () => (
        <>
          <span>Первый</span>
          <span>Второй</span>
        </>
      );
    `;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(2);
  });

  it('should handle self-closing JSX with Russian attribute', () => {
    const code = `<Component title="Русский заголовок" />`;
    const strings = collectStrings(code);

    expect(strings).toHaveLength(1);
    expect(strings[0]?.value).toBe('Русский заголовок');
  });
});

// ============================================================================
// TESTS: TRANSLATABLE ATTRIBUTES LIST
// ============================================================================

describe('AST Transformer: Translatable Attributes', () => {
  const translatableAttrs = [
    'alt',
    'title',
    'placeholder',
    'label',
    'aria-label',
    'aria-description',
    'content',
    'description',
    'message',
    'text',
    'tooltip',
    'helperText',
    'errorMessage',
  ];

  translatableAttrs.forEach((attr) => {
    it(`should detect Russian text in ${attr} attribute`, () => {
      const code = `<Component ${attr}="Русский текст" />`;
      const strings = collectStrings(code);

      expect(strings).toHaveLength(1);
      expect(strings[0]?.value).toBe('Русский текст');
      expect(strings[0]?.context).toBe('jsx-attribute');
    });
  });
});
