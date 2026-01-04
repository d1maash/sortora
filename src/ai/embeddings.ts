import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

export class EmbeddingService {
  private model: FeatureExtractionPipeline | null = null;
  private modelsDir: string;
  private modelName = 'Xenova/all-MiniLM-L6-v2';
  private initialized = false;

  constructor(modelsDir: string) {
    this.modelsDir = modelsDir;
  }

  async init(): Promise<void> {
    if (this.model) return;

    this.model = await pipeline('feature-extraction', this.modelName, {
      quantized: true,
      cache_dir: this.modelsDir,
    });

    this.initialized = true;
  }

  isReady(): boolean {
    return this.initialized && this.model !== null;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.model) {
      await this.init();
    }

    const output = await this.model!(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data as Float32Array);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      const embedding = await this.embed(text);
      embeddings.push(embedding);
    }

    return embeddings;
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
