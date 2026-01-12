import { dirname, join } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import { createReadStream } from 'fs';
import { safeMove, safeCopy, safeDelete, ensureDir, restoreFromTrash, exists, type TrashInfo } from '../utils/fs-safe.js';
import { Database } from '../storage/database.js';
import { createLogger } from '../utils/logger.js';
import type { Suggestion } from './suggester.js';

const logger = createLogger('executor');

export interface ExecutionResult {
  success: boolean;
  operationId?: number;
  finalPath?: string;
  error?: string;
  trashInfo?: TrashInfo;
}

// Lock manager for preventing race conditions
class LockManager {
  private locks = new Map<string, Promise<void>>();

  async acquire(path: string): Promise<() => void> {
    // Wait for any existing lock on this path
    while (this.locks.has(path)) {
      await this.locks.get(path);
    }

    // Create a new lock
    let releaseFn: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseFn = resolve;
    });

    this.locks.set(path, lockPromise);

    return () => {
      this.locks.delete(path);
      releaseFn!();
    };
  }

  isLocked(path: string): boolean {
    return this.locks.has(path);
  }
}

// Global lock manager instance
const lockManager = new LockManager();

export class Executor {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Acquire locks for source and destination paths
   */
  private async acquireLocks(source: string, destination?: string): Promise<(() => void)[]> {
    const releases: (() => void)[] = [];
    releases.push(await lockManager.acquire(source));

    if (destination) {
      releases.push(await lockManager.acquire(destination));
    }

    return releases;
  }

  /**
   * Release all acquired locks
   */
  private releaseLocks(releases: (() => void)[]): void {
    for (const release of releases) {
      release();
    }
  }

