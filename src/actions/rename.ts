import { dirname, basename, join, extname } from 'path';
import { rename } from 'fs/promises';
import { exists } from '../utils/fs-safe.js';

export interface RenameOptions {
  overwrite?: boolean;
  preserveExtension?: boolean;
}

export interface RenameResult {
  success: boolean;
  source: string;
  destination: string;
  error?: string;
}

export async function renameFile(
  source: string,
  newName: string,
  options: RenameOptions = {}
): Promise<RenameResult> {
  const { overwrite = false, preserveExtension = true } = options;

  try {
    // Check if source exists
    if (!await exists(source)) {
      return {
        success: false,
        source,
        destination: '',
        error: 'Source file does not exist',
      };
    }

    const dir = dirname(source);
    let finalName = newName;

    // Preserve extension if requested
    if (preserveExtension) {
      const currentExt = extname(source);
      const newExt = extname(newName);

      if (!newExt && currentExt) {
        finalName = newName + currentExt;
      }
    }

    const destination = join(dir, finalName);

    // Check for collision
    if (!overwrite && source !== destination && await exists(destination)) {
      return {
        success: false,
        source,
        destination,
        error: 'Destination file already exists',
      };
    }

    // Rename file
    await rename(source, destination);

    return {
      success: true,
      source,
      destination,
    };
  } catch (error) {
    return {
      success: false,
      source,
      destination: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function batchRename(
  files: string[],
  pattern: string | ((filename: string, index: number) => string),
  options: RenameOptions = {}
): Promise<RenameResult[]> {
  const results: RenameResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const source = files[i];
    const currentName = basename(source);

    let newName: string;
    if (typeof pattern === 'function') {
      newName = pattern(currentName, i);
    } else {
      newName = applyRenamePattern(currentName, pattern, i);
    }

    const result = await renameFile(source, newName, options);
    results.push(result);
  }

  return results;
}

function applyRenamePattern(
  filename: string,
  pattern: string,
  index: number
): string {
  const ext = extname(filename);
  const base = basename(filename, ext);

  return pattern
    .replace('{name}', base)
    .replace('{ext}', ext)
    .replace('{n}', String(index + 1))
    .replace('{nn}', String(index + 1).padStart(2, '0'))
    .replace('{nnn}', String(index + 1).padStart(3, '0'));
}

export async function addPrefix(
  source: string,
  prefix: string,
  options: RenameOptions = {}
): Promise<RenameResult> {
  const currentName = basename(source);
  const newName = prefix + currentName;

  return renameFile(source, newName, options);
}

export async function addSuffix(
  source: string,
  suffix: string,
  options: RenameOptions = {}
): Promise<RenameResult> {
  const currentName = basename(source);
  const ext = extname(currentName);
  const base = basename(currentName, ext);
  const newName = base + suffix + ext;

  return renameFile(source, newName, options);
}

export async function replaceInName(
  source: string,
  search: string | RegExp,
  replace: string,
  options: RenameOptions = {}
): Promise<RenameResult> {
  const currentName = basename(source);
  const newName = currentName.replace(search, replace);

  if (newName === currentName) {
    return {
      success: true,
      source,
      destination: source,
    };
  }

  return renameFile(source, newName, options);
}

export async function changeExtension(
  source: string,
  newExtension: string,
  options: Omit<RenameOptions, 'preserveExtension'> = {}
): Promise<RenameResult> {
  const currentName = basename(source);
  const base = basename(currentName, extname(currentName));
  const ext = newExtension.startsWith('.') ? newExtension : '.' + newExtension;
  const newName = base + ext;

  return renameFile(source, newName, { ...options, preserveExtension: false });
}
