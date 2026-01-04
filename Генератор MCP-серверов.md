# 🗂️ Smart File Organizer (Lite Edition)

> Оффлайн AI-органайзер файлов. Весит ~200 MB, работает без интернета.

---

## 📋 Описание проекта

**Проблема:** Хаос в папках — тысячи файлов в "Загрузках", дубликаты, забытые документы.

**Решение:** Локальный агент, который:
- Анализирует файлы без отправки данных в облако
- Учится на твоих привычках организации
- Работает полностью оффлайн
- Весит всего ~200 MB

**Принципы:**
```
🔒 Приватность   — данные не покидают компьютер
🪶 Лёгкость      — ~200 MB, работает на 4 GB RAM
⚡ Скорость      — мгновенная классификация
🔌 Оффлайн       — не требует интернета
```

---

## 🚀 Быстрый старт

```bash
# Установка
npm install -g smart-file-organizer

# Первый запуск (скачает модели ~100 MB)
smart-organizer setup

# Сканирование
smart-organizer scan ~/Downloads

# Сортировка
smart-organizer organize ~/Downloads
```

---

## 🧠 Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                   Smart File Organizer                       │
│                      Lite Edition                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┐   ┌────────────┐   ┌────────────────────┐   │
│  │  Scanner   │──▶│  Analyzer  │──▶│  Rule Engine       │   │
│  │            │   │            │   │  (быстрые правила) │   │
│  └────────────┘   └────────────┘   └─────────┬──────────┘   │
│                                              │              │
│                                              ▼              │
│                                    ┌────────────────────┐   │
│                                    │  Mini AI (опц.)    │   │
│                                    │  • MiniLM (23 MB)  │   │
│                                    │  • MobileBERT      │   │
│                                    │  • Tesseract OCR   │   │
│                                    └─────────┬──────────┘   │
│                                              │              │
│                                              ▼              │
│  ┌────────────┐   ┌────────────┐   ┌────────────────────┐   │
│  │  Watcher   │◀──│  Executor  │◀──│  Suggester         │   │
│  │(мониторинг)│   │ (действия) │   │  (предложения)     │   │
│  └────────────┘   └────────────┘   └────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    SQLite Database                    │   │
│  │  • История операций  • Паттерны  • Кэш анализа       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Размер приложения

```
smart-file-organizer/              ИТОГО: ~200 MB
│
├── node_modules/                  ~80 MB
│   ├── @xenova/transformers         30 MB  (ML runtime)
│   ├── onnxruntime-node             25 MB  (ONNX runtime)
│   ├── better-sqlite3                8 MB  (база данных)
│   ├── sharp                        15 MB  (изображения)
│   └── остальное                    ~2 MB
│
├── models/                        ~100 MB (скачиваются при setup)
│   ├── all-MiniLM-L6-v2             23 MB  (эмбеддинги)
│   ├── mobilebert-uncased           25 MB  (классификация)
│   ├── tesseract-core               10 MB  (OCR движок)
│   ├── tesseract-eng                15 MB  (английский)
│   └── tesseract-rus                20 MB  (русский, опц.)
│
├── dist/                          ~2 MB   (скомпилированный код)
│
└── data/                          ~5-50 MB (зависит от использования)
    ├── organizer.db                 SQLite база
    └── cache/                       Кэш анализа
```

---

## 📁 Структура проекта

