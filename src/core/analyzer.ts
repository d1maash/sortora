import { stat } from 'fs/promises';
import { basename, extname } from 'path';
import { getMimeType, getFileCategory, type FileCategory } from '../utils/mime.js';
import { hashFileQuick } from '../utils/file-hash.js';
import { analyzeByType, type FileMetadata } from '../analyzers/index.js';
import { EmbeddingService } from '../ai/embeddings.js';
import { ClassifierService } from '../ai/classifier.js';
import type { ScanResult } from './scanner.js';

export interface FileAnalysis {
  path: string;
  filename: string;
  extension: string;
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  mimeType: string | null;
  category: FileCategory;
  hash?: string;
  metadata?: FileMetadata;
  textContent?: string;
  embedding?: number[];
  aiCategory?: string;
  aiConfidence?: number;
}

export class Analyzer {
  private modelsDir: string;
  private aiEnabled = false;
  private embeddingService: EmbeddingService | null = null;
  private classifierService: ClassifierService | null = null;

  constructor(modelsDir: string) {
    this.modelsDir = modelsDir;
  }

  async enableAI(): Promise<void> {
    if (this.aiEnabled) return;

    this.embeddingService = new EmbeddingService(this.modelsDir);
    this.classifierService = new ClassifierService(this.modelsDir);

    // Initialize both services
    await Promise.all([
      this.embeddingService.init(),
      this.classifierService.init(),
    ]);

    this.aiEnabled = true;
  }

  isAIEnabled(): boolean {
    return this.aiEnabled;
  }

  async analyze(filePath: string, useAI = false): Promise<FileAnalysis> {
    const filename = basename(filePath);
    const ext = extname(filename).toLowerCase().slice(1);
    const mimeType = getMimeType(filename);
    const category = getFileCategory(filename, mimeType || undefined);

    const stats = await stat(filePath);

    const analysis: FileAnalysis = {
      path: filePath,
      filename,
      extension: ext,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      mimeType,
      category,
    };

    // Compute hash
    try {
      analysis.hash = await hashFileQuick(filePath);
    } catch {
      // Hash computation failed
    }

    // Type-specific analysis
    try {
      const typeAnalysis = await analyzeByType(filePath, filename, mimeType || undefined);
      analysis.metadata = typeAnalysis.metadata;
      analysis.textContent = typeAnalysis.textContent;

      // Update category if analyzer determined a more specific one
      if (typeAnalysis.category !== 'other') {
        analysis.category = typeAnalysis.category;
      }
    } catch {
      // Type-specific analysis failed
    }

    // AI classification if enabled
    if (useAI && this.aiEnabled && this.classifierService) {
      try {
        const aiResult = await this.classifierService.classifyFile({
          filename: analysis.filename,
          content: analysis.textContent,
          metadata: analysis.metadata as Record<string, unknown> | undefined,
        });
        analysis.aiCategory = aiResult.category;
        analysis.aiConfidence = aiResult.confidence;
      } catch {
        // AI classification failed
      }
    }

    // Generate embedding if AI enabled
    if (useAI && this.aiEnabled && this.embeddingService && analysis.textContent) {
      try {
        const text = `${analysis.filename} ${analysis.textContent.slice(0, 1000)}`;
        analysis.embedding = await this.embeddingService.embed(text);
      } catch {
        // Embedding generation failed
      }
    }

    return analysis;
  }

  async analyzeMany(
    files: ScanResult[],
    options: { parallel?: number; useAI?: boolean } = {}
  ): Promise<FileAnalysis[]> {
    const { parallel = 5, useAI = false } = options;
    const results: FileAnalysis[] = [];

    // Process in batches for better performance
    for (let i = 0; i < files.length; i += parallel) {
      const batch = files.slice(i, i + parallel);
      const batchResults = await Promise.all(
        batch.map(file => this.analyzeFromScanResult(file, useAI))
      );
      results.push(...batchResults);
    }

    return results;
  }

