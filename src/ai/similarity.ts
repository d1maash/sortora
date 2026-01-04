import { EmbeddingService } from './embeddings.js';
import type { FileAnalysis } from '../core/analyzer.js';

export interface SimilarityResult {
  file: FileAnalysis;
  score: number;
  matchType: 'content' | 'name' | 'metadata';
}

export class SimilarityService {
  private embeddingService: EmbeddingService;
  private embeddingCache = new Map<string, number[]>();

  constructor(embeddingService: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  async findSimilar(
    target: FileAnalysis,
    candidates: FileAnalysis[],
    options: {
      threshold?: number;
      maxResults?: number;
      useContent?: boolean;
      useMetadata?: boolean;
    } = {}
  ): Promise<SimilarityResult[]> {
    const {
      threshold = 0.7,
      maxResults = 10,
      useContent = true,
      useMetadata = true,
    } = options;

    const results: SimilarityResult[] = [];

    // Get target embedding
    const targetText = this.buildFileText(target, useContent, useMetadata);
    const targetEmbedding = await this.getEmbedding(target.path, targetText);

    // Compare with candidates
    for (const candidate of candidates) {
      if (candidate.path === target.path) continue;

      const candidateText = this.buildFileText(candidate, useContent, useMetadata);
      const candidateEmbedding = await this.getEmbedding(candidate.path, candidateText);

      const score = this.embeddingService.cosineSimilarity(
        targetEmbedding,
        candidateEmbedding
      );

      if (score >= threshold) {
        results.push({
          file: candidate,
          score,
          matchType: this.determineMatchType(target, candidate, score),
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, maxResults);
  }

  async findDuplicatesByContent(
    files: FileAnalysis[],
    threshold = 0.95
  ): Promise<{ group: FileAnalysis[]; similarity: number }[]> {
    const groups: { group: FileAnalysis[]; similarity: number }[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      const target = files[i];

      if (processed.has(target.path)) continue;

      const group: FileAnalysis[] = [target];
      let minSimilarity = 1;

      for (let j = i + 1; j < files.length; j++) {
        const candidate = files[j];

        if (processed.has(candidate.path)) continue;

        // Quick check: same size
        if (Math.abs(target.size - candidate.size) / target.size > 0.1) {
          continue;
        }

        // Content similarity
        const targetText = target.textContent || target.filename;
        const candidateText = candidate.textContent || candidate.filename;

        const similarity = await this.embeddingService.similarity(
          targetText,
          candidateText
        );

        if (similarity >= threshold) {
          group.push(candidate);
          processed.add(candidate.path);
          minSimilarity = Math.min(minSimilarity, similarity);
        }
      }

      if (group.length > 1) {
        processed.add(target.path);
        groups.push({ group, similarity: minSimilarity });
      }
    }

    return groups;
  }

  async suggestFolder(
    file: FileAnalysis,
    existingFolders: { path: string; sampleFiles: FileAnalysis[] }[]
  ): Promise<{ folder: string; confidence: number }[]> {
    const suggestions: { folder: string; confidence: number }[] = [];

    const fileText = this.buildFileText(file, true, true);
    const fileEmbedding = await this.embeddingService.embed(fileText);

    for (const folder of existingFolders) {
      if (folder.sampleFiles.length === 0) continue;

      // Get average embedding for folder
      let folderEmbedding: number[] = [];
      let count = 0;

      for (const sample of folder.sampleFiles.slice(0, 5)) {
        const sampleText = this.buildFileText(sample, true, true);
        const sampleEmbedding = await this.embeddingService.embed(sampleText);

        if (folderEmbedding.length === 0) {
          folderEmbedding = [...sampleEmbedding];
        } else {
          for (let i = 0; i < folderEmbedding.length; i++) {
            folderEmbedding[i] += sampleEmbedding[i];
          }
        }
        count++;
      }

      // Average
      if (count > 0) {
        folderEmbedding = folderEmbedding.map(v => v / count);
      }

      const similarity = this.embeddingService.cosineSimilarity(
        fileEmbedding,
        folderEmbedding
      );

      if (similarity > 0.5) {
        suggestions.push({
          folder: folder.path,
          confidence: similarity,
        });
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions.slice(0, 5);
  }

  private buildFileText(
    file: FileAnalysis,
    useContent: boolean,
    useMetadata: boolean
  ): string {
    const parts: string[] = [];

    // Filename
    parts.push(file.filename.replace(/[._-]/g, ' '));

    // Category
    parts.push(file.category);

    // Content
    if (useContent && file.textContent) {
      parts.push(file.textContent.slice(0, 1000));
    }

    // Metadata
    if (useMetadata && file.metadata) {
      const meta = file.metadata as Record<string, unknown>;

      for (const key of ['title', 'artist', 'album', 'author', 'subject']) {
        if (typeof meta[key] === 'string') {
          parts.push(meta[key] as string);
        }
      }
    }

    return parts.join(' ');
  }

  private async getEmbedding(path: string, text: string): Promise<number[]> {
    const cached = this.embeddingCache.get(path);
    if (cached) return cached;

    const embedding = await this.embeddingService.embed(text);
    this.embeddingCache.set(path, embedding);

    return embedding;
  }

  private determineMatchType(
    target: FileAnalysis,
    candidate: FileAnalysis,
    score: number
  ): SimilarityResult['matchType'] {
    // Check filename similarity
    const nameSimilarity = this.stringSimilarity(
      target.filename.toLowerCase(),
      candidate.filename.toLowerCase()
    );

    if (nameSimilarity > 0.8) {
      return 'name';
    }

    // Check metadata
    if (target.metadata && candidate.metadata) {
      const targetMeta = target.metadata as Record<string, unknown>;
      const candidateMeta = candidate.metadata as Record<string, unknown>;

      let metaMatches = 0;
      for (const key of ['artist', 'album', 'author', 'title']) {
        if (targetMeta[key] && targetMeta[key] === candidateMeta[key]) {
          metaMatches++;
        }
      }

      if (metaMatches >= 2) {
        return 'metadata';
      }
    }

    return 'content';
  }

  private stringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Simple Jaccard similarity on words
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));

    let intersection = 0;
    for (const word of words1) {
      if (words2.has(word)) intersection++;
    }

    const union = words1.size + words2.size - intersection;
    return intersection / union;
  }

  clearCache(): void {
    this.embeddingCache.clear();
  }
}

export default SimilarityService;
