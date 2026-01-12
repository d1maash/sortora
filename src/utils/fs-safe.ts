import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import {
  stat,
  mkdir,
  readdir,
  copyFile,
  rename,
  unlink,
  readFile,
  writeFile,
  access,
  constants,
} from 'fs/promises';
import { dirname, join, basename, extname, resolve, relative, isAbsolute } from 'path';
import { homedir, platform } from 'os';
import { createLogger } from './logger.js';

const logger = createLogger('fs-safe');

/**
 * Validates that a path doesn't escape the allowed base directory
 * Prevents path traversal attacks (e.g., ../../../etc/passwd)
 */
export function validatePath(targetPath: string, baseDir?: string): { valid: boolean; normalized: string; error?: string } {
  // Normalize the path to resolve .. and .
  const normalized = resolve(targetPath);

  // If no base directory specified, just return normalized path
  if (!baseDir) {
    return { valid: true, normalized };
  }

  const normalizedBase = resolve(baseDir);
  const relativePath = relative(normalizedBase, normalized);

  // Check if the path escapes the base directory
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return {
      valid: false,
      normalized,
      error: `Path traversal detected: ${targetPath} escapes base directory ${baseDir}`,
    };
  }

  return { valid: true, normalized };
}

/**
 * Safely parses filename into base and extension
 * Handles edge cases like folders with dots in names
 */
export function parseFilename(filePath: string): { base: string; ext: string } {
  const filename = basename(filePath);
  const dir = dirname(filePath);
  const ext = extname(filename);
  const base = ext ? filename.slice(0, -ext.length) : filename;

  return {
    base: join(dir, base),
    ext,
  };
}

export async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