```
smart-file-organizer/
│
├── 📄 package.json
├── 📄 tsconfig.json
├── 📄 README.md
├── 📄 LICENSE (MIT)
├── 📄 .gitignore
│
├── 📂 bin/
│   └── 📄 cli.js                    # Entry point
│
├── 📂 src/
│   │
│   ├── 📄 index.ts                  # Главный экспорт
│   ├── 📄 cli.ts                    # CLI команды
│   ├── 📄 config.ts                 # Конфигурация
│   │
│   ├── 📂 core/                     # Ядро
│   │   ├── 📄 scanner.ts            # Сканирование файлов
│   │   ├── 📄 analyzer.ts           # Анализ метаданных
│   │   ├── 📄 rule-engine.ts        # Движок правил
│   │   ├── 📄 suggester.ts          # Генерация предложений
│   │   ├── 📄 executor.ts           # Выполнение действий
│   │   └── 📄 watcher.ts            # Мониторинг папок
│   │
│   ├── 📂 analyzers/                # Анализаторы по типам
│   │   ├── 📄 index.ts              # Роутер анализаторов
│   │   ├── 📄 image.ts              # EXIF, размеры, хеш
│   │   ├── 📄 document.ts           # PDF, DOCX, TXT
│   │   ├── 📄 audio.ts              # ID3 теги
│   │   ├── 📄 video.ts              # Метаданные видео
│   │   ├── 📄 code.ts               # Язык, проект
│   │   └── 📄 archive.ts            # Содержимое архивов
│   │
│   ├── 📂 ai/                       # Мини AI модели
│   │   ├── 📄 model-manager.ts      # Загрузка/кэш моделей
│   │   ├── 📄 embeddings.ts         # MiniLM эмбеддинги
│   │   ├── 📄 classifier.ts         # MobileBERT классификация
│   │   ├── 📄 ocr.ts                # Tesseract OCR
│   │   └── 📄 similarity.ts         # Поиск похожих файлов
│   │
│   ├── 📂 rules/                    # Система правил
│   │   ├── 📄 parser.ts             # Парсер YAML правил
│   │   ├── 📄 matcher.ts            # Матчинг файлов
│   │   ├── 📄 actions.ts            # Действия правил
│   │   └── 📂 presets/              # Готовые правила
│   │       ├── 📄 downloads.ts      # Для папки Downloads
│   │       ├── 📄 desktop.ts        # Для Desktop
│   │       ├── 📄 photos.ts         # Для фотографий
│   │       └── 📄 documents.ts      # Для документов
│   │
│   ├── 📂 learning/                 # Обучение на привычках
│   │   ├── 📄 pattern-tracker.ts    # Отслеживание паттернов
│   │   ├── 📄 rule-suggester.ts     # Предложение новых правил
│   │   └── 📄 feedback.ts           # Обработка фидбека
│   │
│   ├── 📂 storage/                  # Хранение
│   │   ├── 📄 database.ts           # SQLite операции
│   │   ├── 📄 migrations.ts         # Миграции схемы
│   │   └── 📄 cache.ts              # Кэширование анализа
│   │
│   ├── 📂 actions/                  # Файловые операции
│   │   ├── 📄 move.ts               # Перемещение
│   │   ├── 📄 copy.ts               # Копирование
│   │   ├── 📄 rename.ts             # Переименование
│   │   ├── 📄 delete.ts             # Удаление (в корзину)
│   │   ├── 📄 deduplicate.ts        # Удаление дубликатов
│   │   └── 📄 undo.ts               # Откат операций
│   │
│   ├── 📂 ui/                       # Интерфейс
│   │   ├── 📄 prompts.ts            # Интерактивные промпты
│   │   ├── 📄 progress.ts           # Прогресс-бары
│   │   ├── 📄 table.ts              # Таблицы в консоли
│   │   └── 📄 colors.ts             # Цветной вывод
│   │
│   └── 📂 utils/                    # Утилиты
│       ├── 📄 file-hash.ts          # xxHash для дубликатов
│       ├── 📄 mime.ts               # MIME типы
│       ├── 📄 paths.ts              # Работа с путями
│       ├── 📄 fs-safe.ts            # Безопасные операции
│       └── 📄 logger.ts             # Логирование
│
├── 📂 models/                       # AI модели (gitignore)
│   └── 📄 .gitkeep
│
├── 📂 tests/
│   ├── 📂 unit/
│   ├── 📂 integration/
│   └── 📂 fixtures/
│
└── 📂 docs/
    ├── 📄 RULES.md
    └── 📄 API.md
```

---

## 🛠 Технический стек

### package.json

