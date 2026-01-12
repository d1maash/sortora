import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { Executor } from '../src/core/executor';
import { Database } from '../src/storage/database';

describe('Executor', () => {
  const testDir = join(tmpdir(), 'sortora-executor-test-' + Date.now());
  const dbPath = join(testDir, 'test.db');
  let db: Database;
  let executor: Executor;

  beforeEach(async () => {
    mkdirSync(testDir, { recursive: true });
    db = new Database(dbPath);
    await db.init();
    executor = new Executor(db);
  });

  afterEach(() => {
    db.close();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('move', () => {
    it('should move file successfully', async () => {
      const source = join(testDir, 'source.txt');
      const dest = join(testDir, 'dest.txt');
      writeFileSync(source, 'test content');

      const result = await executor.move(source, dest);

      expect(result.success).toBe(true);
      expect(result.finalPath).toBe(dest);
      expect(result.operationId).toBeDefined();
      expect(existsSync(source)).toBe(false);
      expect(existsSync(dest)).toBe(true);
    });

    it('should record operation in database', async () => {
      const source = join(testDir, 'source.txt');
      const dest = join(testDir, 'dest.txt');
      writeFileSync(source, 'test content');

      const result = await executor.move(source, dest, 'TestRule', 0.9);

      const history = executor.getHistory(1);
      expect(history.length).toBe(1);
      expect(history[0].type).toBe('move');
      expect(history[0].source).toBe(source);
    });

    it('should handle errors gracefully', async () => {
      const source = join(testDir, 'nonexistent.txt');
      const dest = join(testDir, 'dest.txt');

      const result = await executor.move(source, dest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('copy', () => {
    it('should copy file successfully', async () => {
      const source = join(testDir, 'source.txt');
      const dest = join(testDir, 'dest.txt');
      writeFileSync(source, 'test content');

      const result = await executor.copy(source, dest);

      expect(result.success).toBe(true);
      expect(existsSync(source)).toBe(true);
      expect(existsSync(dest)).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete file to trash', async () => {
      const file = join(testDir, 'todelete.txt');
      writeFileSync(file, 'test content');

      const result = await executor.delete(file, true);

      expect(result.success).toBe(true);
      expect(existsSync(file)).toBe(false);
      expect(result.trashInfo).toBeDefined();
    });

    it('should permanently delete file', async () => {
      const file = join(testDir, 'todelete.txt');
      writeFileSync(file, 'test content');

      const result = await executor.delete(file, false);

      expect(result.success).toBe(true);
      expect(existsSync(file)).toBe(false);
    });
  });

  describe('archive', () => {
    it('should archive file with compression', async () => {
      const source = join(testDir, 'source.txt');
      const dest = join(testDir, 'archived');
      writeFileSync(source, 'test content to compress');

      const result = await executor.archive(source, dest, undefined, undefined, {
        compress: true,
        deleteOriginal: true,
      });

      expect(result.success).toBe(true);
      expect(result.finalPath).toContain('.gz');
      expect(existsSync(source)).toBe(false);
    });

    it('should archive file without compression (move)', async () => {
      const source = join(testDir, 'source.txt');
      const dest = join(testDir, 'archive', 'source.txt');
      writeFileSync(source, 'test content');

      const result = await executor.archive(source, dest, undefined, undefined, {
        compress: false,
        deleteOriginal: true,
      });

      expect(result.success).toBe(true);
      expect(existsSync(source)).toBe(false);
      expect(existsSync(dest)).toBe(true);
    });
  });

  describe('undo', () => {
    it('should undo move operation', async () => {
      const source = join(testDir, 'source.txt');
      const dest = join(testDir, 'dest.txt');
      writeFileSync(source, 'test content');

      const moveResult = await executor.move(source, dest);
      expect(moveResult.success).toBe(true);
      expect(existsSync(dest)).toBe(true);

      const undoResult = await executor.undo(moveResult.operationId!);
      expect(undoResult).toBe(true);
      expect(existsSync(source)).toBe(true);
      expect(existsSync(dest)).toBe(false);
    });

    it('should undo copy operation', async () => {
      const source = join(testDir, 'source.txt');
      const dest = join(testDir, 'dest.txt');
      writeFileSync(source, 'test content');

      const copyResult = await executor.copy(source, dest);
      expect(copyResult.success).toBe(true);

      const undoResult = await executor.undo(copyResult.operationId!);
      expect(undoResult).toBe(true);
      expect(existsSync(source)).toBe(true);
      expect(existsSync(dest)).toBe(false);
    });

    it('should not undo already undone operation', async () => {
      const source = join(testDir, 'source.txt');
      const dest = join(testDir, 'dest.txt');
      writeFileSync(source, 'test content');

      const moveResult = await executor.move(source, dest);
      await executor.undo(moveResult.operationId!);

      const secondUndo = await executor.undo(moveResult.operationId!);
      expect(secondUndo).toBe(false);
    });
  });

  describe('executeMany', () => {
    it('should execute multiple operations sequentially', async () => {
      const source1 = join(testDir, 'source1.txt');
      const source2 = join(testDir, 'source2.txt');
      const dest1 = join(testDir, 'dest1.txt');
      const dest2 = join(testDir, 'dest2.txt');
      writeFileSync(source1, 'content1');
      writeFileSync(source2, 'content2');

      const suggestions = [
        {
          file: { path: source1, filename: 'source1.txt' } as any,
          destination: dest1,
          ruleName: 'Test',
          confidence: 0.9,
          action: 'move' as const,
          requiresConfirmation: false,
        },
        {
          file: { path: source2, filename: 'source2.txt' } as any,
          destination: dest2,
          ruleName: 'Test',
          confidence: 0.9,
          action: 'move' as const,
          requiresConfirmation: false,
        },
      ];

      const results = await executor.executeMany(suggestions, { parallel: 1 });

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should execute multiple operations in parallel', async () => {
      const files = Array.from({ length: 4 }, (_, i) => ({
        source: join(testDir, `source${i}.txt`),
        dest: join(testDir, `dest${i}.txt`),
      }));

      files.forEach(f => writeFileSync(f.source, 'content'));

      const suggestions = files.map(f => ({
        file: { path: f.source, filename: `source.txt` } as any,
        destination: f.dest,
        ruleName: 'Test',
        confidence: 0.9,
        action: 'move' as const,
        requiresConfirmation: false,
      }));

      const results = await executor.executeMany(suggestions, { parallel: 2 });

      expect(results.length).toBe(4);
      results.forEach(r => expect(r.success).toBe(true));
    });

    it('should stop on error when stopOnError is true', async () => {
      const source1 = join(testDir, 'source1.txt');
      const source2 = join(testDir, 'nonexistent.txt');
      const dest1 = join(testDir, 'dest1.txt');
      const dest2 = join(testDir, 'dest2.txt');
      writeFileSync(source1, 'content1');

      const suggestions = [
        {
          file: { path: source1, filename: 'source1.txt' } as any,
          destination: dest1,
          ruleName: 'Test',
          confidence: 0.9,
          action: 'move' as const,
          requiresConfirmation: false,
        },
        {
          file: { path: source2, filename: 'source2.txt' } as any,
          destination: dest2,
          ruleName: 'Test',
          confidence: 0.9,
          action: 'move' as const,
          requiresConfirmation: false,
        },
      ];

      const results = await executor.executeMany(suggestions, { stopOnError: true });

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });
});