export function ensureDirSync(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isReadable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isWritable(path: string): Promise<boolean> {
  try {
    await access(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function getFileInfo(path: string): Promise<{
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  isDirectory: boolean;
  isFile: boolean;
  isSymlink: boolean;
} | null> {
  try {
    const stats = await stat(path);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isSymlink: stats.isSymbolicLink(),
    };
  } catch {
    return null;
  }
}

export function getFileInfoSync(path: string): ReturnType<typeof getFileInfo> extends Promise<infer T> ? T : never {
  try {
    const stats = statSync(path);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isSymlink: stats.isSymbolicLink(),
    };
  } catch {
    return null;
  }
}

export async function safeCopy(
  source: string,
  destination: string,
  options: { baseDir?: string } = {}
): Promise<string> {
  // Validate source path
  const sourceValidation = validatePath(source, options.baseDir);
  if (!sourceValidation.valid) {
    throw new Error(sourceValidation.error);
  }

  // Validate destination path
  const destValidation = validatePath(destination, options.baseDir);
  if (!destValidation.valid) {
    throw new Error(destValidation.error);
  }

  const destDir = dirname(destValidation.normalized);
  await ensureDir(destDir);

  // Handle name collision using proper filename parsing
  let finalDest = destValidation.normalized;
  let counter = 1;
  const { base, ext } = parseFilename(destValidation.normalized);

  while (await exists(finalDest)) {
    finalDest = `${base} (${counter})${ext}`;
    counter++;
  }

  await copyFile(sourceValidation.normalized, finalDest);
  logger.debug(`Copied ${source} to ${finalDest}`);
  return finalDest;
}

export async function safeMove(
  source: string,
  destination: string,
  options: { baseDir?: string } = {}
): Promise<string> {
  // Validate source path
  const sourceValidation = validatePath(source, options.baseDir);
  if (!sourceValidation.valid) {
    throw new Error(sourceValidation.error);
  }

  // Validate destination path
  const destValidation = validatePath(destination, options.baseDir);
  if (!destValidation.valid) {
    throw new Error(destValidation.error);
  }

  const destDir = dirname(destValidation.normalized);
  await ensureDir(destDir);

  // Handle name collision using proper filename parsing
  let finalDest = destValidation.normalized;
  let counter = 1;
  const { base, ext } = parseFilename(destValidation.normalized);

  while (await exists(finalDest)) {
    finalDest = `${base} (${counter})${ext}`;
    counter++;
  }

  try {
    await rename(sourceValidation.normalized, finalDest);
  } catch (error) {
    // Cross-device move: copy then delete
    if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
      await copyFile(sourceValidation.normalized, finalDest);
      await unlink(sourceValidation.normalized);
    } else {
      throw error;
    }
  }

  logger.debug(`Moved ${source} to ${finalDest}`);
  return finalDest;
}

export interface TrashInfo {
  originalPath: string;
  trashPath: string;
  timestamp: number;
}

// Map to track trashed files for undo functionality
const trashRegistry = new Map<string, TrashInfo>();

export async function safeDelete(
  path: string,
  toTrash = true
): Promise<TrashInfo | null> {
  if (!await exists(path)) {
    logger.warn(`File not found for deletion: ${path}`);
    return null;
  }

  if (toTrash) {
    const trashPath = getTrashPath();
    await ensureDir(trashPath);

    const filename = basename(path);
    const timestamp = Date.now();
    const trashDest = join(trashPath, `${timestamp}-${filename}`);

    await safeMove(path, trashDest);

    const trashInfo: TrashInfo = {
      originalPath: path,
      trashPath: trashDest,
      timestamp,
    };

    // Register in trash registry for undo
    trashRegistry.set(path, trashInfo);
    logger.debug(`Moved to trash: ${path} -> ${trashDest}`);

    return trashInfo;
  } else {
    await unlink(path);
    logger.debug(`Permanently deleted: ${path}`);
    return null;
  }
}

/**
 * Restore a file from trash to its original location
 */
export async function restoreFromTrash(originalPath: string): Promise<boolean> {
  const trashInfo = trashRegistry.get(originalPath);

  if (!trashInfo) {
    logger.warn(`No trash info found for: ${originalPath}`);
    return false;
  }

  if (!await exists(trashInfo.trashPath)) {
    logger.error(`Trash file not found: ${trashInfo.trashPath}`);
    trashRegistry.delete(originalPath);
    return false;
  }

  try {
    await safeMove(trashInfo.trashPath, trashInfo.originalPath);
    trashRegistry.delete(originalPath);
    logger.debug(`Restored from trash: ${trashInfo.trashPath} -> ${originalPath}`);
    return true;
  } catch (error) {
    logger.error(`Failed to restore from trash: ${error}`);
    return false;
  }
}

/**
 * Get trash info for a file (if it was trashed)
 */
export function getTrashInfo(originalPath: string): TrashInfo | undefined {
  return trashRegistry.get(originalPath);
}

/**
 * Clear old entries from trash registry (cleanup)
 */
export function cleanupTrashRegistry(maxAge = 24 * 60 * 60 * 1000): void {
  const now = Date.now();
  for (const [path, info] of trashRegistry.entries()) {
    if (now - info.timestamp > maxAge) {
      trashRegistry.delete(path);
    }
  }
}

export function getTrashPath(): string {
  const os = platform();

  if (os === 'darwin') {
    return join(homedir(), '.Trash');
  }

  if (os === 'linux') {
    const xdgDataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
    return join(xdgDataHome, 'Trash', 'files');
  }

  // Windows - use sortora's own trash folder
  // Note: Windows Recycle Bin requires Shell32 API which isn't easily accessible from Node.js
  // For proper Windows Recycle Bin support, consider using a native module
  const sortoraTrash = join(homedir(), '.sortora', 'trash');
  return sortoraTrash;
}

/**
 * Get the trash info directory (for Linux XDG compliance)
 */
export function getTrashInfoPath(): string {
  const os = platform();

  if (os === 'linux') {
    const xdgDataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
    return join(xdgDataHome, 'Trash', 'info');
  }

  // For macOS and Windows, info is stored in memory (trashRegistry)
  return getTrashPath();
}

export async function listDirectory(
  dirPath: string,
  options: { recursive?: boolean; includeHidden?: boolean; maxDepth?: number } = {},
  currentDepth = 0,
  visitedPaths = new Set<string>()
): Promise<string[]> {
  const { recursive = false, includeHidden = false, maxDepth = 10 } = options;

  // Prevent infinite recursion
  if (currentDepth > maxDepth) {
    return [];
  }

  // Resolve real path to detect symlink loops
  let realPath: string;
  try {
    const { realpath } = await import('fs/promises');
    realPath = await realpath(dirPath);
  } catch {
    return [];
  }

  if (visitedPaths.has(realPath)) {
    return []; // Already visited, skip to prevent loops
  }
  visitedPaths.add(realPath);

  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return []; // Permission denied or other error
  }

  const files: string[] = [];

  for (const entry of entries) {
    if (!includeHidden && entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = join(dirPath, entry.name);

    // Skip symlinks to avoid infinite loops
    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    } else if (entry.isDirectory() && recursive) {
      try {
        const subFiles = await listDirectory(fullPath, options, currentDepth + 1, visitedPaths);
        files.push(...subFiles);
      } catch {
        // Skip directories that can't be read
      }
    }
  }

  return files;
}

export function listDirectorySync(
  dirPath: string,
  options: { recursive?: boolean; includeHidden?: boolean; maxDepth?: number } = {},
  currentDepth = 0,
  visitedPaths = new Set<string>()
): string[] {
  const { recursive = false, includeHidden = false, maxDepth = 10 } = options;

  // Prevent infinite recursion
  if (currentDepth > maxDepth) {
    return [];
  }

  // Resolve real path to detect symlink loops
  let realPath: string;
  try {
    const { realpathSync } = require('fs');
    realPath = realpathSync(dirPath);
  } catch {
    return [];
  }

  if (visitedPaths.has(realPath)) {
    return []; // Already visited, skip to prevent loops
  }
  visitedPaths.add(realPath);

  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return []; // Permission denied or other error
  }

  const files: string[] = [];

  for (const entry of entries) {
    if (!includeHidden && entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = join(dirPath, entry.name);

    // Skip symlinks to avoid infinite loops
    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    } else if (entry.isDirectory() && recursive) {
      try {
        const subFiles = listDirectorySync(fullPath, options, currentDepth + 1, visitedPaths);
        files.push(...subFiles);
      } catch {
        // Skip directories that can't be read
      }
    }
  }

  return files;
}

export async function readTextFile(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  const dir = dirname(path);
  await ensureDir(dir);
  await writeFile(path, content, 'utf-8');
}

export function readTextFileSync(path: string): string {
  return readFileSync(path, 'utf-8');
}

export function writeTextFileSync(path: string, content: string): void {
  const dir = dirname(path);
  ensureDirSync(dir);
  writeFileSync(path, content, 'utf-8');
}
