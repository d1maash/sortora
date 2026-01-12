import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('embeddings');

export class EmbeddingService {
  private model: FeatureExtractionPipeline | null = null;
  private modelsDir: string;
  private modelName = 'Xenova/all-MiniLM-L6-v2';
  private initialized = false;
  private lastUsed = 0;
  private unloadTimer: NodeJS.Timeout | null = null;
  private readonly unloadTimeout: number;

  constructor(modelsDir: string, options: { unloadTimeout?: number } = {}) {
    this.modelsDir = modelsDir;
    // Default: unload model after 5 minutes of inactivity
    this.unloadTimeout = options.unloadTimeout ?? 5 * 60 * 1000;
  }

  async init(): Promise<void> {
    if (this.model) return;

    logger.info('Loading embedding model...');
    const startTime = Date.now();

    this.model = await pipeline('feature-extraction', this.modelName, {
      quantized: true,
      cache_dir: this.modelsDir,
    });

    this.initialized = true;
    this.lastUsed = Date.now();
    logger.info(`Embedding model loaded in ${Date.now() - startTime}ms`);

    this.scheduleUnload();
  }

  /**
   * Schedule model unload after inactivity period
   */
  private scheduleUnload(): void {
    if (this.unloadTimer) {
      clearTimeout(this.unloadTimer);
    }

    if (this.unloadTimeout > 0) {
      this.unloadTimer = setTimeout(() => {
        this.unload();
      }, this.unloadTimeout);
    }
  }

  /**
   * Unload the model from memory
   */
  unload(): void {
    if (this.model) {
      logger.info('Unloading embedding model from memory');
      this.model = null;
      this.initialized = false;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }

    if (this.unloadTimer) {
      clearTimeout(this.unloadTimer);
      this.unloadTimer = null;
    }
  }

  isReady(): boolean {
    return this.initialized && this.model !== null;
  }

  /**
   * Get memory usage estimate
   */
  getMemoryUsage(): { loaded: boolean; estimatedMB: number } {
    return {
      loaded: this.model !== null,
      estimatedMB: this.model ? 90 : 0, // MiniLM-L6-v2 uses ~90MB
    };
  }

  async embed(text: string): Promise<number[]> {
    if (!this.model) {
      await this.init();
    }

    this.lastUsed = Date.now();
    this.scheduleUnload();

    const output = await this.model!(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data as Float32Array);
  }

  /**
   * Embed multiple texts efficiently in batches
   */
  async embedBatch(texts: string[], options: { batchSize?: number; onProgress?: (done: number, total: number) => void } = {}): Promise<number[][]> {
    const { batchSize = 32, onProgress } = options;

    if (!this.model) {
      await this.init();
    }

    this.lastUsed = Date.now();
    this.scheduleUnload();

    const embeddings: number[][] = [];
    const totalTexts = texts.length;

    // Process in batches for better performance
    for (let i = 0; i < totalTexts; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (text) => {
          const output = await this.model!(text, {
            pooling: 'mean',
            normalize: true,
          });
          return Array.from(output.data as Float32Array);
        })
      );

      embeddings.push(...batchResults);

      if (onProgress) {
        onProgress(Math.min(i + batchSize, totalTexts), totalTexts);
      }
    }

    return embeddings;
  }

  /**
   * Compute embeddings for multiple texts and return similarity matrix
   */
  async computeSimilarityMatrix(texts: string[]): Promise<number[][]> {
    const embeddings = await this.embedBatch(texts);
    const n = embeddings.length;
    const matrix: number[][] = [];

    for (let i = 0; i < n; i++) {
      matrix[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else if (j < i) {
          matrix[i][j] = matrix[j][i]; // Symmetric
        } else {
          matrix[i][j] = this.cosineSimilarity(embeddings[i], embeddings[j]);
        }
      }
    }

    return matrix;
  }

  /**
   * Find most similar texts to a query
   */
  async findSimilar(
    query: string,
    candidates: string[],
    options: { topK?: number; threshold?: number } = {}
  ): Promise<{ text: string; index: number; similarity: number }[]> {
    const { topK = 10, threshold = 0 } = options;

    const queryEmbedding = await this.embed(query);
    const candidateEmbeddings = await this.embedBatch(candidates);

    const results: { text: string; index: number; similarity: number }[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const similarity = this.cosineSimilarity(queryEmbedding, candidateEmbeddings[i]);
      if (similarity >= threshold) {
        results.push({ text: candidates[i], index: i, similarity });
      }
    }

    // Sort by similarity descending and take top K
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  async similarity(text1: string, text2: string): Promise<number> {
    const [emb1, emb2] = await Promise.all([
      this.embed(text1),
      this.embed(text2),
    ]);

    return this.cosineSimilarity(emb1, emb2);
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  getDimension(): number {
    return 384; // MiniLM-L6-v2 dimension
  }

  serializeEmbedding(embedding: number[]): Buffer {
    const buffer = Buffer.alloc(embedding.length * 4);
    for (let i = 0; i < embedding.length; i++) {
      buffer.writeFloatLE(embedding[i], i * 4);
    }
    return buffer;
  }

  deserializeEmbedding(buffer: Buffer): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < buffer.length; i += 4) {
      embedding.push(buffer.readFloatLE(i));
    }
    return embedding;
  }
}

export default EmbeddingService;