```json
{
  "name": "smart-file-organizer",
  "version": "0.1.0",
  "description": "Offline AI file organizer with mini models",
  "bin": {
    "smart-organizer": "./bin/cli.js"
  },
  "scripts": {
    "dev": "tsx watch src/cli.ts",
    "build": "tsup src/index.ts src/cli.ts --format cjs,esm --dts",
    "test": "vitest",
    "lint": "eslint src/",
    "postinstall": "node scripts/download-models.js"
  },
  "dependencies": {
    "@xenova/transformers": "^2.17.0",
    "tesseract.js": "^5.0.5",
    
    "better-sqlite3": "^9.6.0",
    "chokidar": "^3.6.0",
    "fs-extra": "^11.2.0",
    "glob": "^10.4.0",
    
    "sharp": "^0.33.4",
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.7.0",
    "music-metadata": "^7.14.0",
    "exif-reader": "^2.0.0",
    
    "xxhash-wasm": "^1.0.2",
    "mime-types": "^2.1.35",
    
    "commander": "^12.1.0",
    "inquirer": "^9.2.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.1",
    "cli-table3": "^0.6.5",
    
    "yaml": "^2.4.0",
    "zod": "^3.23.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.11.0",
    "tsup": "^8.1.0",
    "vitest": "^1.6.0",
    "@types/node": "^20.14.0",
    "@types/better-sqlite3": "^7.6.10",
    "@types/fs-extra": "^11.0.4",
    "@types/inquirer": "^9.0.7"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## 🤖 AI компоненты (мини-модели)

### 1. Эмбеддинги — all-MiniLM-L6-v2 (23 MB)

```typescript
// src/ai/embeddings.ts
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

class EmbeddingService {
  private model: FeatureExtractionPipeline | null = null;
  private modelPath = 'Xenova/all-MiniLM-L6-v2';
  
  async init(): Promise<void> {
    if (this.model) return;
    
    console.log('📦 Загрузка модели эмбеддингов (23 MB)...');
    this.model = await pipeline('feature-extraction', this.modelPath, {
      quantized: true,  // Используем квантованную версию
    });
  }
  
  async embed(text: string): Promise<number[]> {
    if (!this.model) await this.init();
    
    const output = await this.model!(text, {
      pooling: 'mean',
      normalize: true,
    });
    
    return Array.from(output.data);
  }
  
