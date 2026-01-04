import Database from 'better-sqlite3';
import { dirname } from 'path';
import { ensureDirSync } from '../utils/fs-safe.js';
import { runMigrations } from './migrations.js';

export interface FileRecord {
  id: number;
  path: string;
  filename: string;
  extension: string | null;
  mimeType: string | null;
  size: number;
  hash: string | null;
  createdAt: number;
  modifiedAt: number;
  accessedAt: number;
  metadataJson: string | null;
  embedding: Buffer | null;
  category: string | null;
  categoryConfidence: number | null;
  ocrText: string | null;
  analyzedAt: number;
}

export interface OperationRecord {
  id: number;
  type: string;
  source: string;
  destination: string | null;
  ruleName: string | null;
  confidence: number | null;
  createdAt: number;
  undoneAt: number | null;
}

export interface PatternRecord {
  id: number;
  type: string;
  pattern: string;
  destination: string;
  occurrences: number;
  lastUsed: number;
  createdAt: number;
}

export class Database {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    ensureDirSync(dirname(dbPath));
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async init(): Promise<void> {
    runMigrations(this.db);
  }

  close(): void {
    this.db.close();
  }

  // ═══════════════════════════════════════════════════════════════
  // Files
  // ═══════════════════════════════════════════════════════════════

  insertFile(file: Omit<FileRecord, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO files (
        path, filename, extension, mime_type, size, hash,
        created_at, modified_at, accessed_at,
        metadata_json, embedding, category, category_confidence,
        ocr_text, analyzed_at
      ) VALUES (
        @path, @filename, @extension, @mimeType, @size, @hash,
        @createdAt, @modifiedAt, @accessedAt,
        @metadataJson, @embedding, @category, @categoryConfidence,
        @ocrText, @analyzedAt
      )
    `);

    const result = stmt.run({
      path: file.path,
      filename: file.filename,
      extension: file.extension,
      mimeType: file.mimeType,
      size: file.size,
      hash: file.hash,
      createdAt: file.createdAt,
      modifiedAt: file.modifiedAt,
      accessedAt: file.accessedAt,
      metadataJson: file.metadataJson,
      embedding: file.embedding,
      category: file.category,
      categoryConfidence: file.categoryConfidence,
      ocrText: file.ocrText,
      analyzedAt: file.analyzedAt,
    });

    return result.lastInsertRowid as number;
  }

  getFile(path: string): FileRecord | null {
    const stmt = this.db.prepare(`
      SELECT
        id, path, filename, extension, mime_type as mimeType, size, hash,
        created_at as createdAt, modified_at as modifiedAt, accessed_at as accessedAt,
        metadata_json as metadataJson, embedding, category, category_confidence as categoryConfidence,
        ocr_text as ocrText, analyzed_at as analyzedAt
      FROM files WHERE path = ?
    `);
    return stmt.get(path) as FileRecord | null;
  }

  getFileByHash(hash: string): FileRecord[] {
    const stmt = this.db.prepare(`
      SELECT
        id, path, filename, extension, mime_type as mimeType, size, hash,
        created_at as createdAt, modified_at as modifiedAt, accessed_at as accessedAt,
        metadata_json as metadataJson, embedding, category, category_confidence as categoryConfidence,
        ocr_text as ocrText, analyzed_at as analyzedAt
      FROM files WHERE hash = ?
    `);
    return stmt.all(hash) as FileRecord[];
  }

  deleteFile(path: string): void {
    const stmt = this.db.prepare('DELETE FROM files WHERE path = ?');
    stmt.run(path);
  }

  updateFilePath(oldPath: string, newPath: string): void {
    const stmt = this.db.prepare('UPDATE files SET path = ? WHERE path = ?');
    stmt.run(newPath, oldPath);
  }

  getAllHashes(): { hash: string; count: number }[] {
    const stmt = this.db.prepare(`
      SELECT hash, COUNT(*) as count
      FROM files
      WHERE hash IS NOT NULL
      GROUP BY hash
      HAVING count > 1
    `);
    return stmt.all() as { hash: string; count: number }[];
  }

  // ═══════════════════════════════════════════════════════════════
  // Operations
  // ═══════════════════════════════════════════════════════════════

  insertOperation(op: Omit<OperationRecord, 'id' | 'createdAt' | 'undoneAt'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO operations (type, source, destination, rule_name, confidence, created_at)
      VALUES (@type, @source, @destination, @ruleName, @confidence, unixepoch())
    `);

