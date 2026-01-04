import {
  existsSync,
  copyFileSync,
  renameSync,
  unlinkSync,
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
import { dirname, join, basename } from 'path';
import { homedir, platform } from 'os';

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

export async function safeCopy(source: string, destination: string): Promise<void> {
  const destDir = dirname(destination);
  await ensureDir(destDir);

  // Handle name collision
  let finalDest = destination;
  let counter = 1;
  const ext = destination.includes('.') ? destination.slice(destination.lastIndexOf('.')) : '';
  const base = destination.includes('.') ? destination.slice(0, destination.lastIndexOf('.')) : destination;

  while (await exists(finalDest)) {
    finalDest = `${base} (${counter})${ext}`;
    counter++;
  }

  await copyFile(source, finalDest);
}

export async function safeMove(source: string, destination: string): Promise<string> {
  const destDir = dirname(destination);
  await ensureDir(destDir);

  // Handle name collision
  let finalDest = destination;
  let counter = 1;
  const ext = destination.includes('.') ? destination.slice(destination.lastIndexOf('.')) : '';
  const base = destination.includes('.') ? destination.slice(0, destination.lastIndexOf('.')) : destination;

  while (await exists(finalDest)) {
    finalDest = `${base} (${counter})${ext}`;
    counter++;
  }

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

  return finalDest;
}

export async function safeDelete(path: string, toTrash = true): Promise<void> {
  if (!await exists(path)) {
    return;
  }

  if (toTrash) {
    const trashPath = getTrashPath();
    await ensureDir(trashPath);

    const filename = basename(path);
    const timestamp = Date.now();
    const trashDest = join(trashPath, `${timestamp}-${filename}`);

    await safeMove(path, trashDest);
  } else {
    await unlink(path);
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

  // Windows - use a local trash folder
  return join(homedir(), '.sortora-trash');
}

export async function listDirectory(
  dirPath: string,
  options: { recursive?: boolean; includeHidden?: boolean } = {}
): Promise<string[]> {
  const { recursive = false, includeHidden = false } = options;
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (!includeHidden && entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = join(dirPath, entry.name);

    if (entry.isFile()) {
      files.push(fullPath);
    } else if (entry.isDirectory() && recursive) {
      const subFiles = await listDirectory(fullPath, options);
      files.push(...subFiles);
    }
  }

  return files;
}

export function listDirectorySync(
  dirPath: string,
  options: { recursive?: boolean; includeHidden?: boolean } = {}
): string[] {
  const { recursive = false, includeHidden = false } = options;
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (!includeHidden && entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = join(dirPath, entry.name);

    if (entry.isFile()) {
      files.push(fullPath);
    } else if (entry.isDirectory() && recursive) {
      const subFiles = listDirectorySync(fullPath, options);
      files.push(...subFiles);
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
