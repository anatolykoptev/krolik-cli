# Semantic Code Embeddings для Refactor

## Цель

Улучшить обнаружение дубликатов в `krolik refactor`, используя семантическое сходство кода вместо только структурного (AST).

## Текущее состояние

- `krolik refactor` находит дубликаты по совпадению сигнатур функций
- `embedding-worker.ts` уже загружает модель для memory search
- Модель: `Xenova/all-MiniLM-L6-v2` (384 dimensions)

## План реализации

### Phase 1: Инфраструктура

1. **Создать code embedding service**
   - Файл: `src/lib/@ast/code-embeddings.ts`
   - Переиспользовать `embedding-worker.ts`
   - Добавить препроцессинг кода (убрать комментарии, нормализовать)

2. **Кэш embeddings**
   - SQLite таблица `code_embeddings`
   - Ключ: file_path + function_name + content_hash
   - Инвалидация при изменении файла

### Phase 2: Интеграция в Refactor

3. **Расширить анализ функций**
   - Файл: `src/commands/refactor/analyzers/duplicates.ts`
   - После AST анализа — вычислить embeddings
   - Сравнить cosine similarity между функциями

4. **Порог схожести**
   - `> 0.95` — почти идентичный код (высокий приоритет)
   - `0.85 - 0.95` — похожий код (средний приоритет)
   - `< 0.85` — разный код (игнорировать)

### Phase 3: Вывод и предложения

5. **Группировка похожего кода**
   - Кластеризация по similarity
   - Предложение: "Эти 3 функции делают похожее — рассмотри объединение"

6. **Smart suggestions**
   - Если код похож на 90%, показать diff
   - Предложить имя для общей функции

## Структура кода

```
src/
├── lib/
│   └── @ast/
│       └── code-embeddings.ts    # NEW: embedding service
├── commands/
│   └── refactor/
│       ├── analyzers/
│       │   └── semantic-duplicates.ts  # NEW: semantic analysis
│       └── index.ts              # интеграция
```

## API

```typescript
// code-embeddings.ts
interface CodeEmbedding {
  filePath: string;
  functionName: string;
  embedding: number[];
  contentHash: string;
}

async function embedCode(code: string): Promise<number[]>
async function findSimilar(embedding: number[], threshold: number): Promise<SimilarCode[]>

// semantic-duplicates.ts
interface SemanticDuplicate {
  functions: FunctionInfo[];
  similarity: number;
  suggestion: string;
}

async function findSemanticDuplicates(functions: FunctionInfo[]): Promise<SemanticDuplicate[]>
```

## Метрики успеха

- [ ] Находит дубликаты с разными именами переменных
- [ ] Находит copy-paste с мелкими изменениями
- [ ] Время анализа < 10s для 100 функций
- [ ] Кэш работает (повторный запуск быстрее)
