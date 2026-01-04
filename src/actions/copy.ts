import { dirname, basename, join } from 'path';
import { copyFile as fsCopyFile } from 'fs/promises';
import { ensureDir, exists } from '../utils/fs-safe.js';

export interface CopyOptions {
  overwrite?: boolean;
  createDestDir?: boolean;
  preserveTimestamps?: boolean;
}

export interface CopyResult {
  success: boolean;
  source: string;
  destination: string;
  error?: string;
}

export async function copyFile(
  source: string,
  destination: string,
  options: CopyOptions = {}
): Promise<CopyResult> {
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

    // Copy file
    await fsCopyFile(source, finalDest);

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

export async function copyFiles(
  files: { source: string; destination: string }[],
  options: CopyOptions = {}
): Promise<CopyResult[]> {
  const results: CopyResult[] = [];

  for (const { source, destination } of files) {
    const result = await copyFile(source, destination, options);
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

export async function copyToFolder(
  source: string,
  destFolder: string,
  options: CopyOptions = {}
): Promise<CopyResult> {
  const filename = basename(source);
  const destination = join(destFolder, filename);

  return copyFile(source, destination, options);
}

export async function duplicateFile(
  source: string,
  options: CopyOptions = {}
): Promise<CopyResult> {
  const dir = dirname(source);
  const name = basename(source);
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;

  const destination = join(dir, `${base} copy${ext}`);

  return copyFile(source, destination, options);
}
