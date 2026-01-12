import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import {
  validatePath,
  parseFilename,
  safeCopy,
  safeMove,
  safeDelete,
  restoreFromTrash,
  exists,
  ensureDir,
} from '../src/utils/fs-safe';

describe('fs-safe utilities', () => {
  const testDir = join(tmpdir(), 'sortora-test-' + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('validatePath', () => {
    it('should allow valid paths', () => {
      const result = validatePath('/Users/test/file.txt');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect path traversal attacks', () => {
      const result = validatePath('../../../etc/passwd', '/Users/test');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Path traversal detected');
    });

    it('should allow paths within base directory', () => {
      const result = validatePath('/Users/test/subdir/file.txt', '/Users/test');
      expect(result.valid).toBe(true);
    });

    it('should reject paths outside base directory', () => {
      const result = validatePath('/other/path/file.txt', '/Users/test');
      expect(result.valid).toBe(false);
    });
  });

  describe('parseFilename', () => {
    it('should parse simple filename', () => {
      const result = parseFilename('/path/to/file.txt');
      expect(result.ext).toBe('.txt');
      expect(result.base).toBe('/path/to/file');
    });

    it('should handle files without extension', () => {
      const result = parseFilename('/path/to/Makefile');
      expect(result.ext).toBe('');
      expect(result.base).toBe('/path/to/Makefile');
    });

    it('should handle multiple dots in filename', () => {
      const result = parseFilename('/path/to/file.test.ts');
      expect(result.ext).toBe('.ts');
      expect(result.base).toBe('/path/to/file.test');
    });

    it('should handle folders with dots', () => {
      const result = parseFilename('/path/to/my.folder/file.txt');
      expect(result.ext).toBe('.txt');
      expect(result.base).toBe('/path/to/my.folder/file');
    });
  });

  describe('safeCopy', () => {
    it('should copy file successfully', async () => {
      const source = join(testDir, 'source.txt');
      const dest = join(testDir, 'dest.txt');
      writeFileSync(source, 'test content');

      const finalPath = await safeCopy(source, dest);
      expect(existsSync(finalPath)).toBe(true);
      expect(existsSync(source)).toBe(true); // Original should still exist
    });

    it('should handle name collisions', async () => {
      const source = join(testDir, 'source.txt');
      const dest = join(testDir, 'dest.txt');
      writeFileSync(source, 'test content');
      writeFileSync(dest, 'existing content');

      const finalPath = await safeCopy(source, dest);
      expect(finalPath).not.toBe(dest);
      expect(finalPath).toContain('(1)');
    });
  });

  describe('safeMove', () => {
    it('should move file successfully', async () => {
      const source = join(testDir, 'source.txt');
      const dest = join(testDir, 'dest.txt');
      writeFileSync(source, 'test content');

      const finalPath = await safeMove(source, dest);
      expect(existsSync(finalPath)).toBe(true);
      expect(existsSync(source)).toBe(false); // Original should be gone
    });

    it('should handle name collisions', async () => {
      const source = join(testDir, 'source.txt');
      const dest = join(testDir, 'dest.txt');
      writeFileSync(source, 'test content');
      writeFileSync(dest, 'existing content');

      const finalPath = await safeMove(source, dest);
      expect(finalPath).not.toBe(dest);
      expect(finalPath).toContain('(1)');
    });
  });

  describe('safeDelete', () => {
    it('should delete file to trash', async () => {
      const file = join(testDir, 'todelete.txt');
      writeFileSync(file, 'test content');

      const trashInfo = await safeDelete(file, true);
      expect(existsSync(file)).toBe(false);
      expect(trashInfo).not.toBeNull();
      expect(trashInfo?.originalPath).toBe(file);
    });

    it('should permanently delete file', async () => {
      const file = join(testDir, 'todelete.txt');
      writeFileSync(file, 'test content');

      const result = await safeDelete(file, false);
      expect(existsSync(file)).toBe(false);
      expect(result).toBeNull(); // No trash info for permanent delete
    });

    it('should handle non-existent files', async () => {
      const file = join(testDir, 'nonexistent.txt');
      const result = await safeDelete(file, true);
      expect(result).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const file = join(testDir, 'exists.txt');
      writeFileSync(file, 'content');
      expect(await exists(file)).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const file = join(testDir, 'nonexistent.txt');
      expect(await exists(file)).toBe(false);
    });
  });

  describe('ensureDir', () => {
    it('should create directory if not exists', async () => {
      const dir = join(testDir, 'new', 'nested', 'dir');
      await ensureDir(dir);
      expect(existsSync(dir)).toBe(true);
    });

    it('should not fail if directory exists', async () => {
      await ensureDir(testDir);
      expect(existsSync(testDir)).toBe(true);
    });
  });
});
