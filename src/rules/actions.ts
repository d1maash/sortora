import { join, dirname, basename, extname } from 'path';
import { expandPath, type Config } from '../config.js';
import { interpolatePath } from '../utils/paths.js';
import type { FileAnalysis } from '../core/analyzer.js';
import type { ParsedRule } from './parser.js';

export type ActionType = 'move' | 'copy' | 'delete' | 'archive' | 'rename' | 'tag';

export interface ResolvedAction {
  type: ActionType;
  destination?: string;
  newName?: string;
  tags?: string[];
  requiresConfirmation: boolean;
}

export function resolveAction(
  file: FileAnalysis,
  rule: ParsedRule,
  config: Config
): ResolvedAction | null {
  const action = rule.action;

  // Build variables for path interpolation
  const variables = buildVariables(file, config);

  // Determine action type and destination
  if (action.delete) {
    return {
      type: 'delete',
      requiresConfirmation: action.confirm ?? true,
    };
  }

  if (action.moveTo) {
    const dest = resolvePath(action.moveTo, file.filename, variables);
    return {
      type: 'move',
      destination: dest,
      requiresConfirmation: action.confirm ?? false,
    };
  }

  if (action.copyTo) {
    const dest = resolvePath(action.copyTo, file.filename, variables);
    return {
      type: 'copy',
      destination: dest,
      requiresConfirmation: action.confirm ?? false,
    };
  }

  if (action.suggestTo) {
    const dest = resolvePath(action.suggestTo, file.filename, variables);
    return {
      type: 'move',
      destination: dest,
      requiresConfirmation: true, // Always confirm suggestions
    };
  }

  if (action.archiveTo) {
    const dest = resolvePath(action.archiveTo, file.filename, variables);
    return {
      type: 'archive',
      destination: dest,
      requiresConfirmation: action.confirm ?? false,
    };
  }

  if (action.rename) {
    const newName = interpolatePath(action.rename, variables);
    return {
      type: 'rename',
      newName,
      requiresConfirmation: action.confirm ?? true,
    };
  }

  if (action.tag && action.tag.length > 0) {
    return {
      type: 'tag',
      tags: action.tag,
      requiresConfirmation: false,
    };
  }

  return null;
}

function buildVariables(
  file: FileAnalysis,
  config: Config
): Record<string, string | number> {
  const now = new Date();
  const fileDate = getFileDate(file);

  const variables: Record<string, string | number> = {
    // File info
    filename: file.filename,
    basename: basename(file.filename, extname(file.filename)),
    extension: file.extension,
    category: file.category,
    size: file.size,

    // Dates
    year: fileDate.getFullYear(),
    month: (fileDate.getMonth() + 1).toString().padStart(2, '0'),
    day: fileDate.getDate().toString().padStart(2, '0'),

    // Current date
    'now.year': now.getFullYear(),
    'now.month': (now.getMonth() + 1).toString().padStart(2, '0'),
    'now.day': now.getDate().toString().padStart(2, '0'),
  };

  // Add destinations from config
  for (const [key, value] of Object.entries(config.destinations)) {
    variables[`destinations.${key}`] = value;
  }

  // Add metadata variables if available
  if (file.metadata) {
    const meta = file.metadata as Record<string, unknown>;

    // EXIF data
    if (meta.dateTaken instanceof Date) {
      variables['exif.year'] = meta.dateTaken.getFullYear();
      variables['exif.month'] = (meta.dateTaken.getMonth() + 1).toString().padStart(2, '0');
      variables['exif.day'] = meta.dateTaken.getDate().toString().padStart(2, '0');
    }

    if (typeof meta.camera === 'string') {
      variables['exif.camera'] = sanitizeForPath(meta.camera);
    }

    // Audio metadata
    if (typeof meta.artist === 'string') {
      variables['audio.artist'] = sanitizeForPath(meta.artist);
    }
    if (typeof meta.album === 'string') {
      variables['audio.album'] = sanitizeForPath(meta.album);
    }
    if (typeof meta.title === 'string') {
      variables['audio.title'] = sanitizeForPath(meta.title);
    }
    if (typeof meta.year === 'number') {
      variables['audio.year'] = meta.year;
    }

    // Document metadata
    if (typeof meta.author === 'string') {
      variables['doc.author'] = sanitizeForPath(meta.author);
    }
    if (typeof meta.title === 'string') {
      variables['doc.title'] = sanitizeForPath(meta.title);
    }
  }

  return variables;
}

function getFileDate(file: FileAnalysis): Date {
  // Try metadata date first
  if (file.metadata) {
    const meta = file.metadata as Record<string, unknown>;

    if (meta.dateTaken instanceof Date) {
      return meta.dateTaken;
    }
    if (meta.creationDate instanceof Date) {
      return meta.creationDate;
    }
  }

  // Fall back to file modification date
  return file.modified;
}

function resolvePath(
  template: string,
  filename: string,
  variables: Record<string, string | number>
): string {
  let result = interpolatePath(template, variables);
  result = expandPath(result);

  // If template doesn't include filename, append it
  if (!result.includes(filename)) {
    result = join(result, filename);
  }

  return result;
}

function sanitizeForPath(str: string): string {
  return str
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100); // Limit length
}

export function formatAction(action: ResolvedAction): string {
  switch (action.type) {
    case 'move':
      return `Move to ${action.destination}`;
    case 'copy':
      return `Copy to ${action.destination}`;
    case 'delete':
      return 'Delete (move to trash)';
    case 'archive':
      return `Archive to ${action.destination}`;
    case 'rename':
      return `Rename to ${action.newName}`;
    case 'tag':
      return `Add tags: ${action.tags?.join(', ')}`;
    default:
      return 'Unknown action';
  }
}

export function getActionIcon(type: ActionType): string {
  const icons: Record<ActionType, string> = {
    move: '📦',
    copy: '📋',
    delete: '🗑️',
    archive: '🗄️',
    rename: '✏️',
    tag: '🏷️',
  };
  return icons[type] || '❓';
}
