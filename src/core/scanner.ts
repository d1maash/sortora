import { stat } from 'fs/promises';
import { basename, extname } from 'path';
import { listDirectory } from '../utils/fs-safe.js';
import { getMimeType } from '../utils/mime.js';
import { hashFileQuick } from '../utils/file-hash.js';
import { Database } from '../storage/database.js';
import { createLogger } from '../utils/logger.js';
import type { FileAnalysis } from './analyzer.js';

const logger = createLogger('scanner');

export interface ScanOptions {
  recursive?: boolean;
  includeHidden?: boolean;
  findDuplicates?: boolean;
  extensions?: string[];
  excludePatterns?: string[];
  maxDepth?: number;
  /** Enable incremental scanning - only scan files modified since last scan */
  incremental?: boolean;
  /** Callback for progress reporting */
  onProgress?: (scanned: number, total: number, currentFile: string) => void;
}

export interface ScanResult {
  path: string;
  filename: string;
  extension: string;
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  mimeType: string | null;
}

export interface ScanStats {
  totalFiles: number;
  scannedFiles: number;
  skippedFiles: number;
  newFiles: number;
  modifiedFiles: number;
  unchangedFiles: number;
  errors: number;
  duration: number;
}

export class Scanner {
  private db: Database;
  private scanCache = new Map<string, { mtime: number; result: ScanResult }>();

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Clear the scan cache
   */
  clearCache(): void {
    this.scanCache.clear();
  }

