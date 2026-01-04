import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
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
  embedding: Uint8Array | null;
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

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

async function getSql() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

export class Database {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    ensureDirSync(dirname(dbPath));
  }

  async init(): Promise<void> {
    const SqlJs = await getSql();

    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SqlJs.Database(buffer);
    } else {
      this.db = new SqlJs.Database();
    }

    this.db.run('PRAGMA foreign_keys = ON');
    runMigrations(this.db);
    this.save();
  }

  private save(): void {
    // Debounce saves
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveNow();
    }, 100);
  }

  private saveNow(): void {
    if (this.db) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      writeFileSync(this.dbPath, buffer);
    }
  }

  close(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveNow();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private ensureDb(): SqlJsDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  private queryOne<T>(sql: string, params: SqlValue[] = []): T | null {
    const db = this.ensureDb();
    const stmt = db.prepare(sql);
    stmt.bind(params);

    if (stmt.step()) {
      const row = stmt.getAsObject() as T;
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  private queryAll<T>(sql: string, params: SqlValue[] = []): T[] {
    const db = this.ensureDb();
    const stmt = db.prepare(sql);
    stmt.bind(params);

    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  private run(sql: string, params: SqlValue[] = []): number {
    const db = this.ensureDb();
    db.run(sql, params);
    this.save();

    // Get last insert rowid
    const result = db.exec('SELECT last_insert_rowid() as id');
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0] as number;
    }
    return 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // Files
  // ═══════════════════════════════════════════════════════════════

  insertFile(file: Omit<FileRecord, 'id'>): number {
    return this.run(`
      INSERT OR REPLACE INTO files (
        path, filename, extension, mime_type, size, hash,
        created_at, modified_at, accessed_at,
        metadata_json, embedding, category, category_confidence,
        ocr_text, analyzed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      file.path,
      file.filename,
      file.extension,
      file.mimeType,
      file.size,
      file.hash,
      file.createdAt,
      file.modifiedAt,
      file.accessedAt,
      file.metadataJson,
      file.embedding,
      file.category,
      file.categoryConfidence,
      file.ocrText,
      file.analyzedAt,
    ]);
  }

  getFile(path: string): FileRecord | null {
    const row = this.queryOne<Record<string, unknown>>(`
      SELECT
        id, path, filename, extension, mime_type, size, hash,
        created_at, modified_at, accessed_at,
        metadata_json, embedding, category, category_confidence,
        ocr_text, analyzed_at
      FROM files WHERE path = ?
    `, [path]);

    if (!row) return null;
    return this.mapFileRecord(row);
  }

  getFileByHash(hash: string): FileRecord[] {
    const rows = this.queryAll<Record<string, unknown>>(`
      SELECT
        id, path, filename, extension, mime_type, size, hash,
        created_at, modified_at, accessed_at,
        metadata_json, embedding, category, category_confidence,
        ocr_text, analyzed_at
      FROM files WHERE hash = ?
    `, [hash]);

    return rows.map(row => this.mapFileRecord(row));
  }

  private mapFileRecord(row: Record<string, unknown>): FileRecord {
    return {
      id: row.id as number,
      path: row.path as string,
      filename: row.filename as string,
      extension: row.extension as string | null,
      mimeType: row.mime_type as string | null,
      size: row.size as number,
      hash: row.hash as string | null,
      createdAt: row.created_at as number,
      modifiedAt: row.modified_at as number,
      accessedAt: row.accessed_at as number,
      metadataJson: row.metadata_json as string | null,
      embedding: row.embedding as Uint8Array | null,
      category: row.category as string | null,
      categoryConfidence: row.category_confidence as number | null,
      ocrText: row.ocr_text as string | null,
      analyzedAt: row.analyzed_at as number,
    };
  }

  deleteFile(path: string): void {
    this.run('DELETE FROM files WHERE path = ?', [path]);
  }

  updateFilePath(oldPath: string, newPath: string): void {
    this.run('UPDATE files SET path = ? WHERE path = ?', [newPath, oldPath]);
  }

  getAllHashes(): { hash: string; count: number }[] {
    return this.queryAll<{ hash: string; count: number }>(`
      SELECT hash, COUNT(*) as count
      FROM files
      WHERE hash IS NOT NULL
      GROUP BY hash
      HAVING count > 1
    `);
  }

  // ═══════════════════════════════════════════════════════════════
  // Operations
  // ═══════════════════════════════════════════════════════════════

  insertOperation(op: Omit<OperationRecord, 'id' | 'createdAt' | 'undoneAt'>): number {
    return this.run(`
      INSERT INTO operations (type, source, destination, rule_name, confidence, created_at)
      VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
    `, [
      op.type,
      op.source,
      op.destination,
      op.ruleName,
      op.confidence,
    ]);
  }

  getOperations(limit = 50): OperationRecord[] {
    const rows = this.queryAll<Record<string, unknown>>(`
      SELECT
        id, type, source, destination,
        rule_name, confidence,
        created_at, undone_at
      FROM operations
      ORDER BY created_at DESC
      LIMIT ?
    `, [limit]);

    return rows.map(row => this.mapOperationRecord(row));
  }

  getOperation(id: number): OperationRecord | null {
    const row = this.queryOne<Record<string, unknown>>(`
      SELECT
        id, type, source, destination,
        rule_name, confidence,
        created_at, undone_at
      FROM operations WHERE id = ?
    `, [id]);

    if (!row) return null;
    return this.mapOperationRecord(row);
  }

  private mapOperationRecord(row: Record<string, unknown>): OperationRecord {
    return {
      id: row.id as number,
      type: row.type as string,
      source: row.source as string,
      destination: row.destination as string | null,
      ruleName: row.rule_name as string | null,
      confidence: row.confidence as number | null,
      createdAt: row.created_at as number,
      undoneAt: row.undone_at as number | null,
    };
  }

  markOperationUndone(id: number): void {
    this.run('UPDATE operations SET undone_at = strftime(\'%s\', \'now\') WHERE id = ?', [id]);
  }

  // ═══════════════════════════════════════════════════════════════
  // Patterns
  // ═══════════════════════════════════════════════════════════════

  insertPattern(pattern: Omit<PatternRecord, 'id' | 'createdAt'>): number {
    return this.run(`
      INSERT INTO patterns (type, pattern, destination, occurrences, last_used, created_at)
      VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
    `, [
      pattern.type,
      pattern.pattern,
      pattern.destination,
      pattern.occurrences,
      pattern.lastUsed,
    ]);
  }

  updatePatternOccurrence(id: number): void {
    this.run(`
      UPDATE patterns
      SET occurrences = occurrences + 1, last_used = strftime('%s', 'now')
      WHERE id = ?
    `, [id]);
  }

  getPatterns(type?: string): PatternRecord[] {
    if (type) {
      const rows = this.queryAll<Record<string, unknown>>(`
        SELECT
          id, type, pattern, destination, occurrences,
          last_used, created_at
        FROM patterns WHERE type = ?
        ORDER BY occurrences DESC
      `, [type]);
      return rows.map(row => this.mapPatternRecord(row));
    }

    const rows = this.queryAll<Record<string, unknown>>(`
      SELECT
        id, type, pattern, destination, occurrences,
        last_used, created_at
      FROM patterns
      ORDER BY occurrences DESC
    `);
    return rows.map(row => this.mapPatternRecord(row));
  }

  findPattern(type: string, pattern: string): PatternRecord | null {
    const row = this.queryOne<Record<string, unknown>>(`
      SELECT
        id, type, pattern, destination, occurrences,
        last_used, created_at
      FROM patterns WHERE type = ? AND pattern = ?
    `, [type, pattern]);

    if (!row) return null;
    return this.mapPatternRecord(row);
  }

  private mapPatternRecord(row: Record<string, unknown>): PatternRecord {
    return {
      id: row.id as number,
      type: row.type as string,
      pattern: row.pattern as string,
      destination: row.destination as string,
      occurrences: row.occurrences as number,
      lastUsed: row.last_used as number,
      createdAt: row.created_at as number,
    };
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
    const files = this.queryOne<{ count: number; totalSize: number }>(
      'SELECT COUNT(*) as count, SUM(size) as totalSize FROM files'
    ) || { count: 0, totalSize: 0 };

    const ops = this.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM operations'
    ) || { count: 0 };

    const cats = this.queryAll<{ category: string; count: number }>(`
      SELECT category, COUNT(*) as count
      FROM files
      WHERE category IS NOT NULL
      GROUP BY category
    `);

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
