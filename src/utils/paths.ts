import { homedir } from 'os';
import { join, dirname, basename, extname, parse, relative, resolve, normalize } from 'path';

export function expandTilde(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  if (path.startsWith('$HOME/')) {
    return join(homedir(), path.slice(6));
  }
  return path;
}

export function contractTilde(path: string): string {
  const home = homedir();
  if (path.startsWith(home)) {
    return '~' + path.slice(home.length);
  }
  return path;
}

export function getFilename(path: string): string {
  return basename(path);
}

export function getExtension(path: string): string {
  const ext = extname(path).toLowerCase();
  return ext.startsWith('.') ? ext.slice(1) : ext;
}

export function getDirectory(path: string): string {
  return dirname(path);
}

export function getBasename(path: string): string {
  const parsed = parse(path);
  return parsed.name;
}

export function joinPaths(...paths: string[]): string {
  return join(...paths);
}

export function resolvePath(...paths: string[]): string {
  return resolve(...paths);
}

export function normalizePath(path: string): string {
  return normalize(path);
}

export function relativePath(from: string, to: string): string {
  return relative(from, to);
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/') || path.startsWith('~');
}

export function ensureAbsolute(path: string, base?: string): string {
  const expanded = expandTilde(path);
  if (isAbsolute(expanded)) {
    return resolvePath(expanded);
  }
  return resolvePath(base || process.cwd(), expanded);
}

export function interpolatePath(
  template: string,
  variables: Record<string, string | number | undefined>
): string {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const keys = key.split('.');
    let value: unknown = variables;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return match;
      }
    }

    return value !== undefined ? String(value) : match;
  });
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

export function generateUniqueFilename(basePath: string, filename: string): string {
  const { existsSync } = require('fs');
  const ext = extname(filename);
  const name = basename(filename, ext);
  let counter = 1;
  let newPath = join(basePath, filename);

  while (existsSync(newPath)) {
    newPath = join(basePath, `${name} (${counter})${ext}`);
    counter++;
  }

  return newPath;
}
