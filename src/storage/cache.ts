import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { hashString } from '../utils/file-hash.js';

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number | null;
}

export class FileCache<T = unknown> {
  private cacheDir: string;
  private defaultTTL: number; // milliseconds

  constructor(cacheDir: string, defaultTTL = 24 * 60 * 60 * 1000) {
    this.cacheDir = cacheDir;
    this.defaultTTL = defaultTTL;

    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
  }

  private getCachePath(key: string): string {
    // Use hash for safe filenames
    const hash = key.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 200);
    return join(this.cacheDir, `${hash}.json`);
  }

  async get(key: string): Promise<T | null> {
    const path = this.getCachePath(key);

    if (!existsSync(path)) {
      return null;
    }

    try {
      const content = readFileSync(path, 'utf-8');
      const entry = JSON.parse(content) as CacheEntry<T>;

      // Check expiration
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.delete(key);
        return null;
      }

      return entry.value;
    } catch {
      return null;
    }
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    const path = this.getCachePath(key);
    const effectiveTTL = ttl ?? this.defaultTTL;

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: effectiveTTL ? Date.now() + effectiveTTL : null,
    };

    writeFileSync(path, JSON.stringify(entry), 'utf-8');
  }

  delete(key: string): boolean {
    const path = this.getCachePath(key);

    if (existsSync(path)) {
      unlinkSync(path);
      return true;
    }

    return false;
  }

  has(key: string): boolean {
    const path = this.getCachePath(key);

    if (!existsSync(path)) {
      return false;
    }

    try {
      const content = readFileSync(path, 'utf-8');
      const entry = JSON.parse(content) as CacheEntry<T>;

      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.delete(key);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  clear(): number {
    let count = 0;
    const files = readdirSync(this.cacheDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const path = join(this.cacheDir, file);
        unlinkSync(path);
        count++;
      }
    }

    return count;
  }

  cleanup(): number {
    let count = 0;
    const files = readdirSync(this.cacheDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const path = join(this.cacheDir, file);

        try {
          const content = readFileSync(path, 'utf-8');
          const entry = JSON.parse(content) as CacheEntry<T>;

          if (entry.expiresAt && Date.now() > entry.expiresAt) {
            unlinkSync(path);
            count++;
          }
        } catch {
          // Invalid cache file, remove it
          unlinkSync(path);
          count++;
        }
      }
    }

    return count;
  }

  getStats(): {
    entries: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const files = readdirSync(this.cacheDir).filter(f => f.endsWith('.json'));
    let totalSize = 0;
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;

    for (const file of files) {
      const path = join(this.cacheDir, file);
      const stats = statSync(path);
      totalSize += stats.size;

      try {
        const content = readFileSync(path, 'utf-8');
        const entry = JSON.parse(content) as CacheEntry<T>;

        if (oldestEntry === null || entry.createdAt < oldestEntry) {
          oldestEntry = entry.createdAt;
        }
        if (newestEntry === null || entry.createdAt > newestEntry) {
          newestEntry = entry.createdAt;
        }
      } catch {
        // Skip invalid entries
      }
    }

    return {
      entries: files.length,
      totalSize,
      oldestEntry,
      newestEntry,
    };
  }
}

// Memory cache for session-level caching
export class MemoryCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : null,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
