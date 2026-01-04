import { dirname, basename, join } from 'path';
import { rename, copyFile, unlink } from 'fs/promises';
import { ensureDir, exists } from '../utils/fs-safe.js';

export interface MoveOptions {
  overwrite?: boolean;
  createDestDir?: boolean;
}

export interface MoveResult {
  success: boolean;
  source: string;
  destination: string;
  error?: string;
}

export async function moveFile(
  source: string,
  destination: string,
  options: MoveOptions = {}
): Promise<MoveResult> {
  const { overwrite = false, createDestDir = true } = options;

  try {
    // Check if source exists
    if (!await exists(source)) {
      return {
        success: false,
        source,
        destination,
        error: 'Source file does not exist',
      };
    }

    // Create destination directory if needed
    const destDir = dirname(destination);
    if (createDestDir) {
      await ensureDir(destDir);
    }

    // Handle name collision
    let finalDest = destination;
    if (!overwrite && await exists(destination)) {
      finalDest = await generateUniquePath(destination);
    }

    // Try atomic rename first
    try {
      await rename(source, finalDest);
    } catch (error) {
      // Cross-device move: copy then delete
      if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
        await copyFile(source, finalDest);
        await unlink(source);
      } else {
        throw error;
      }
    }

    return {
      success: true,
      source,
      destination: finalDest,
    };
  } catch (error) {
    return {
      success: false,
      source,
      destination,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function moveFiles(
  files: { source: string; destination: string }[],
  options: MoveOptions = {}
): Promise<MoveResult[]> {
  const results: MoveResult[] = [];

  for (const { source, destination } of files) {
    const result = await moveFile(source, destination, options);
    results.push(result);
  }

  return results;
}

async function generateUniquePath(path: string): Promise<string> {
  const dir = dirname(path);
  const name = basename(path);
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;

  let counter = 1;
  let newPath = path;

  while (await exists(newPath)) {
    newPath = join(dir, `${base} (${counter})${ext}`);
    counter++;
  }

  return newPath;
}

export async function moveToFolder(
  source: string,
  destFolder: string,
  options: MoveOptions = {}
): Promise<MoveResult> {
  const filename = basename(source);
  const destination = join(destFolder, filename);

  return moveFile(source, destination, options);
}
