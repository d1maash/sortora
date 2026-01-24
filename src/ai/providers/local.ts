/**
 * Local Provider
 * Wraps the existing local classifier (MobileBERT via @xenova/transformers)
 */

import type {
  AIProvider,
  ClassificationRequest,
  ClassificationResult,
  ProviderConfig,
} from './types.js';
import { ClassifierService } from '../classifier.js';

export interface LocalConfig extends ProviderConfig {
  type: 'local';
  modelsDir: string;
}

export class LocalProvider implements AIProvider {
  readonly name = 'Local (MobileBERT)';
  readonly type = 'local' as const;

  private modelsDir: string;
  private classifier: ClassifierService | null = null;
  private initialized = false;

  constructor(config: LocalConfig) {
    this.modelsDir = config.modelsDir;
  }

  isReady(): boolean {
    return this.initialized && this.classifier !== null;
  }

  async init(): Promise<void> {
    this.classifier = new ClassifierService(this.modelsDir);
    await this.classifier.init();
    this.initialized = true;
  }

  async classifyFile(request: ClassificationRequest): Promise<ClassificationResult> {
    if (!this.classifier) {
      throw new Error('Local provider is not initialized');
    }

    const result = await this.classifier.classifyFile({
      filename: request.filename,
      content: request.content,
      metadata: request.metadata,
    });

    return {
      category: result.category,
      confidence: result.confidence,
    };
  }

  async classifyBatch(requests: ClassificationRequest[]): Promise<ClassificationResult[]> {
    if (!this.classifier) {
      throw new Error('Local provider is not initialized');
    }

    const results: ClassificationResult[] = [];

    for (const request of requests) {
      const result = await this.classifyFile(request);
      results.push(result);
    }

    return results;
  }

  async dispose(): Promise<void> {
    this.classifier = null;
    this.initialized = false;
  }
}