  async execute(suggestion: Suggestion): Promise<ExecutionResult> {
    try {
      switch (suggestion.action) {
        case 'move':
          return await this.move(
            suggestion.file.path,
            suggestion.destination,
            suggestion.ruleName,
            suggestion.confidence
          );

        case 'copy':
          return await this.copy(
            suggestion.file.path,
            suggestion.destination,
            suggestion.ruleName,
            suggestion.confidence
          );

        case 'delete':
          return await this.delete(
            suggestion.file.path,
            true, // to trash
            suggestion.ruleName,
            suggestion.confidence
          );

        case 'archive':
          return await this.archive(
            suggestion.file.path,
            suggestion.destination,
            suggestion.ruleName,
            suggestion.confidence
          );

        default:
          return {
            success: false,
            error: `Unknown action: ${suggestion.action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async move(
    source: string,
    destination: string,
    ruleName?: string,
    confidence?: number
  ): Promise<ExecutionResult> {
    // Acquire locks to prevent race conditions
    const releases = await this.acquireLocks(source, destination);

    try {
      // Ensure destination directory exists
      const destDir = dirname(destination);
      await ensureDir(destDir);

      // Perform move
      const finalPath = await safeMove(source, destination);

      // Record operation in database
      const operationId = this.db.insertOperation({
        type: 'move',
        source,
        destination: finalPath,
        ruleName: ruleName || null,
        confidence: confidence || null,
      });

      // Update file record in database
      this.db.updateFilePath(source, finalPath);

      logger.info(`Moved: ${source} -> ${finalPath}`);

      return {
        success: true,
        operationId,
        finalPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Move failed';
      logger.error(`Move failed: ${source} -> ${destination}: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      // Always release locks
      this.releaseLocks(releases);
    }
  }

  async copy(
    source: string,
    destination: string,
    ruleName?: string,
    confidence?: number
  ): Promise<ExecutionResult> {
    // Acquire locks to prevent race conditions
    const releases = await this.acquireLocks(source, destination);

    try {
      // Ensure destination directory exists
      const destDir = dirname(destination);
      await ensureDir(destDir);

      // Perform copy
      const finalPath = await safeCopy(source, destination);

      // Record operation
      const operationId = this.db.insertOperation({
        type: 'copy',
        source,
        destination: finalPath,
        ruleName: ruleName || null,
        confidence: confidence || null,
      });

      logger.info(`Copied: ${source} -> ${finalPath}`);

      return {
        success: true,
        operationId,
        finalPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Copy failed';
      logger.error(`Copy failed: ${source} -> ${destination}: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      this.releaseLocks(releases);
    }
  }

  async delete(
    source: string,
    toTrash = true,
    ruleName?: string,
    confidence?: number
  ): Promise<ExecutionResult> {
    // Acquire lock to prevent race conditions
    const releases = await this.acquireLocks(source);

    try {
      // Perform delete and get trash info
      const trashInfo = await safeDelete(source, toTrash);

      // Record operation with trash path for undo capability
      const operationId = this.db.insertOperation({
        type: 'delete',
        source,
        destination: trashInfo?.trashPath || null,
        ruleName: ruleName || null,
        confidence: confidence || null,
      });

      // Remove file record from database
      this.db.deleteFile(source);

      logger.info(`Deleted: ${source}${toTrash ? ' (moved to trash)' : ' (permanent)'}`);

      return {
        success: true,
        operationId,
        trashInfo: trashInfo || undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delete failed';
      logger.error(`Delete failed: ${source}: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      this.releaseLocks(releases);
    }
  }

  async archive(
    source: string,
    destination: string,
    ruleName?: string,
    confidence?: number,
    options: { compress?: boolean; deleteOriginal?: boolean } = {}
  ): Promise<ExecutionResult> {
    const { compress = true, deleteOriginal = true } = options;

    // Acquire locks to prevent race conditions
    const releases = await this.acquireLocks(source, destination);

    try {
      let finalPath: string;

      if (compress) {
        // Create a compressed archive (gzip)
        const archivePath = destination.endsWith('.gz') ? destination : `${destination}.gz`;
        const archiveDir = dirname(archivePath);
        await ensureDir(archiveDir);

        // Check for name collision
        let counter = 1;
        finalPath = archivePath;
        const basePath = archivePath.replace(/\.gz$/, '');

        while (await exists(finalPath)) {
          finalPath = `${basePath} (${counter}).gz`;
          counter++;
        }

        // Compress the file using gzip
        await pipeline(
          createReadStream(source),
          createGzip({ level: 9 }),
          createWriteStream(finalPath)
        );

        logger.info(`Archived (compressed): ${source} -> ${finalPath}`);
      } else {
        // Just move to archive location without compression
        finalPath = await safeMove(source, destination);
        logger.info(`Archived (moved): ${source} -> ${finalPath}`);
      }

      // Record operation
      const operationId = this.db.insertOperation({
        type: 'archive',
        source,
        destination: finalPath,
        ruleName: ruleName || null,
        confidence: confidence || null,
      });

      // Delete original if compressed and requested
      if (compress && deleteOriginal) {
        await safeDelete(source, false);
        this.db.deleteFile(source);
      } else if (!compress) {
        // Update file path in database (moved)
        this.db.updateFilePath(source, finalPath);
      }

      return {
        success: true,
        operationId,
        finalPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Archive failed';
      logger.error(`Archive failed: ${source} -> ${destination}: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      this.releaseLocks(releases);
    }
  }

  async rename(
    source: string,
    newName: string,
    ruleName?: string,
    confidence?: number
  ): Promise<ExecutionResult> {
    const dir = dirname(source);
    const destination = join(dir, newName);

    return this.move(source, destination, ruleName, confidence);
  }

  async undo(operationId: number): Promise<boolean> {
    const operation = this.db.getOperation(operationId);

    if (!operation) {
      logger.warn(`Undo failed: operation ${operationId} not found`);
      return false;
    }

    if (operation.undoneAt) {
      logger.warn(`Undo failed: operation ${operationId} already undone`);
      return false;
    }

    try {
      switch (operation.type) {
        case 'move':
          if (operation.destination) {
            // Acquire locks
            const releases = await this.acquireLocks(operation.destination, operation.source);
            try {
              // Move back to original location
              await safeMove(operation.destination, operation.source);
              this.db.updateFilePath(operation.destination, operation.source);
              logger.info(`Undone move: ${operation.destination} -> ${operation.source}`);
            } finally {
              this.releaseLocks(releases);
            }
          }
          break;

        case 'copy':
          if (operation.destination) {
            const releases = await this.acquireLocks(operation.destination);
            try {
              // Delete the copy
              await safeDelete(operation.destination, false);
              logger.info(`Undone copy: deleted ${operation.destination}`);
            } finally {
              this.releaseLocks(releases);
            }
          }
          break;

        case 'delete':
          // Restore from trash using the stored trash path
          if (operation.destination) {
            const restored = await restoreFromTrash(operation.source);
            if (restored) {
              logger.info(`Undone delete: restored ${operation.source}`);
            } else {
              logger.warn(`Undo delete failed: could not restore ${operation.source}`);
              return false;
            }
          } else {
            logger.warn(`Undo delete failed: no trash path stored for ${operation.source}`);
            return false;
          }
          break;

        case 'archive':
          // For archives, we can't easily undo compression
          // But we can delete the archive if it exists
          if (operation.destination && await exists(operation.destination)) {
            await safeDelete(operation.destination, false);
            logger.info(`Undone archive: deleted ${operation.destination}`);
          }
          break;

        default:
          logger.warn(`Undo failed: unknown operation type ${operation.type}`);
          return false;
      }

      this.db.markOperationUndone(operationId);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Undo failed for operation ${operationId}: ${errorMessage}`);
      return false;
    }
  }

  async undoLast(): Promise<boolean> {
    const operations = this.db.getOperations(1);

    if (operations.length === 0) {
      return false;
    }

    const lastOp = operations[0];

    if (lastOp.undoneAt) {
      return false;
    }

    return this.undo(lastOp.id);
  }

  async executeMany(
    suggestions: Suggestion[],
    options: {
      stopOnError?: boolean;
      parallel?: number;
    } = {}
  ): Promise<ExecutionResult[]> {
    const { stopOnError = false, parallel = 1 } = options;
    const results: ExecutionResult[] = [];

    if (parallel === 1) {
      // Sequential execution
      for (const suggestion of suggestions) {
        const result = await this.execute(suggestion);
        results.push(result);

        if (stopOnError && !result.success) {
          break;
        }
      }
    } else {
      // Parallel execution in batches
      for (let i = 0; i < suggestions.length; i += parallel) {
        const batch = suggestions.slice(i, i + parallel);
        const batchResults = await Promise.all(
          batch.map(s => this.execute(s))
        );
        results.push(...batchResults);

        if (stopOnError && batchResults.some(r => !r.success)) {
          break;
        }
      }
    }

    return results;
  }

  getHistory(limit = 50): {
    id: number;
    type: string;
    source: string;
    destination: string | null;
    createdAt: number;
    undoneAt: number | null;
  }[] {
    return this.db.getOperations(limit);
  }
}
