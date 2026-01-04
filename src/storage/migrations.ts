import type { Database as SqlJsDatabase } from 'sql.js';

interface Migration {
  version: number;
  name: string;
  up: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      -- Files table
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY,
        path TEXT UNIQUE NOT NULL,
        filename TEXT NOT NULL,
        extension TEXT,
        mime_type TEXT,
        size INTEGER,
        hash TEXT,
        created_at INTEGER,
        modified_at INTEGER,
        accessed_at INTEGER,
        metadata_json TEXT,
        embedding BLOB,
        category TEXT,
        category_confidence REAL,
        ocr_text TEXT,
        analyzed_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      -- Operations table
      CREATE TABLE IF NOT EXISTS operations (
        id INTEGER PRIMARY KEY,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        destination TEXT,
        rule_name TEXT,
        confidence REAL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        undone_at INTEGER
      );

      -- Patterns table
      CREATE TABLE IF NOT EXISTS patterns (
        id INTEGER PRIMARY KEY,
        type TEXT NOT NULL,
        pattern TEXT NOT NULL,
        destination TEXT NOT NULL,
        occurrences INTEGER DEFAULT 1,
        last_used INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      -- Schema version table
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);
      CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension);
      CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
      CREATE INDEX IF NOT EXISTS idx_operations_created ON operations(created_at);
      CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(type);
    `,
  },
  {
    version: 2,
    name: 'add_file_indexes',
    up: `
      CREATE INDEX IF NOT EXISTS idx_files_modified ON files(modified_at);
      CREATE INDEX IF NOT EXISTS idx_files_size ON files(size);
    `,
  },
];

export function runMigrations(db: SqlJsDatabase): void {
  // Ensure schema_version table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `);

  // Get current version
  const result = db.exec('SELECT MAX(version) as version FROM schema_version');
  const currentVersion = result.length > 0 && result[0].values.length > 0
    ? (result[0].values[0][0] as number | null) || 0
    : 0;

  // Run pending migrations
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      // sql.js doesn't have native transactions like better-sqlite3
      // but we can use BEGIN/COMMIT
      db.run('BEGIN TRANSACTION');
      try {
        db.run(migration.up);
        db.run('INSERT INTO schema_version (version) VALUES (?)', [migration.version]);
        db.run('COMMIT');
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }
    }
  }
}

export function getCurrentVersion(db: SqlJsDatabase): number {
  try {
    const result = db.exec('SELECT MAX(version) as version FROM schema_version');
    if (result.length > 0 && result[0].values.length > 0) {
      return (result[0].values[0][0] as number | null) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

export function getLatestVersion(): number {
  return migrations[migrations.length - 1]?.version || 0;
}
