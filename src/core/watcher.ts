import { EventEmitter } from 'events';
import chokidar, { FSWatcher } from 'chokidar';
import { Database } from '../storage/database.js';
import { Analyzer, type FileAnalysis } from './analyzer.js';
import { RuleEngine } from './rule-engine.js';
import { Suggester } from './suggester.js';
import { Executor } from './executor.js';
import type { Config } from '../config.js';

export interface WatcherOptions {
  auto?: boolean;
  minConfidence?: number;
  debounceMs?: number;
  ignorePatterns?: string[];
}

export interface WatcherEvents {
  file: (file: FileAnalysis) => void;
  changed: (file: FileAnalysis) => void;
  organized: (file: FileAnalysis, destination: string) => void;
  skipped: (file: FileAnalysis, reason: string) => void;
  error: (error: Error) => void;
}

export class Watcher extends EventEmitter {
  private config: Config;
  private watcher: FSWatcher | null = null;
  private analyzer: Analyzer;
  private ruleEngine: RuleEngine;
  private suggester: Suggester;
  private executor: Executor;
  private pendingFiles = new Map<string, NodeJS.Timeout>();
  private options: WatcherOptions = {};

  constructor(db: Database, config: Config, modelsDir: string) {
    super();
    this.config = config;
    this.analyzer = new Analyzer(modelsDir);
    this.ruleEngine = new RuleEngine(config);
    this.suggester = new Suggester(this.ruleEngine, config);
    this.executor = new Executor(db);
  }

  async start(path: string, options: WatcherOptions = {}): Promise<void> {
    this.options = {
      auto: false,
      minConfidence: 0.8,
      debounceMs: 1000,
      ignorePatterns: this.config.settings.ignorePatterns,
      ...options,
    };

    const ignored = [
      /(^|[\/\\])\../, // Dotfiles
      ...this.options.ignorePatterns!.map(p => new RegExp(p.replace(/\*/g, '.*'))),
    ];

    this.watcher = chokidar.watch(path, {
      persistent: true,
      ignoreInitial: true,
      ignored,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (filePath) => {
      this.handleFileAdded(filePath);
    });

    // #15: Handle change events
    this.watcher.on('change', (filePath) => {
      this.handleFileChanged(filePath);
    });

    this.watcher.on('error', (error) => {
      this.emit('error', error);
    });
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    // Clear pending timeouts
    for (const timeout of this.pendingFiles.values()) {
      clearTimeout(timeout);
    }
    this.pendingFiles.clear();
  }

  private handleFileAdded(filePath: string): void {
    // Debounce to handle write completion
    const existing = this.pendingFiles.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(async () => {
      this.pendingFiles.delete(filePath);
      await this.processFile(filePath);
    }, this.options.debounceMs);

    this.pendingFiles.set(filePath, timeout);
  }

  // #15: Handle file change events
  private handleFileChanged(filePath: string): void {
    const existing = this.pendingFiles.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(async () => {
      this.pendingFiles.delete(filePath);
      await this.processChangedFile(filePath);
    }, this.options.debounceMs);

    this.pendingFiles.set(filePath, timeout);
  }

  private async processFile(filePath: string): Promise<void> {
    try {
      // Analyze file
      const analysis = await this.analyzer.analyze(filePath);
      this.emit('file', analysis);

      // Generate suggestion
      const suggestion = this.suggester.generateSuggestion(analysis);

      if (!suggestion) {
        this.emit('skipped', analysis, 'No matching rule');
        return;
      }

      // Check confidence threshold
      if (suggestion.confidence < this.options.minConfidence!) {
        this.emit('skipped', analysis, `Low confidence: ${Math.round(suggestion.confidence * 100)}%`);
        return;
      }

      // Check if auto mode or needs confirmation
      if (this.options.auto && !suggestion.requiresConfirmation) {
        // Execute automatically
        const result = await this.executor.execute(suggestion);

        if (result.success) {
          this.emit('organized', analysis, suggestion.destination);
        } else {
          this.emit('error', new Error(result.error || 'Execution failed'));
        }
      } else {
        // Just emit the suggestion for manual handling
        this.emit('skipped', analysis, 'Requires confirmation');
      }
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  // #15: Process changed files - re-analyze and re-suggest
  private async processChangedFile(filePath: string): Promise<void> {
    try {
      const analysis = await this.analyzer.analyze(filePath);
      this.emit('changed', analysis);

      // Re-evaluate rules for changed file
      if (this.options.auto) {
        const suggestion = this.suggester.generateSuggestion(analysis);

        if (suggestion && suggestion.confidence >= this.options.minConfidence! && !suggestion.requiresConfirmation) {
          const result = await this.executor.execute(suggestion);
          if (result.success) {
            this.emit('organized', analysis, suggestion.destination);
          } else {
            this.emit('error', new Error(result.error || 'Execution failed'));
          }
        }
      }
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  isWatching(): boolean {
    return this.watcher !== null;
  }

  getWatchedPaths(): string[] {
    if (!this.watcher) {
      return [];
    }

    const watched = this.watcher.getWatched();
    return Object.keys(watched);
  }

  addPath(path: string): void {
    if (this.watcher) {
      this.watcher.add(path);
    }
  }

  removePath(path: string): void {
    if (this.watcher) {
      this.watcher.unwatch(path);
    }
  }

  // Type-safe event emitter methods
  override on<K extends keyof WatcherEvents>(
    event: K,
    listener: WatcherEvents[K]
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof WatcherEvents>(
    event: K,
    ...args: Parameters<WatcherEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

export async function watchMultiple(
  paths: string[],
  db: Database,
  config: Config,
  modelsDir: string,
  options: WatcherOptions = {}
): Promise<Watcher> {
  const watcher = new Watcher(db, config, modelsDir);

  // Start with first path
  if (paths.length > 0) {
    await watcher.start(paths[0], options);

    // Add additional paths
    for (let i = 1; i < paths.length; i++) {
      watcher.addPath(paths[i]);
    }
  }

  return watcher;
}