  private async analyzeFromScanResult(scanResult: ScanResult, useAI = false): Promise<FileAnalysis> {
    const category = getFileCategory(scanResult.filename, scanResult.mimeType || undefined);

    const analysis: FileAnalysis = {
      path: scanResult.path,
      filename: scanResult.filename,
      extension: scanResult.extension,
      size: scanResult.size,
      created: scanResult.created,
      modified: scanResult.modified,
      accessed: scanResult.accessed,
      mimeType: scanResult.mimeType,
      category,
    };

    // Compute hash
    try {
      analysis.hash = await hashFileQuick(scanResult.path);
    } catch {
      // Hash computation failed
    }

    // Type-specific analysis
    try {
      const typeAnalysis = await analyzeByType(
        scanResult.path,
        scanResult.filename,
        scanResult.mimeType || undefined
      );
      analysis.metadata = typeAnalysis.metadata;
      analysis.textContent = typeAnalysis.textContent;
    } catch {
      // Type-specific analysis failed
    }

    // AI classification if enabled
    if (useAI && this.aiEnabled && this.classifierService) {
      try {
        const aiResult = await this.classifierService.classifyFile({
          filename: analysis.filename,
          content: analysis.textContent,
          metadata: analysis.metadata as Record<string, unknown> | undefined,
        });
        analysis.aiCategory = aiResult.category;
        analysis.aiConfidence = aiResult.confidence;
      } catch {
        // AI classification failed
      }
    }

    return analysis;
  }

  async classifyWithAI(analysis: FileAnalysis): Promise<{
    category: string;
    confidence: number;
  }> {
    if (!this.aiEnabled || !this.classifierService) {
      return {
        category: analysis.category,
        confidence: 0.5,
      };
    }

    try {
      return await this.classifierService.classifyFile({
        filename: analysis.filename,
        content: analysis.textContent,
        metadata: analysis.metadata as Record<string, unknown> | undefined,
      });
    } catch {
      return {
        category: analysis.category,
        confidence: 0.5,
      };
    }
  }

  async getEmbedding(analysis: FileAnalysis): Promise<number[] | null> {
    if (!this.aiEnabled || !this.embeddingService) {
      return null;
    }

    try {
      const text = `${analysis.filename} ${(analysis.textContent || '').slice(0, 1000)}`;
      return await this.embeddingService.embed(text);
    } catch {
      return null;
    }
  }

  async findSimilar(
    analysis: FileAnalysis,
    candidates: FileAnalysis[],
    threshold = 0.7
  ): Promise<{ file: FileAnalysis; similarity: number }[]> {
    if (!this.aiEnabled || !this.embeddingService) {
      return [];
    }

    const sourceEmbedding = analysis.embedding || await this.getEmbedding(analysis);
    if (!sourceEmbedding) return [];

    const results: { file: FileAnalysis; similarity: number }[] = [];

    for (const candidate of candidates) {
      if (candidate.path === analysis.path) continue;

      const candidateEmbedding = candidate.embedding || await this.getEmbedding(candidate);
      if (!candidateEmbedding) continue;

      const similarity = this.embeddingService.cosineSimilarity(sourceEmbedding, candidateEmbedding);
      if (similarity >= threshold) {
        results.push({ file: candidate, similarity });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }

  extractKeywords(analysis: FileAnalysis): string[] {
    const keywords: string[] = [];

    // From filename
    const words = analysis.filename
      .replace(/[._-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
    keywords.push(...words);

    // From metadata
    if (analysis.metadata) {
      const meta = analysis.metadata as Record<string, unknown>;

      if (meta.title && typeof meta.title === 'string') {
        keywords.push(...meta.title.split(/\s+/));
      }
      if (meta.artist && typeof meta.artist === 'string') {
        keywords.push(meta.artist);
      }
      if (meta.author && typeof meta.author === 'string') {
        keywords.push(meta.author);
      }
    }

    // Deduplicate and lowercase
    return [...new Set(keywords.map(k => k.toLowerCase()))];
  }

  getYear(analysis: FileAnalysis): number | null {
    // Try to extract year from metadata
    if (analysis.metadata) {
      const meta = analysis.metadata as Record<string, unknown>;

      if (meta.dateTaken instanceof Date) {
        return meta.dateTaken.getFullYear();
      }
      if (meta.year && typeof meta.year === 'number') {
        return meta.year;
      }
      if (meta.creationDate instanceof Date) {
        return meta.creationDate.getFullYear();
      }
    }

    // Try from filename
    const yearMatch = analysis.filename.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      return parseInt(yearMatch[0]);
    }

    // Fall back to file modification date
    return analysis.modified.getFullYear();
  }

  getMonth(analysis: FileAnalysis): number | null {
    // Try to extract month from metadata
    if (analysis.metadata) {
      const meta = analysis.metadata as Record<string, unknown>;

      if (meta.dateTaken instanceof Date) {
        return meta.dateTaken.getMonth() + 1;
      }
    }

    // Fall back to file modification date
    return analysis.modified.getMonth() + 1;
  }
}