  async scan(dirPath: string, options: ScanOptions = {}): Promise<ScanResult[]> {
    const {
      recursive = false,
      includeHidden = false,
      extensions,
      excludePatterns = [],
      incremental = false,
      onProgress,
    } = options;

    const startTime = Date.now();
    logger.info(`Starting scan of ${dirPath} (recursive: ${recursive}, incremental: ${incremental})`);

    const files = await listDirectory(dirPath, {
      recursive,
      includeHidden,
    });

    const results: ScanResult[] = [];
    let scanned = 0;
    let skipped = 0;
    let errors = 0;

    for (const filePath of files) {
      const filename = basename(filePath);

      // Check exclusion patterns
      if (excludePatterns.some(p => this.matchPattern(filename, p))) {
        skipped++;
        continue;
      }

      // Check extension filter
      const ext = extname(filename).toLowerCase().slice(1);
      if (extensions && extensions.length > 0 && !extensions.includes(ext)) {
        skipped++;
        continue;
      }

      try {
        const stats = await stat(filePath);

        if (!stats.isFile()) {
          continue;
        }

        // Incremental scanning: check if file was modified since last scan
        if (incremental) {
          const cached = this.scanCache.get(filePath);
          if (cached && cached.mtime === stats.mtime.getTime()) {
            results.push(cached.result);
            scanned++;
            continue;
          }
        }

        const result: ScanResult = {
          path: filePath,
          filename,
          extension: ext,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          accessed: stats.atime,
          mimeType: getMimeType(filename),
        };

        results.push(result);

        // Update cache for incremental scanning
        this.scanCache.set(filePath, {
          mtime: stats.mtime.getTime(),
          result,
        });

        scanned++;

        // Report progress
        if (onProgress) {
          onProgress(scanned, files.length, filePath);
        }
      } catch (error) {
        // Log the error instead of silently skipping
        logger.warn(`Failed to access file: ${filePath}`, error instanceof Error ? error.message : error);
        errors++;
        continue;
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`Scan complete: ${scanned} files scanned, ${skipped} skipped, ${errors} errors in ${duration}ms`);

    return results;
  }

  /**
   * Scan with detailed statistics
   */
  async scanWithStats(dirPath: string, options: ScanOptions = {}): Promise<{ results: ScanResult[]; stats: ScanStats }> {
    const startTime = Date.now();
    const stats: ScanStats = {
      totalFiles: 0,
      scannedFiles: 0,
      skippedFiles: 0,
      newFiles: 0,
      modifiedFiles: 0,
      unchangedFiles: 0,
      errors: 0,
      duration: 0,
    };

    const {
      recursive = false,
      includeHidden = false,
      extensions,
      excludePatterns = [],
      incremental = false,
      onProgress,
    } = options;

    const files = await listDirectory(dirPath, {
      recursive,
      includeHidden,
    });

    stats.totalFiles = files.length;
    const results: ScanResult[] = [];

    for (const filePath of files) {
      const filename = basename(filePath);

      // Check exclusion patterns
      if (excludePatterns.some(p => this.matchPattern(filename, p))) {
        stats.skippedFiles++;
        continue;
      }

      // Check extension filter
      const ext = extname(filename).toLowerCase().slice(1);
      if (extensions && extensions.length > 0 && !extensions.includes(ext)) {
        stats.skippedFiles++;
        continue;
      }

      try {
        const fileStats = await stat(filePath);

        if (!fileStats.isFile()) {
          continue;
        }

        // Check database for existing record
        const existingRecord = this.db.getFile(filePath);

        // Incremental scanning
        if (incremental) {
          const cached = this.scanCache.get(filePath);
          if (cached && cached.mtime === fileStats.mtime.getTime()) {
            results.push(cached.result);
            stats.unchangedFiles++;
            stats.scannedFiles++;
            continue;
          }
        }

        const result: ScanResult = {
          path: filePath,
          filename,
          extension: ext,
          size: fileStats.size,
          created: fileStats.birthtime,
          modified: fileStats.mtime,
          accessed: fileStats.atime,
          mimeType: getMimeType(filename),
        };

        results.push(result);
        this.scanCache.set(filePath, { mtime: fileStats.mtime.getTime(), result });

        // Track new vs modified
        if (!existingRecord) {
          stats.newFiles++;
        } else if (existingRecord.modifiedAt !== fileStats.mtime.getTime()) {
          stats.modifiedFiles++;
        } else {
          stats.unchangedFiles++;
        }

        stats.scannedFiles++;

        if (onProgress) {
          onProgress(stats.scannedFiles, stats.totalFiles, filePath);
        }
      } catch (error) {
        logger.warn(`Failed to access file: ${filePath}`, error instanceof Error ? error.message : error);
        stats.errors++;
        continue;
      }
    }

    stats.duration = Date.now() - startTime;
    return { results, stats };
  }

  async scanWithHashes(
    dirPath: string,
    options: ScanOptions = {}
  ): Promise<(ScanResult & { hash: string })[]> {
    const files = await this.scan(dirPath, options);
    const results: (ScanResult & { hash: string })[] = [];

    for (const file of files) {
      try {
        const hash = await hashFileQuick(file.path);
        results.push({ ...file, hash });
      } catch (error) {
        // Log error and skip files that can't be hashed
        logger.warn(`Failed to hash file: ${file.path}`, error instanceof Error ? error.message : error);
        continue;
      }
    }

    return results;
  }

  findDuplicates(files: FileAnalysis[]): { hash: string; files: FileAnalysis[] }[] {
    const hashGroups = new Map<string, FileAnalysis[]>();

    for (const file of files) {
      if (!file.hash) continue;

      const existing = hashGroups.get(file.hash) || [];
      existing.push(file);
      hashGroups.set(file.hash, existing);
    }

    const duplicates: { hash: string; files: FileAnalysis[] }[] = [];

    for (const [hash, group] of hashGroups) {
      if (group.length > 1) {
        duplicates.push({ hash, files: group });
      }
    }

    // Sort by size descending (larger duplicates first)
    duplicates.sort((a, b) => {
      const sizeA = a.files[0]?.size || 0;
      const sizeB = b.files[0]?.size || 0;
      return sizeB - sizeA;
    });

    return duplicates;
  }

  async findSimilar(
    targetFile: FileAnalysis,
    files: FileAnalysis[],
    threshold = 0.8
  ): Promise<FileAnalysis[]> {
    // This would use embeddings for similarity search
    // For now, use simple heuristics

    const similar: FileAnalysis[] = [];

    for (const file of files) {
      if (file.path === targetFile.path) continue;

      let score = 0;

      // Same category
      if (file.category === targetFile.category) {
        score += 0.3;
      }

      // Same extension
      if (file.extension === targetFile.extension) {
        score += 0.2;
      }

      // Similar size (within 20%)
      const sizeDiff = Math.abs(file.size - targetFile.size) / Math.max(file.size, targetFile.size);
      if (sizeDiff < 0.2) {
        score += 0.2 * (1 - sizeDiff);
      }

      // Similar filename
      const nameSimilarity = this.stringSimilarity(
        file.filename.toLowerCase(),
        targetFile.filename.toLowerCase()
      );
      score += nameSimilarity * 0.3;

      if (score >= threshold) {
        similar.push(file);
      }
    }

    return similar;
  }

  private matchPattern(filename: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${regex}$`, 'i').test(filename);
  }

  private stringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0 && len2 === 0) return 1;
    if (len1 === 0 || len2 === 0) return 0;

    // Simple Levenshtein-based similarity
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return 1 - matrix[len1][len2] / maxLen;
  }
}