    const result = stmt.run({
      type: op.type,
      source: op.source,
      destination: op.destination,
      ruleName: op.ruleName,
      confidence: op.confidence,
    });

    return result.lastInsertRowid as number;
  }

  getOperations(limit = 50): OperationRecord[] {
    const stmt = this.db.prepare(`
      SELECT
        id, type, source, destination,
        rule_name as ruleName, confidence,
        created_at as createdAt, undone_at as undoneAt
      FROM operations
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as OperationRecord[];
  }

  getOperation(id: number): OperationRecord | null {
    const stmt = this.db.prepare(`
      SELECT
        id, type, source, destination,
        rule_name as ruleName, confidence,
        created_at as createdAt, undone_at as undoneAt
      FROM operations WHERE id = ?
    `);
    return stmt.get(id) as OperationRecord | null;
  }

  markOperationUndone(id: number): void {
    const stmt = this.db.prepare('UPDATE operations SET undone_at = unixepoch() WHERE id = ?');
    stmt.run(id);
  }

  // ═══════════════════════════════════════════════════════════════
  // Patterns
  // ═══════════════════════════════════════════════════════════════

  insertPattern(pattern: Omit<PatternRecord, 'id' | 'createdAt'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO patterns (type, pattern, destination, occurrences, last_used, created_at)
      VALUES (@type, @pattern, @destination, @occurrences, @lastUsed, unixepoch())
    `);

    const result = stmt.run({
      type: pattern.type,
      pattern: pattern.pattern,
      destination: pattern.destination,
      occurrences: pattern.occurrences,
      lastUsed: pattern.lastUsed,
    });

    return result.lastInsertRowid as number;
  }

  updatePatternOccurrence(id: number): void {
    const stmt = this.db.prepare(`
      UPDATE patterns
      SET occurrences = occurrences + 1, last_used = unixepoch()
      WHERE id = ?
    `);
    stmt.run(id);
  }

  getPatterns(type?: string): PatternRecord[] {
    if (type) {
      const stmt = this.db.prepare(`
        SELECT
          id, type, pattern, destination, occurrences,
          last_used as lastUsed, created_at as createdAt
        FROM patterns WHERE type = ?
        ORDER BY occurrences DESC
      `);
      return stmt.all(type) as PatternRecord[];
    }

    const stmt = this.db.prepare(`
      SELECT
        id, type, pattern, destination, occurrences,
        last_used as lastUsed, created_at as createdAt
      FROM patterns
      ORDER BY occurrences DESC
    `);
    return stmt.all() as PatternRecord[];
  }

  findPattern(type: string, pattern: string): PatternRecord | null {
    const stmt = this.db.prepare(`
      SELECT
        id, type, pattern, destination, occurrences,
        last_used as lastUsed, created_at as createdAt
      FROM patterns WHERE type = ? AND pattern = ?
    `);
    return stmt.get(type, pattern) as PatternRecord | null;
  }

  // ═══════════════════════════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════════════════════════

  getStats(): {
    totalFiles: number;
    totalSize: number;
    totalOperations: number;
    categories: Record<string, number>;
  } {
    const files = this.db.prepare('SELECT COUNT(*) as count, SUM(size) as totalSize FROM files').get() as {
      count: number;
      totalSize: number;
    };

    const ops = this.db.prepare('SELECT COUNT(*) as count FROM operations').get() as { count: number };

    const cats = this.db.prepare(`
      SELECT category, COUNT(*) as count
      FROM files
      WHERE category IS NOT NULL
      GROUP BY category
    `).all() as { category: string; count: number }[];

    const categories: Record<string, number> = {};
    for (const cat of cats) {
      categories[cat.category] = cat.count;
    }

    return {
      totalFiles: files.count,
      totalSize: files.totalSize || 0,
      totalOperations: ops.count,
      categories,
    };
  }
}
