import { dirname, join } from 'path';
import { safeMove, safeCopy, safeDelete, ensureDir } from '../utils/fs-safe.js';
import { Database } from '../storage/database.js';
import type { Suggestion } from './suggester.js';

export interface ExecutionResult {
  success: boolean;
  operationId?: number;
  finalPath?: string;
  error?: string;
}

export class Executor {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
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
    try {
      // Ensure destination directory exists
      const destDir = dirname(destination);
      await ensureDir(destDir);

      // Perform move
      const finalPath = await safeMove(source, destination);

      // Record operation
      const operationId = this.db.insertOperation({
        type: 'move',
        source,
        destination: finalPath,
        ruleName: ruleName || null,
        confidence: confidence || null,
      });

      // Update file record in database
      this.db.updateFilePath(source, finalPath);

      return {
        success: true,
        operationId,
        finalPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Move failed',
      };
    }
  }

  async copy(
    source: string,
    destination: string,
    ruleName?: string,
    confidence?: number
  ): Promise<ExecutionResult> {
    try {
      // Ensure destination directory exists
      const destDir = dirname(destination);
      await ensureDir(destDir);

      // Perform copy
      await safeCopy(source, destination);

      // Record operation
      const operationId = this.db.insertOperation({
        type: 'copy',
        source,
        destination,
        ruleName: ruleName || null,
        confidence: confidence || null,
      });

      return {
        success: true,
        operationId,
        finalPath: destination,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Copy failed',
      };
    }
  }

  async delete(
    source: string,
    toTrash = true,
    ruleName?: string,
    confidence?: number
  ): Promise<ExecutionResult> {
    try {
      // Perform delete
      await safeDelete(source, toTrash);

      // Record operation
      const operationId = this.db.insertOperation({
        type: 'delete',
        source,
        destination: toTrash ? 'trash' : null,
        ruleName: ruleName || null,
        confidence: confidence || null,
      });

      // Remove file record from database
      this.db.deleteFile(source);

      return {
        success: true,
        operationId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      };
    }
  }

  async archive(
    source: string,
    destination: string,
    ruleName?: string,
    confidence?: number
  ): Promise<ExecutionResult> {
    // For now, archive is just a move to archive location
    return this.move(source, destination, ruleName, confidence);
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
      return false;
    }

    if (operation.undoneAt) {
      return false; // Already undone
    }

    try {
      switch (operation.type) {
        case 'move':
          if (operation.destination) {
            // Move back to original location
            await safeMove(operation.destination, operation.source);
            this.db.updateFilePath(operation.destination, operation.source);
          }
          break;

        case 'copy':
          if (operation.destination) {
            // Delete the copy
            await safeDelete(operation.destination, false);
          }
          break;

        case 'delete':
          // Can't undo delete from trash automatically
          // Would need to restore from trash
          return false;

        default:
          return false;
      }

      this.db.markOperationUndone(operationId);
      return true;
    } catch {
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
