import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { EmbeddingService } from './embeddings.js';
import { ClassifierService } from './classifier.js';
import { OCRService } from './ocr.js';

export interface ModelStatus {
  embeddings: { loaded: boolean; size: string };
  classifier: { loaded: boolean; size: string };
  ocr: { loaded: boolean; languages: string[]; size: string };
}

export interface ModelManagerOptions {
  embeddings?: boolean;
  classifier?: boolean;
  ocr?: boolean;
  ocrLanguages?: string[];
}

export class ModelManager {
  private modelsDir: string;
  private embeddingService: EmbeddingService | null = null;
  private classifierService: ClassifierService | null = null;
  private ocrService: OCRService | null = null;
  private initialized = false;

  constructor(modelsDir: string) {
    this.modelsDir = modelsDir;

    if (!existsSync(modelsDir)) {
      mkdirSync(modelsDir, { recursive: true });
    }
  }

  async setup(options: ModelManagerOptions = {}): Promise<void> {
    const {
      embeddings = true,
      classifier = true,
      ocr = true,
      ocrLanguages = ['eng'],
    } = options;

    const tasks: Promise<void>[] = [];

    if (embeddings) {
      tasks.push(this.loadEmbeddings());
    }

    if (classifier) {
      tasks.push(this.loadClassifier());
    }

    if (ocr) {
      tasks.push(this.loadOCR(ocrLanguages));
    }

    await Promise.all(tasks);
    this.initialized = true;
  }

  async loadEmbeddings(): Promise<void> {
    if (this.embeddingService) return;

    this.embeddingService = new EmbeddingService(this.modelsDir);
    await this.embeddingService.init();
  }

  async loadClassifier(): Promise<void> {
    if (this.classifierService) return;

    this.classifierService = new ClassifierService(this.modelsDir);
    await this.classifierService.init();
  }

  async loadOCR(languages: string[] = ['eng']): Promise<void> {
    if (this.ocrService) return;

    this.ocrService = new OCRService(this.modelsDir);
    await this.ocrService.init(languages);
  }

  getEmbeddingService(): EmbeddingService | null {
    return this.embeddingService;
  }

  getClassifierService(): ClassifierService | null {
    return this.classifierService;
  }

  getOCRService(): OCRService | null {
    return this.ocrService;
  }

  isReady(): boolean {
    return this.initialized;
  }

  hasEmbeddings(): boolean {
    return this.embeddingService !== null;
  }

  hasClassifier(): boolean {
    return this.classifierService !== null;
  }

  hasOCR(): boolean {
    return this.ocrService !== null;
  }

  async getStatus(): Promise<ModelStatus> {
    return {
      embeddings: {
        loaded: this.hasEmbeddings(),
        size: '~23 MB',
      },
      classifier: {
        loaded: this.hasClassifier(),
        size: '~25 MB',
      },
      ocr: {
        loaded: this.hasOCR(),
        languages: this.ocrService?.getLanguages() || [],
        size: '~15-40 MB',
      },
    };
  }

  async terminate(): Promise<void> {
    if (this.ocrService) {
      await this.ocrService.terminate();
    }

    this.embeddingService = null;
    this.classifierService = null;
    this.ocrService = null;
    this.initialized = false;
  }

  getModelsDir(): string {
    return this.modelsDir;
  }

  static getRequiredDiskSpace(options: ModelManagerOptions): number {
    let total = 0;

    if (options.embeddings !== false) {
      total += 23 * 1024 * 1024; // ~23 MB
    }

    if (options.classifier !== false) {
      total += 25 * 1024 * 1024; // ~25 MB
    }

    if (options.ocr !== false) {
      const languages = options.ocrLanguages || ['eng'];
      // Base OCR engine + language data
      total += 10 * 1024 * 1024; // ~10 MB for engine
      total += languages.length * 15 * 1024 * 1024; // ~15 MB per language
    }

    return total;
  }
}

export default ModelManager;
