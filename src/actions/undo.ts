import { rename, copyFile, unlink } from 'fs/promises';
import { exists, ensureDir } from '../utils/fs-safe.js';
import { dirname } from 'path';
import { Database, type OperationRecord } from '../storage/database.js';

export interface UndoResult {
  success: boolean;
  operationId: number;
  type: string;
  error?: string;
}

export async function undoOperation(
  db: Database,
  operationId: number
): Promise<UndoResult> {
  const operation = db.getOperation(operationId);

  if (!operation) {
    return {
      success: false,
      operationId,
      type: 'unknown',
      error: 'Operation not found',
    };
  }

  if (operation.undoneAt) {
    return {
      success: false,
      operationId,
      type: operation.type,
      error: 'Operation already undone',
    };
  }

  try {
    switch (operation.type) {
      case 'move':
        return await undoMove(db, operation);

      case 'copy':
        return await undoCopy(db, operation);

      case 'rename':
        return await undoRename(db, operation);

      case 'delete':
        return await undoDelete(db, operation);

      default:
        return {
          success: false,
          operationId,
          type: operation.type,
          error: `Cannot undo operation type: ${operation.type}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      operationId,
      type: operation.type,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function undoMove(
  db: Database,
  operation: OperationRecord
): Promise<UndoResult> {
  const { id, source, destination } = operation;

  if (!destination) {
    return {
      success: false,
      operationId: id,
      type: 'move',
      error: 'No destination recorded',
    };
  }

  // Check if moved file still exists
  if (!await exists(destination)) {
    return {
      success: false,
      operationId: id,
      type: 'move',
      error: 'Moved file no longer exists',
    };
  }

  // Ensure original directory exists
  await ensureDir(dirname(source));

  // Move back to original location
  await rename(destination, source);

  // Update database
  db.markOperationUndone(id);
  db.updateFilePath(destination, source);

  return {
    success: true,
    operationId: id,
    type: 'move',
  };
}

async function undoCopy(
  db: Database,
  operation: OperationRecord
): Promise<UndoResult> {
  const { id, destination } = operation;

  if (!destination) {
    return {
      success: false,
      operationId: id,
      type: 'copy',
      error: 'No destination recorded',
    };
  }

  // Check if copied file still exists
  if (!await exists(destination)) {
    // File already deleted, mark as undone
    db.markOperationUndone(id);
    return {
      success: true,
      operationId: id,
      type: 'copy',
    };
  }

  // Delete the copy
  await unlink(destination);

  // Update database
  db.markOperationUndone(id);
  db.deleteFile(destination);

  return {
    success: true,
    operationId: id,
    type: 'copy',
  };
}

async function undoRename(
  db: Database,
  operation: OperationRecord
): Promise<UndoResult> {
  // Rename is just a move within the same directory
  return undoMove(db, operation);
}

async function undoDelete(
  db: Database,
  operation: OperationRecord
): Promise<UndoResult> {
  const { id, destination } = operation;

  // destination contains the trash path for deletes
  if (!destination || destination === 'trash') {
    return {
      success: false,
      operationId: id,
      type: 'delete',
      error: 'Cannot automatically restore from trash',
    };
  }

  // Check if file is still in trash
  if (!await exists(destination)) {
    return {
      success: false,
      operationId: id,
      type: 'delete',
      error: 'File no longer in trash',
    };
  }

  const { source } = operation;

  // Ensure original directory exists
  await ensureDir(dirname(source));

  // Restore from trash
  await rename(destination, source);

  // Update database
  db.markOperationUndone(id);

  return {
    success: true,
    operationId: id,
    type: 'delete',
  };
}

export async function undoLast(db: Database): Promise<UndoResult | null> {
  const operations = db.getOperations(1);

  if (operations.length === 0) {
    return null;
  }

  const lastOp = operations[0];

  if (lastOp.undoneAt) {
    return {
      success: false,
      operationId: lastOp.id,
      type: lastOp.type,
      error: 'Last operation already undone',
    };
  }

  return undoOperation(db, lastOp.id);
}

export async function undoMultiple(
  db: Database,
  operationIds: number[]
): Promise<UndoResult[]> {
  const results: UndoResult[] = [];

  // Undo in reverse order (newest first)
  const sortedIds = [...operationIds].sort((a, b) => b - a);

  for (const id of sortedIds) {
    const result = await undoOperation(db, id);
    results.push(result);
  }

  return results;
}

export function getUndoableOperations(
  db: Database,
  limit = 50
): OperationRecord[] {
  const operations = db.getOperations(limit);

  return operations.filter(op => !op.undoneAt);
}
