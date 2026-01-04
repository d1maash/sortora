import { basename, join } from 'path';
import { unlink, rename } from 'fs/promises';
import { platform, homedir } from 'os';
import { exists, ensureDir } from '../utils/fs-safe.js';

export interface DeleteOptions {
  toTrash?: boolean;
  permanent?: boolean;
}

export interface DeleteResult {
  success: boolean;
  path: string;
  trashPath?: string;
  error?: string;
}

export async function deleteFile(
  path: string,
  options: DeleteOptions = {}
): Promise<DeleteResult> {
  const { toTrash = true, permanent = false } = options;

  try {
    // Check if file exists
    if (!await exists(path)) {
      return {
        success: false,
        path,
        error: 'File does not exist',
      };
    }

    if (permanent || !toTrash) {
      // Permanent delete
      await unlink(path);

      return {
        success: true,
        path,
      };
    }

    // Move to trash
    const trashPath = await moveToTrash(path);

    return {
      success: true,
      path,
      trashPath,
    };
  } catch (error) {
    return {
      success: false,
      path,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function deleteFiles(
  paths: string[],
  options: DeleteOptions = {}
): Promise<DeleteResult[]> {
  const results: DeleteResult[] = [];

  for (const path of paths) {
    const result = await deleteFile(path, options);
    results.push(result);
  }

  return results;
}

async function moveToTrash(filePath: string): Promise<string> {
  const trashDir = getTrashDirectory();
  await ensureDir(trashDir);

  const filename = basename(filePath);
  const timestamp = Date.now();
  const trashPath = join(trashDir, `${timestamp}-${filename}`);

  // Try atomic rename first
  try {
    await rename(filePath, trashPath);
  } catch (error) {
    // Cross-device: copy then delete would be needed
    // For simplicity, just throw the error
    throw error;
  }

  return trashPath;
}

function getTrashDirectory(): string {
  const os = platform();

  if (os === 'darwin') {
    // macOS
    return join(homedir(), '.Trash');
  }

  if (os === 'linux') {
    // Linux - follow XDG spec
    const xdgDataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
    return join(xdgDataHome, 'Trash', 'files');
  }

  if (os === 'win32') {
    // Windows - use app-specific trash
    return join(homedir(), '.sortora-trash');
  }

  // Fallback
  return join(homedir(), '.sortora-trash');
}

export async function emptyTrash(): Promise<{ deleted: number; errors: string[] }> {
  const trashDir = getTrashDirectory();

  if (!await exists(trashDir)) {
    return { deleted: 0, errors: [] };
  }

  const { readdir } = await import('fs/promises');
  const files = await readdir(trashDir);

  let deleted = 0;
  const errors: string[] = [];

  for (const file of files) {
    const filePath = join(trashDir, file);

    try {
      await unlink(filePath);
      deleted++;
    } catch (error) {
      errors.push(`${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { deleted, errors };
}

export async function getTrashContents(): Promise<{
  files: { name: string; originalName: string; deletedAt: Date }[];
  totalSize: number;
}> {
  const trashDir = getTrashDirectory();

  if (!await exists(trashDir)) {
    return { files: [], totalSize: 0 };
  }

  const { readdir, stat } = await import('fs/promises');
  const entries = await readdir(trashDir);

  const files: { name: string; originalName: string; deletedAt: Date }[] = [];
  let totalSize = 0;

  for (const entry of entries) {
    const filePath = join(trashDir, entry);

    try {
      const stats = await stat(filePath);
      totalSize += stats.size;

      // Parse timestamp and original name from trash filename
      const match = entry.match(/^(\d+)-(.+)$/);
      if (match) {
        const timestamp = parseInt(match[1]);
        const originalName = match[2];

        files.push({
          name: entry,
          originalName,
          deletedAt: new Date(timestamp),
        });
      } else {
        files.push({
          name: entry,
          originalName: entry,
          deletedAt: stats.mtime,
        });
      }
    } catch {
      // Skip inaccessible files
    }
  }

  // Sort by deletion date, newest first
  files.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

  return { files, totalSize };
}

export async function restoreFromTrash(
  trashFilename: string,
  destination: string
): Promise<DeleteResult> {
  const trashDir = getTrashDirectory();
  const trashPath = join(trashDir, trashFilename);

  try {
    if (!await exists(trashPath)) {
      return {
        success: false,
        path: trashPath,
        error: 'File not found in trash',
      };
    }

    // Ensure destination directory exists
    const { dirname } = await import('path');
    await ensureDir(dirname(destination));

    // Move from trash to destination
    await rename(trashPath, destination);

    return {
      success: true,
      path: destination,
    };
  } catch (error) {
    return {
      success: false,
      path: trashPath,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
