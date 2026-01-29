// Core exports
export { Scanner, type ScanOptions, type ScanResult } from './core/scanner.js';
export { Analyzer, type FileAnalysis } from './core/analyzer.js';
export { RuleEngine } from './core/rule-engine.js';
export { Suggester, type Suggestion } from './core/suggester.js';
export { Executor } from './core/executor.js';
export { Watcher } from './core/watcher.js';

// Storage exports
export { Database } from './storage/database.js';

// AI exports
export { ModelManager } from './ai/model-manager.js';
export { EmbeddingService } from './ai/embeddings.js';
export { ClassifierService } from './ai/classifier.js';
export { OCRService } from './ai/ocr.js';

// AI Providers exports
export {
  type AIProvider,
  type ProviderConfig,
  type ProviderType,
  type ClassificationRequest,
  type ClassificationResult,
  type ProviderManagerConfig,
  ProviderManager,
  createProvider,
  listProviders,
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  OllamaProvider,
  LocalProvider,
} from './ai/providers/index.js';

// Config exports
export {
  loadConfig,
  saveConfig,
  getAppPaths,
  expandPath,
  type Config,
  type AppPaths,
} from './config.js';

// Version - re-export from config to avoid duplication (#9)
export { VERSION } from './config.js';
