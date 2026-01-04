import { dirname, basename } from 'path';
import { stat } from 'fs/promises';
import { hashFile, hashFileQuick } from '../utils/file-hash.js';
import { deleteFile, type DeleteResult } from './delete.js';
import { exists } from '../utils/fs-safe.js';

export interface DuplicateGroup {
  hash: string;
  size: number;
  files: DuplicateFile[];
}

export interface DuplicateFile {
  path: string;
  size: number;
  modified: Date;
  isOriginal: boolean;
}

export interface DeduplicateOptions {
  keepStrategy: 'oldest' | 'newest' | 'first' | 'largest';
  toTrash?: boolean;
  dryRun?: boolean;
}

export interface DeduplicateResult {
  groups: number;
  duplicatesFound: number;
  duplicatesRemoved: number;
  spaceRecovered: number;
  errors: string[];
  removedFiles: string[];
  keptFiles: string[];
}

export async function findDuplicates(
  files: string[],
  useQuickHash = true
): Promise<DuplicateGroup[]> {
  // First, group by size
  const sizeGroups = new Map<number, string[]>();

  for (const file of files) {
    try {
      const stats = await stat(file);
      const size = stats.size;

      const group = sizeGroups.get(size) || [];
      group.push(file);
      sizeGroups.set(size, group);
    } catch {
      // Skip inaccessible files
    }
  }

  // Then, hash files with same size
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [size, group] of sizeGroups) {
    if (group.length < 2) continue;

    const hashGroups = new Map<string, DuplicateFile[]>();

    for (const filePath of group) {
      try {
        const hash = useQuickHash
          ? await hashFileQuick(filePath)
          : await hashFile(filePath);

        const stats = await stat(filePath);
        const fileInfo: DuplicateFile = {
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
          isOriginal: false,
        };

        const existing = hashGroups.get(hash) || [];
        existing.push(fileInfo);
        hashGroups.set(hash, existing);
      } catch {
        // Skip files that can't be hashed
      }
    }

    // Keep only groups with duplicates
    for (const [hash, fileGroup] of hashGroups) {
      if (fileGroup.length > 1) {
        duplicateGroups.push({
          hash,
          size,
          files: fileGroup,
        });
      }
    }
  }

  // Sort by total wasted space
  duplicateGroups.sort((a, b) => {
    const wastedA = a.size * (a.files.length - 1);
    const wastedB = b.size * (b.files.length - 1);
    return wastedB - wastedA;
  });

  return duplicateGroups;
}

export async function deduplicate(
  groups: DuplicateGroup[],
  options: DeduplicateOptions
): Promise<DeduplicateResult> {
  const result: DeduplicateResult = {
    groups: groups.length,
    duplicatesFound: 0,
    duplicatesRemoved: 0,
    spaceRecovered: 0,
    errors: [],
    removedFiles: [],
    keptFiles: [],
  };

  for (const group of groups) {
    result.duplicatesFound += group.files.length - 1;

    // Determine which file to keep
    const fileToKeep = selectFileToKeep(group.files, options.keepStrategy);
    result.keptFiles.push(fileToKeep.path);

    // Mark the original
    for (const file of group.files) {
      file.isOriginal = file.path === fileToKeep.path;
    }

    // Remove duplicates
    for (const file of group.files) {
      if (file.isOriginal) continue;

      if (options.dryRun) {
        result.duplicatesRemoved++;
        result.spaceRecovered += file.size;
        result.removedFiles.push(file.path);
        continue;
      }

      const deleteResult = await deleteFile(file.path, {
        toTrash: options.toTrash ?? true,
      });

      if (deleteResult.success) {
        result.duplicatesRemoved++;
        result.spaceRecovered += file.size;
        result.removedFiles.push(file.path);
      } else {
        result.errors.push(`${file.path}: ${deleteResult.error}`);
      }
    }
  }

  return result;
}

function selectFileToKeep(
  files: DuplicateFile[],
  strategy: DeduplicateOptions['keepStrategy']
): DuplicateFile {
  switch (strategy) {
    case 'oldest':
      return files.reduce((oldest, file) =>
        file.modified < oldest.modified ? file : oldest
      );

    case 'newest':
      return files.reduce((newest, file) =>
        file.modified > newest.modified ? file : newest
      );

    case 'largest':
      return files.reduce((largest, file) =>
        file.size > largest.size ? file : largest
      );

    case 'first':
    default:
      return files[0];
  }
}

export function calculateWastedSpace(groups: DuplicateGroup[]): number {
  let total = 0;

  for (const group of groups) {
    // All but one file in each group is "wasted"
    total += group.size * (group.files.length - 1);
  }

  return total;
}

export function formatDuplicateStats(groups: DuplicateGroup[]): {
  totalGroups: number;
  totalDuplicates: number;
  wastedSpace: number;
  largestGroup: number;
} {
  let totalDuplicates = 0;
  let largestGroup = 0;

  for (const group of groups) {
    const duplicatesInGroup = group.files.length - 1;
    totalDuplicates += duplicatesInGroup;

    if (group.files.length > largestGroup) {
      largestGroup = group.files.length;
    }
  }

  return {
    totalGroups: groups.length,
    totalDuplicates,
    wastedSpace: calculateWastedSpace(groups),
    largestGroup,
  };
}
