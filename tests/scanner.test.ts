import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { Scanner } from '../src/core/scanner';
import { Database } from '../src/storage/database';

describe('Scanner', () => {
  const testDir = join(tmpdir(), 'sortora-scanner-test-' + Date.now());
  const dbPath = join(testDir, 'test.db');
  let db: Database;
  let scanner: Scanner;

  beforeEach(async () => {
    mkdirSync(testDir, { recursive: true });
    db = new Database(dbPath);
    await db.init();
    scanner = new Scanner(db);
  });

  afterEach(() => {
    db.close();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('scan', () => {
    it('should scan directory and return files', async () => {
      writeFileSync(join(testDir, 'file1.txt'), 'content1');
      writeFileSync(join(testDir, 'file2.pdf'), 'content2');
      writeFileSync(join(testDir, 'file3.jpg'), 'content3');

      const results = await scanner.scan(testDir);

      expect(results.length).toBe(3);
      expect(results.map(r => r.filename).sort()).toEqual(['file1.txt', 'file2.pdf', 'file3.jpg']);
    });

    it('should filter by extensions', async () => {
      writeFileSync(join(testDir, 'file1.txt'), 'content1');
      writeFileSync(join(testDir, 'file2.pdf'), 'content2');
      writeFileSync(join(testDir, 'file3.jpg'), 'content3');

      const results = await scanner.scan(testDir, { extensions: ['txt', 'pdf'] });

      expect(results.length).toBe(2);
      expect(results.map(r => r.extension).sort()).toEqual(['pdf', 'txt']);
    });

    it('should exclude hidden files by default', async () => {
      writeFileSync(join(testDir, 'visible.txt'), 'content');
      writeFileSync(join(testDir, '.hidden.txt'), 'hidden');

      const results = await scanner.scan(testDir);

      expect(results.length).toBe(1);
      expect(results[0].filename).toBe('visible.txt');
    });

    it('should include hidden files when requested', async () => {
      writeFileSync(join(testDir, 'visible.txt'), 'content');
      writeFileSync(join(testDir, '.hidden.txt'), 'hidden');

      const results = await scanner.scan(testDir, { includeHidden: true });

      expect(results.length).toBe(2);
    });

    it('should scan recursively when requested', async () => {
      const subDir = join(testDir, 'subdir');
      mkdirSync(subDir);
      writeFileSync(join(testDir, 'file1.txt'), 'content1');
      writeFileSync(join(subDir, 'file2.txt'), 'content2');

      const results = await scanner.scan(testDir, { recursive: true });

      expect(results.length).toBe(2);
    });

    it('should not scan recursively by default', async () => {
      const subDir = join(testDir, 'subdir');
      mkdirSync(subDir);
      writeFileSync(join(testDir, 'file1.txt'), 'content1');
      writeFileSync(join(subDir, 'file2.txt'), 'content2');

      const results = await scanner.scan(testDir, { recursive: false });

      expect(results.length).toBe(1);
      expect(results[0].filename).toBe('file1.txt');
    });

    it('should exclude files matching patterns', async () => {
      writeFileSync(join(testDir, 'file1.txt'), 'content1');
      writeFileSync(join(testDir, 'file2.tmp'), 'content2');
      writeFileSync(join(testDir, 'backup.bak'), 'content3');

      const results = await scanner.scan(testDir, { excludePatterns: ['*.tmp', '*.bak'] });

      expect(results.length).toBe(1);
      expect(results[0].filename).toBe('file1.txt');
    });

    it('should return correct file metadata', async () => {
      const content = 'test content';
      const filePath = join(testDir, 'test.txt');
      writeFileSync(filePath, content);

      const results = await scanner.scan(testDir);

      expect(results.length).toBe(1);
      expect(results[0].filename).toBe('test.txt');
      expect(results[0].extension).toBe('txt');
      expect(results[0].size).toBe(content.length);
      expect(results[0].mimeType).toBe('text/plain');
      expect(results[0].created).toBeInstanceOf(Date);
      expect(results[0].modified).toBeInstanceOf(Date);
    });
  });

  describe('incremental scanning', () => {
    it('should cache scan results', async () => {
      writeFileSync(join(testDir, 'file1.txt'), 'content1');

      // First scan
      const results1 = await scanner.scan(testDir, { incremental: true });
      expect(results1.length).toBe(1);

      // Second scan should use cache
      const results2 = await scanner.scan(testDir, { incremental: true });
      expect(results2.length).toBe(1);
    });

    it('should detect new files', async () => {
      writeFileSync(join(testDir, 'file1.txt'), 'content1');
      await scanner.scan(testDir, { incremental: true });

      // Add new file
      writeFileSync(join(testDir, 'file2.txt'), 'content2');
      const results = await scanner.scan(testDir, { incremental: true });

      expect(results.length).toBe(2);
    });

    it('should clear cache when requested', async () => {
      writeFileSync(join(testDir, 'file1.txt'), 'content1');
      await scanner.scan(testDir, { incremental: true });

      scanner.clearCache();

      // Cache should be empty now
      const results = await scanner.scan(testDir, { incremental: true });
      expect(results.length).toBe(1);
    });
  });

  describe('scanWithStats', () => {
    it('should return detailed statistics', async () => {
      writeFileSync(join(testDir, 'file1.txt'), 'content1');
      writeFileSync(join(testDir, 'file2.pdf'), 'content2');
      writeFileSync(join(testDir, '.hidden'), 'hidden');

      const { results, stats } = await scanner.scanWithStats(testDir);

      expect(results.length).toBe(2);
      expect(stats.totalFiles).toBeGreaterThanOrEqual(2);
      expect(stats.scannedFiles).toBe(2);
      expect(stats.duration).toBeGreaterThan(0);
    });
  });

  describe('scanWithHashes', () => {
    it('should compute hashes for all files', async () => {
      writeFileSync(join(testDir, 'file1.txt'), 'content1');
      writeFileSync(join(testDir, 'file2.txt'), 'content2');

      const results = await scanner.scanWithHashes(testDir);

      expect(results.length).toBe(2);
      results.forEach(r => {
        expect(r.hash).toBeDefined();
        expect(typeof r.hash).toBe('string');
        expect(r.hash.length).toBeGreaterThan(0);
      });
    });

    it('should produce same hash for same content', async () => {
      writeFileSync(join(testDir, 'file1.txt'), 'same content');
      writeFileSync(join(testDir, 'file2.txt'), 'same content');

      const results = await scanner.scanWithHashes(testDir);

      expect(results[0].hash).toBe(results[1].hash);
    });
  });

  describe('findDuplicates', () => {
    it('should find duplicate files by hash', async () => {
      writeFileSync(join(testDir, 'original.txt'), 'duplicate content');
      writeFileSync(join(testDir, 'copy1.txt'), 'duplicate content');
      writeFileSync(join(testDir, 'copy2.txt'), 'duplicate content');
      writeFileSync(join(testDir, 'unique.txt'), 'unique content');

      const filesWithHashes = await scanner.scanWithHashes(testDir);
      const filesWithAnalysis = filesWithHashes.map(f => ({
        ...f,
        path: f.path,
        filename: f.filename,
        extension: f.extension,
        size: f.size,
        created: f.created,
        modified: f.modified,
        accessed: f.accessed,
        mimeType: f.mimeType,
        category: 'document' as const,
        hash: f.hash,
      }));

      const duplicates = scanner.findDuplicates(filesWithAnalysis);

      expect(duplicates.length).toBe(1);
      expect(duplicates[0].files.length).toBe(3);
    });

    it('should return empty array when no duplicates', async () => {
      writeFileSync(join(testDir, 'file1.txt'), 'content1');
      writeFileSync(join(testDir, 'file2.txt'), 'content2');

      const filesWithHashes = await scanner.scanWithHashes(testDir);
      const filesWithAnalysis = filesWithHashes.map(f => ({
        ...f,
        category: 'document' as const,
      }));

      const duplicates = scanner.findDuplicates(filesWithAnalysis);

      expect(duplicates.length).toBe(0);
    });
  });

  describe('progress reporting', () => {
    it('should call onProgress callback', async () => {
      writeFileSync(join(testDir, 'file1.txt'), 'content1');
      writeFileSync(join(testDir, 'file2.txt'), 'content2');
      writeFileSync(join(testDir, 'file3.txt'), 'content3');

      const progressCalls: { scanned: number; total: number }[] = [];
      await scanner.scan(testDir, {
        onProgress: (scanned, total) => {
          progressCalls.push({ scanned, total });
        },
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[progressCalls.length - 1].scanned).toBe(3);
    });
  });
});
