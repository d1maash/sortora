import { stat } from 'fs/promises';
import { basename, extname } from 'path';
import { getMimeType, getFileCategory, type FileCategory } from '../utils/mime.js';
import { hashFileQuick } from '../utils/file-hash.js';
import { analyzeByType, type FileMetadata } from '../analyzers/index.js';
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
  private aiEnabled = false;

  constructor(_modelsDir: string) {
    // modelsDir will be used when AI is fully implemented
  }

  async enableAI(): Promise<void> {
    // AI models would be initialized here
    this.aiEnabled = true;
  }

  async analyze(filePath: string): Promise<FileAnalysis> {
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

    return analysis;
  }

  async analyzeMany(
    files: ScanResult[],
    options: { parallel?: number } = {}
  ): Promise<FileAnalysis[]> {
    const { parallel = 5 } = options;
    const results: FileAnalysis[] = [];

    // Process in batches for better performance
    for (let i = 0; i < files.length; i += parallel) {
      const batch = files.slice(i, i + parallel);
      const batchResults = await Promise.all(
        batch.map(file => this.analyzeFromScanResult(file))
      );
      results.push(...batchResults);
    }

    return results;
  }

  private async analyzeFromScanResult(scanResult: ScanResult): Promise<FileAnalysis> {
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

    return analysis;
  }

  async classifyWithAI(analysis: FileAnalysis): Promise<{
    category: string;
    confidence: number;
  }> {
    if (!this.aiEnabled) {
      return {
        category: analysis.category,
        confidence: 0.5,
      };
    }

    // This would use the AI classifier
    // For now, return basic classification
    return {
      category: analysis.category,
      confidence: 0.7,
    };
  }

  async getEmbedding(_analysis: FileAnalysis): Promise<number[] | null> {
    if (!this.aiEnabled) {
      return null;
    }

    // This would generate embeddings using MiniLM
    // For now, return null
    return null;
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
