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

  // ═══════════════════════════════════════════════════════════════
  // Extended Stats
  // ═══════════════════════════════════════════════════════════════

  getOperationsByPeriod(period: 'day' | 'week' | 'month'): {
    total: number;
    byType: Record<string, number>;
    byRule: Record<string, number>;
  } {
    const now = Math.floor(Date.now() / 1000);
    let since: number;

    switch (period) {
      case 'day':
        since = now - 24 * 60 * 60;
        break;
      case 'week':
        since = now - 7 * 24 * 60 * 60;
        break;
      case 'month':
        since = now - 30 * 24 * 60 * 60;
        break;
    }

    const total = this.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM operations WHERE created_at >= ? AND undone_at IS NULL',
      [since]
    ) || { count: 0 };

    const byTypeRows = this.queryAll<{ type: string; count: number }>(`
      SELECT type, COUNT(*) as count
      FROM operations
      WHERE created_at >= ? AND undone_at IS NULL
      GROUP BY type
      ORDER BY count DESC
    `, [since]);

    const byType: Record<string, number> = {};
    for (const row of byTypeRows) {
      byType[row.type] = row.count;
    }

    const byRuleRows = this.queryAll<{ rule_name: string; count: number }>(`
      SELECT rule_name, COUNT(*) as count
      FROM operations
      WHERE created_at >= ? AND undone_at IS NULL AND rule_name IS NOT NULL
      GROUP BY rule_name
      ORDER BY count DESC
    `, [since]);

    const byRule: Record<string, number> = {};
    for (const row of byRuleRows) {
      byRule[row.rule_name] = row.count;
    }

    return {
      total: total.count,
      byType,
      byRule,
    };
  }

  getTopRules(limit = 10): { ruleName: string; count: number; lastUsed: number }[] {
    const rows = this.queryAll<{ rule_name: string; count: number; last_used: number }>(`
      SELECT rule_name, COUNT(*) as count, MAX(created_at) as last_used
      FROM operations
      WHERE rule_name IS NOT NULL AND undone_at IS NULL
      GROUP BY rule_name
      ORDER BY count DESC
      LIMIT ?
    `, [limit]);

    return rows.map(row => ({
      ruleName: row.rule_name,
      count: row.count,
      lastUsed: row.last_used,
    }));
  }

  getDuplicateStats(): {
    totalGroups: number;
    totalDuplicateFiles: number;
    potentialSavings: number;
  } {
    const duplicateHashes = this.queryAll<{ hash: string; count: number; size: number }>(`
      SELECT hash, COUNT(*) as count, size
      FROM files
      WHERE hash IS NOT NULL
      GROUP BY hash
      HAVING count > 1
    `);

    let totalGroups = 0;
    let totalDuplicateFiles = 0;
    let potentialSavings = 0;

    for (const row of duplicateHashes) {
      totalGroups++;
      totalDuplicateFiles += row.count - 1;
      potentialSavings += row.size * (row.count - 1);
    }

    return {
      totalGroups,
      totalDuplicateFiles,
      potentialSavings,
    };
  }

  getDeletedDuplicatesStats(): {
    totalDeleted: number;
    totalSaved: number;
  } {
    const result = this.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM operations
      WHERE type = 'delete' AND undone_at IS NULL
    `) || { count: 0 };

    // Get sizes of deleted files from operation source paths
    // Note: We can't get exact size from deleted files, so we estimate
    // based on average file size from duplicates that were deleted
    const avgSize = this.queryOne<{ avg_size: number }>(`
      SELECT AVG(f.size) as avg_size
      FROM files f
      JOIN operations o ON f.path = o.source
      WHERE o.type = 'delete'
    `) || { avg_size: 0 };

    return {
      totalDeleted: result.count,
      totalSaved: Math.floor(result.count * (avgSize.avg_size || 0)),
    };
  }

  getActivityTimeline(days = 30): { date: string; count: number }[] {
    const now = Math.floor(Date.now() / 1000);
    const since = now - days * 24 * 60 * 60;

    const rows = this.queryAll<{ date: string; count: number }>(`
      SELECT date(created_at, 'unixepoch') as date, COUNT(*) as count
      FROM operations
      WHERE created_at >= ? AND undone_at IS NULL
      GROUP BY date
      ORDER BY date ASC
    `, [since]);

    return rows;
  }
}