  async similarity(text1: string, text2: string): Promise<number> {
    const [emb1, emb2] = await Promise.all([
      this.embed(text1),
      this.embed(text2),
    ]);
    
    // Косинусное сходство
    return this.cosineSimilarity(emb1, emb2);
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const embeddings = new EmbeddingService();
```

### 2. Классификация — Zero-Shot (25 MB)

```typescript
// src/ai/classifier.ts
import { pipeline, ZeroShotClassificationPipeline } from '@xenova/transformers';

// Категории для классификации
const FILE_CATEGORIES = [
  'work document',
  'personal document', 
  'financial document',
  'photo or image',
  'screenshot',
  'code or programming',
  'music or audio',
  'video',
  'archive or backup',
  'download or installer',
  'temporary or junk',
] as const;

class ClassifierService {
  private model: ZeroShotClassificationPipeline | null = null;
  
  async init(): Promise<void> {
    if (this.model) return;
    
    console.log('📦 Загрузка модели классификации (25 MB)...');
    this.model = await pipeline(
      'zero-shot-classification',
      'Xenova/mobilebert-uncased-mnli',
      { quantized: true }
    );
  }
  
  async classify(
    content: string,
    categories: string[] = [...FILE_CATEGORIES]
  ): Promise<{ label: string; score: number }[]> {
    if (!this.model) await this.init();
    
    const result = await this.model!(content, categories, {
      multi_label: false,
    });
    
    return result.labels.map((label: string, i: number) => ({
      label,
      score: result.scores[i],
    }));
  }
  
  async classifyFile(fileInfo: {
    filename: string;
    content?: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    // Собираем контекст для классификации
    const context = [
      `filename: ${fileInfo.filename}`,
      fileInfo.content?.slice(0, 500),
      fileInfo.metadata ? `metadata: ${JSON.stringify(fileInfo.metadata)}` : '',
    ].filter(Boolean).join('\n');
    
    const results = await this.classify(context);
    return results[0].label;
  }
}

export const classifier = new ClassifierService();
```

### 3. OCR — Tesseract.js (40 MB с языками)

```typescript
// src/ai/ocr.ts
import Tesseract from 'tesseract.js';

class OCRService {
  private worker: Tesseract.Worker | null = null;
  private languages: string[] = ['eng'];
  
  async init(languages: string[] = ['eng']): Promise<void> {
    if (this.worker) return;
    
    this.languages = languages;
    console.log(`📦 Загрузка OCR (${languages.join('+')})...`);
    
    this.worker = await Tesseract.createWorker(languages, 1, {
      cachePath: './models/tesseract',
      logger: () => {}, // Тихий режим
    });
  }
  
  async recognize(imagePath: string): Promise<{
    text: string;
    confidence: number;
  }> {
    if (!this.worker) await this.init();
    
    const { data } = await this.worker!.recognize(imagePath);
    
    return {
      text: data.text.trim(),
      confidence: data.confidence / 100,
    };
  }
  
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export const ocr = new OCRService();
```

### 4. Менеджер моделей

```typescript
// src/ai/model-manager.ts
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { embeddings } from './embeddings';
import { classifier } from './classifier';
import { ocr } from './ocr';

const MODELS_DIR = join(__dirname, '../../models');

export interface ModelStatus {
  embeddings: boolean;
  classifier: boolean;
  ocr: boolean;
  totalSize: string;
}

class ModelManager {
  private initialized = false;
  
  async setup(options: {
    embeddings?: boolean;
    classifier?: boolean;
    ocr?: boolean;
    ocrLanguages?: string[];
  } = {}): Promise<void> {
    const {
      embeddings: useEmbed = true,
      classifier: useClass = true,
      ocr: useOCR = true,
      ocrLanguages = ['eng'],
    } = options;
    
    // Создаём папку для моделей
    if (!existsSync(MODELS_DIR)) {
      mkdirSync(MODELS_DIR, { recursive: true });
    }
    
    // Параллельная загрузка
    const tasks: Promise<void>[] = [];
    
    if (useEmbed) tasks.push(embeddings.init());
    if (useClass) tasks.push(classifier.init());
    if (useOCR) tasks.push(ocr.init(ocrLanguages));
    
    await Promise.all(tasks);
    this.initialized = true;
    
    console.log('✅ Все модели загружены');
  }
  
  async getStatus(): Promise<ModelStatus> {
    return {
      embeddings: true,
      classifier: true,
      ocr: true,
      totalSize: '~100 MB',
    };
  }
  
  isReady(): boolean {
    return this.initialized;
  }
}

export const modelManager = new ModelManager();
```

---

## 📝 Система правил

### Конфигурация (YAML)

```yaml
# ~/.config/smart-organizer/rules.yaml

version: 1

settings:
  mode: suggest          # suggest | auto
  confirm_destructive: true
  ignore_hidden: true
  ignore_patterns:
    - "*.tmp"
    - "*.crdownload"
    - ".DS_Store"
    - "Thumbs.db"
    - "desktop.ini"

# Куда сортировать
destinations:
  photos: ~/Pictures/Sorted
  screenshots: ~/Pictures/Screenshots
  documents: ~/Documents/Sorted
  work: ~/Documents/Work
  finance: ~/Documents/Finance
  code: ~/Projects
  music: ~/Music/Sorted
  video: ~/Videos/Sorted
  archives: ~/Archives
  trash: ~/.Trash

# Правила (выполняются по приоритету)
rules:
  # ══════════════════════════════════════════
  # ИЗОБРАЖЕНИЯ
  # ══════════════════════════════════════════
  
  - name: "Скриншоты"
    priority: 100
    match:
      extension: [png, jpg]
      filename: ["Screenshot*", "Снимок*", "Screen Shot*"]
    action:
      move_to: "{destinations.screenshots}/{year}-{month}/"
      
  - name: "Фото с камеры"
    priority: 90
    match:
      extension: [jpg, jpeg, heic, raw, cr2, nef]
      has_exif: true
    action:
      move_to: "{destinations.photos}/{exif.year}/{exif.month}/"
      
  - name: "Изображения без EXIF"
    priority: 80
    match:
      type: image
    action:
      move_to: "{destinations.photos}/Unsorted/"

  # ══════════════════════════════════════════
  # ДОКУМЕНТЫ
  # ══════════════════════════════════════════
  
  - name: "Счета и инвойсы"
    priority: 95
    match:
      extension: [pdf]
      filename: ["*invoice*", "*счёт*", "*receipt*", "*чек*"]
    action:
      move_to: "{destinations.finance}/Invoices/{year}/"
      
  - name: "Банковские выписки"
    priority: 95
    match:
      extension: [pdf]
      filename: ["*statement*", "*выписка*"]
    action:
      move_to: "{destinations.finance}/Statements/{year}/"
      
  - name: "Рабочие документы"
    priority: 85
    match:
      extension: [pdf, docx, doc, xlsx, xls, pptx]
      content_contains: ["NDA", "Contract", "Agreement", "Договор"]
    use_ai: true
    action:
      move_to: "{destinations.work}/{ai.project}/"
      
  - name: "Остальные документы"
    priority: 70
    match:
      extension: [pdf, docx, doc, txt, rtf, odt]
    action:
      move_to: "{destinations.documents}/{year}/"

  # ══════════════════════════════════════════
  # КОД
  # ══════════════════════════════════════════
  
  - name: "Исходный код"
    priority: 85
    match:
      extension: [js, ts, py, go, rs, java, cpp, c, h, rb, php]
    action:
      suggest_to: "{destinations.code}/"
      
  - name: "Конфиги"
    priority: 80
    match:
      extension: [json, yaml, yml, toml, ini, env]
      filename: [".*", "package.json", "tsconfig.json"]
    action:
      suggest_to: "{destinations.code}/"

  # ══════════════════════════════════════════
  # МЕДИА
  # ══════════════════════════════════════════
  
  - name: "Музыка"
    priority: 85
    match:
      extension: [mp3, flac, wav, aac, ogg, m4a]
    action:
      move_to: "{destinations.music}/{audio.artist}/{audio.album}/"
      
  - name: "Видео"
    priority: 85
    match:
      extension: [mp4, mkv, avi, mov, webm]
    action:
      move_to: "{destinations.video}/{year}/"

  # ══════════════════════════════════════════
  # АРХИВЫ И УСТАНОВЩИКИ
  # ══════════════════════════════════════════
  
  - name: "Архивы"
    priority: 75
    match:
      extension: [zip, rar, 7z, tar, gz, bz2]
    action:
      move_to: "{destinations.archives}/"
      
  - name: "Установщики (удалить)"
    priority: 100
    match:
      extension: [dmg, pkg, exe, msi]
      age: "> 30 days"
    action:
      delete: true
      confirm: true

  # ══════════════════════════════════════════
  # МУСОР
  # ══════════════════════════════════════════
  
  - name: "Временные файлы"
    priority: 100
    match:
      extension: [tmp, temp, bak, swp, ~]
    action:
      delete: true
      
  - name: "Старые загрузки"
    priority: 50
    match:
      location: "~/Downloads"
      age: "> 90 days"
      accessed: "> 60 days"
    action:
      archive_to: "{destinations.archives}/Old Downloads/"
```

---

## 💻 CLI команды

### Основные команды

```bash
# ══════════════════════════════════════════════════════════════
# SETUP — первоначальная настройка
# ══════════════════════════════════════════════════════════════

smart-organizer setup
# Интерактивный мастер:
# - Скачивание моделей (~100 MB)
# - Выбор языков OCR
# - Создание конфига

smart-organizer setup --minimal     # Без AI моделей (~50 MB)
smart-organizer setup --full        # С русским OCR (~120 MB)


# ══════════════════════════════════════════════════════════════
# SCAN — анализ папки
# ══════════════════════════════════════════════════════════════

smart-organizer scan ~/Downloads

# Опции:
smart-organizer scan ~/Downloads --deep        # Рекурсивно
smart-organizer scan ~/Downloads --duplicates  # Найти дубликаты
smart-organizer scan ~/Downloads --json        # Вывод в JSON


# ══════════════════════════════════════════════════════════════
# ORGANIZE — сортировка
# ══════════════════════════════════════════════════════════════

smart-organizer organize ~/Downloads

# Режимы:
smart-organizer organize ~/Downloads --dry-run      # Только показать
smart-organizer organize ~/Downloads --interactive  # Подтверждать каждый
smart-organizer organize ~/Downloads --auto         # Автоматически
smart-organizer organize ~/Downloads --auto --confidence 0.9


# ══════════════════════════════════════════════════════════════
# WATCH — мониторинг в реальном времени
# ══════════════════════════════════════════════════════════════

smart-organizer watch ~/Downloads
smart-organizer watch ~/Downloads --auto   # Автосортировка новых файлов


# ══════════════════════════════════════════════════════════════
# DUPLICATES — работа с дубликатами
# ══════════════════════════════════════════════════════════════

smart-organizer duplicates ~/Pictures          # Найти дубликаты
smart-organizer duplicates ~/Pictures --clean  # Удалить дубликаты


# ══════════════════════════════════════════════════════════════
# UNDO — откат операций
# ══════════════════════════════════════════════════════════════

smart-organizer undo              # Откатить последнюю операцию
smart-organizer undo --all        # Показать историю
smart-organizer undo --id 123     # Откатить конкретную


# ══════════════════════════════════════════════════════════════
# RULES — управление правилами
# ══════════════════════════════════════════════════════════════

smart-organizer rules list              # Показать все правила
smart-organizer rules add               # Добавить правило (wizard)
smart-organizer rules test ./file.pdf   # Проверить какое правило сработает
smart-organizer rules edit              # Открыть конфиг в редакторе
```

---

## 📊 Примеры вывода

### Сканирование

```bash
$ smart-organizer scan ~/Downloads

📂 Сканирование ~/Downloads...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Статистика:
┌──────────────────┬────────┬───────────┐
│ Тип              │ Кол-во │ Размер    │
├──────────────────┼────────┼───────────┤
│ 📷 Изображения   │    342 │ 1.2 GB    │
│ 📄 Документы     │    156 │ 890 MB    │
│ 🎵 Аудио         │     45 │ 2.1 GB    │
│ 🎬 Видео         │     12 │ 8.4 GB    │
│ 💻 Код           │    203 │ 45 MB     │
│ 📦 Архивы        │     89 │ 3.2 GB    │
│ ❓ Прочее        │    400 │ 1.8 GB    │
├──────────────────┼────────┼───────────┤
│ ИТОГО            │  1,247 │ 17.6 GB   │
└──────────────────┴────────┴───────────┘

⚠️  Найдено:
• 🔄 67 дубликатов (2.3 GB можно освободить)
• 🗑️  123 временных файла
• ⏰ 445 файлов старше 1 года

💡 Запустите: smart-organizer organize ~/Downloads
```

### Интерактивная сортировка

```bash
$ smart-organizer organize ~/Downloads --interactive

📂 Сортировка файлов (1,247 шт.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/1247] vacation_bali_2024.jpg
         ├─ 📷 JPEG • 4.2 MB
         ├─ 📅 Снято: 15 июля 2024
         ├─ 📍 Бали, Индонезия
         └─ 📱 iPhone 15 Pro

    → ~/Pictures/Sorted/2024/07/

    [Enter] Принять  [e] Изменить  [s] Пропустить  [q] Выход

> ✅ Перемещено

[2/1247] invoice_amazon_dec.pdf
         ├─ 📄 PDF • 156 KB
         ├─ 🔍 Содержит: "Amazon", "Invoice", "$49.99"
         └─ 🏷️  AI: financial document (94%)

    → ~/Documents/Finance/Invoices/2024/

> e
  Введите путь: ~/Documents/Shopping/Amazon/
  💾 Сохранить как правило для будущих файлов Amazon? [y/N] y
> ✅ Перемещено + правило создано

[3/1247] IMG_4521.HEIC
...
```

### Режим мониторинга

```bash
$ smart-organizer watch ~/Downloads --auto

👁️  Мониторинг ~/Downloads
   Автоматическая сортировка включена
   Ctrl+C для выхода
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

14:32:15 │ 📥 report_q3_2024.xlsx
         │ → ~/Documents/Work/Reports/2024/
         │ ✅ Перемещено (правило: "Рабочие документы")

14:35:42 │ 📥 IMG_8823.HEIC
         │ → ~/Pictures/Sorted/2024/12/
         │ ✅ Перемещено (правило: "Фото с камеры")

14:40:01 │ 📥 странный_файл.xyz
         │ ⚠️ Не удалось классифицировать
         │ 💡 Добавить правило: smart-organizer rules add

14:45:22 │ 📥 movie.mp4 (2.3 GB)
         │ → ~/Videos/Sorted/2024/
         │ ✅ Перемещено (правило: "Видео")
```

---

## 🗄️ База данных (SQLite)

```sql
-- Анализированные файлы
CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    extension TEXT,
    mime_type TEXT,
    size INTEGER,
    hash TEXT,                      -- xxhash
    created_at INTEGER,
    modified_at INTEGER,
    accessed_at INTEGER,
    
    -- Метаданные
    metadata_json TEXT,             -- EXIF, ID3, etc
    
    -- AI анализ
    embedding BLOB,                 -- Вектор MiniLM
    category TEXT,                  -- Категория от AI
    category_confidence REAL,
    ocr_text TEXT,                  -- Распознанный текст
    
    analyzed_at INTEGER DEFAULT (unixepoch())
);

-- История операций
CREATE TABLE operations (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,             -- move, copy, delete, rename
    source TEXT NOT NULL,
    destination TEXT,
    rule_name TEXT,
    confidence REAL,
    created_at INTEGER DEFAULT (unixepoch()),
    undone_at INTEGER
);

-- Пользовательские паттерны (обучение)
CREATE TABLE patterns (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,             -- filename, content, extension
    pattern TEXT NOT NULL,
    destination TEXT NOT NULL,
    occurrences INTEGER DEFAULT 1,
    last_used INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
);

-- Индексы
CREATE INDEX idx_files_hash ON files(hash);
CREATE INDEX idx_files_extension ON files(extension);
CREATE INDEX idx_operations_created ON operations(created_at);
```

---

## 🎯 Roadmap

### v0.1.0 — MVP (2-3 недели)
- [x] Структура проекта
- [ ] Сканирование с метаданными
- [ ] Базовые правила (YAML)
- [ ] CLI команды: scan, organize, undo
- [ ] SQLite хранение
- [ ] Поиск дубликатов (по хешу)

### v0.2.0 — AI (1-2 недели)
- [ ] Интеграция MiniLM эмбеддингов
- [ ] Zero-shot классификация
- [ ] Tesseract OCR
- [ ] Семантический поиск похожих

### v0.3.0 — Обучение (1-2 недели)
- [ ] Отслеживание паттернов
- [ ] Автогенерация правил
- [ ] Feedback loop

### v0.4.0 — Автоматизация (1 неделя)
- [ ] Watch режим
- [ ] Системные уведомления
- [ ] Autostart опция

---

## 🚀 Команды разработки

```bash
# Клонирование
git clone https://github.com/user/smart-file-organizer
cd smart-file-organizer

# Установка
npm install

# Разработка
npm run dev -- scan ./test-folder

# Сборка
npm run build

# Тесты
npm test

# Локальное использование
npm link
smart-organizer --help
```

---

## 📄 Лицензия

MIT © 2024
