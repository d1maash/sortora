
⏺ Отлично! Теперь создам детальный план реализации:

⏺ Updated plan
  ⎿  /plan to preview

⏺ План реализации готов. Проект будет включать:

  Основной функционал:
  - CLI с командами: setup, scan, organize, watch, duplicates, undo, rules
  - Анализаторы для изображений, документов, аудио, видео, кода, архивов
  - SQLite база для хранения метаданных и истории операций
  - Система правил на YAML с пресетами

  AI компоненты:
  - MiniLM для эмбеддингов (семантический поиск похожих файлов)
  - MobileBERT для zero-shot классификации
  - Tesseract OCR (английский)

  12 этапов реализации — от инициализации проекта до AI моделей.
                                           
⏺ User approved Claude's plan
  ⎿ Plan saved to: ~/.claude/plans/peppy-ho
    nking-biscuit.md · /plan to edit
    План реализации: Sortora (Smart File 
    Organizer)

    Обзор проекта

    Оффлайн AI-органайзер файлов на 
    Node.js/TypeScript с CLI интерфейсом.

    Технологии

    - Runtime: Node.js 18+, TypeScript
    - AI: @xenova/transformers (MiniLM, 
    MobileBERT), tesseract.js
    - Database: better-sqlite3
    - CLI: commander, inquirer, chalk, ora
    - File ops: chokidar, sharp, fs-extra

    ---
    Этапы реализации

    Этап 1: Инициализация проекта

    1. Создать package.json с именем 
    "sortora"
    2. Создать tsconfig.json
    3. Создать .gitignore
    4. Создать bin/cli.js (entry point)

    Этап 2: Базовая инфраструктура

    Файлы:
    - src/index.ts - главный экспорт
    - src/cli.ts - CLI команды (commander)
    - src/config.ts - конфигурация 
    приложения

    Этап 3: Утилиты

    Файлы:
    - src/utils/logger.ts - логирование 
    (chalk)
    - src/utils/paths.ts - работа с путями
    - src/utils/mime.ts - MIME типы
    - src/utils/file-hash.ts - xxHash для 
    дубликатов
    - src/utils/fs-safe.ts - безопасные 
    файловые операции

    Этап 4: Хранилище (SQLite)

    Файлы:
    - src/storage/database.ts - SQLite 
    операции
    - src/storage/migrations.ts - миграции 
    схемы
    - src/storage/cache.ts - кэширование 
    анализа

    Этап 5: UI компоненты

    Файлы:
    - src/ui/colors.ts - цветной вывод
    - src/ui/progress.ts - прогресс-бары 
    (ora)
    - src/ui/table.ts - таблицы 
    (cli-table3)
    - src/ui/prompts.ts - интерактивные 
    промпты (inquirer)

    Этап 6: Анализаторы файлов

    Файлы:
    - src/analyzers/index.ts - роутер 
    анализаторов
    - src/analyzers/image.ts - EXIF, 
    размеры, хеш
    - src/analyzers/document.ts - PDF, 
    DOCX, TXT
    - src/analyzers/audio.ts - ID3 теги
    - src/analyzers/video.ts - метаданные 
    видео
    - src/analyzers/code.ts - язык 
    программирования
    - src/analyzers/archive.ts - содержимое
     архивов

    Этап 7: Ядро системы

    Файлы:
    - src/core/scanner.ts - сканирование 
    файлов
    - src/core/analyzer.ts - анализ 
    метаданных
    - src/core/rule-engine.ts - движок 
    правил
    - src/core/suggester.ts - генерация 
    предложений
    - src/core/executor.ts - выполнение 
    действий
    - src/core/watcher.ts - мониторинг 
    папок

    Этап 8: Система правил

    Файлы:
    - src/rules/parser.ts - парсер YAML 
    правил
    - src/rules/matcher.ts - матчинг файлов
    - src/rules/actions.ts - действия 
    правил
    - src/rules/presets/downloads.ts - 
    правила для Downloads
    - src/rules/presets/desktop.ts - 
    правила для Desktop
    - src/rules/presets/photos.ts - правила
     для фото
    - src/rules/presets/documents.ts - 
    правила для документов

    Этап 9: Файловые операции

    Файлы:
    - src/actions/move.ts - перемещение
    - src/actions/copy.ts - копирование
    - src/actions/rename.ts - 
    переименование
    - src/actions/delete.ts - удаление (в 
    корзину)
    - src/actions/deduplicate.ts - удаление
     дубликатов
    - src/actions/undo.ts - откат операций

    Этап 10: AI модели

    Файлы:
    - src/ai/model-manager.ts - 
    загрузка/кэш моделей
    - src/ai/embeddings.ts - MiniLM 
    эмбеддинги
    - src/ai/classifier.ts - MobileBERT 
    классификация
    - src/ai/ocr.ts - Tesseract OCR 
    (английский)
    - src/ai/similarity.ts - поиск похожих 
    файлов

    Этап 11: Обучение на привычках

    Файлы:
    - src/learning/pattern-tracker.ts - 
    отслеживание паттернов
    - src/learning/rule-suggester.ts - 
    предложение новых правил
    - src/learning/feedback.ts - обработка 
    фидбека

    Этап 12: Финализация

    - Создать папку models/.gitkeep
    - Проверить работоспособность всех 
    команд
    - Добавить скрипт 
    scripts/download-models.js

    ---
    CLI команды (итоговые)

    sortora setup [--minimal | --full]    #
     Настройка и скачивание моделей
    sortora scan <path> [--deep] 
    [--duplicates] [--json]
    sortora organize <path> [--dry-run] 
    [--interactive] [--auto]
    sortora watch <path> [--auto]
    sortora duplicates <path> [--clean]
    sortora undo [--all] [--id <id>]
    sortora rules list|add|test|edit

    ---
    Критические файлы

    1. package.json - зависимости и скрипты
    2. src/cli.ts - точка входа CLI
    3. src/core/scanner.ts - основная 
    логика сканирования
    4. src/storage/database.ts - SQLite 
    схема и операции
    5. src/ai/model-manager.ts - управление
     AI моделями






⏺ Отлично! Начинаю реализацию проекта Sortora. Создам todo list для отслеживания прогресса: