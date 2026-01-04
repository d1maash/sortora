import { pipeline, type ZeroShotClassificationPipeline } from '@xenova/transformers';

export const FILE_CATEGORIES = [
  // Documents
  'work document',
  'personal document',
  'financial document',
  'resume or CV',
  'contract or legal',
  'invoice or receipt',
  'report or presentation',
  'ebook or reading material',

  // Media
  'photo or image',
  'screenshot',
  'meme or funny image',
  'design or artwork',
  'music or audio',
  'video',
  'podcast or recording',

  // Technical
  'code or programming',
  'configuration file',
  'database or data file',
  'log file',

  // Downloads
  'download or installer',
  'archive or backup',
  'torrent or incomplete',

  // Other
  'temporary or junk',
  'unknown or other',
] as const;

export type FileCategory = typeof FILE_CATEGORIES[number];

export interface ClassificationResult {
  label: string;
  score: number;
}

export class ClassifierService {
  private model: ZeroShotClassificationPipeline | null = null;
  private modelsDir: string;
  private modelName = 'Xenova/mobilebert-uncased-mnli';
  private initialized = false;

  constructor(modelsDir: string) {
    this.modelsDir = modelsDir;
  }

  async init(): Promise<void> {
    if (this.model) return;

    this.model = await pipeline('zero-shot-classification', this.modelName, {
      quantized: true,
      cache_dir: this.modelsDir,
    });

    this.initialized = true;
  }

  isReady(): boolean {
    return this.initialized && this.model !== null;
  }

  async classify(
    content: string,
    categories: string[] = [...FILE_CATEGORIES]
  ): Promise<ClassificationResult[]> {
    if (!this.model) {
      await this.init();
    }

    const result = await this.model!(content, categories, {
      multi_label: false,
    });

    // Handle both single result and array result
    const output = Array.isArray(result) ? result[0] : result;

    return output.labels.map((label: string, i: number) => ({
      label,
      score: output.scores[i],
    }));
  }

  async classifyFile(fileInfo: {
    filename: string;
    content?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ category: string; confidence: number }> {
    // Build context for classification
    const contextParts: string[] = [];

    contextParts.push(`filename: ${fileInfo.filename}`);

    if (fileInfo.content) {
      // Use first 500 chars of content
      const contentPreview = fileInfo.content.slice(0, 500);
      contextParts.push(`content: ${contentPreview}`);
    }

    if (fileInfo.metadata) {
      const metaStr = Object.entries(fileInfo.metadata)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}: ${v}`)
        .slice(0, 5)
        .join(', ');

      if (metaStr) {
        contextParts.push(`metadata: ${metaStr}`);
      }
    }

    const context = contextParts.join('\n');
    const results = await this.classify(context);

    return {
      category: results[0].label,
      confidence: results[0].score,
    };
  }

  async classifyBatch(
    items: { filename: string; content?: string }[]
  ): Promise<{ category: string; confidence: number }[]> {
    const results: { category: string; confidence: number }[] = [];

    for (const item of items) {
      const result = await this.classifyFile(item);
      results.push(result);
    }

    return results;
  }

  async suggestCategory(
    filename: string,
    existingCategory: string
  ): Promise<{ suggested: string; confidence: number; shouldChange: boolean }> {
    const result = await this.classifyFile({ filename });

    // Only suggest change if confidence is high and different
    const shouldChange =
      result.category !== existingCategory &&
      result.confidence > 0.8;

    return {
      suggested: result.category,
      confidence: result.confidence,
      shouldChange,
    };
  }

  getAvailableCategories(): readonly string[] {
    return FILE_CATEGORIES;
  }
}

export default ClassifierService;
