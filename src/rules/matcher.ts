import { dirname } from 'path';
import { expandPath } from '../config.js';
import type { FileAnalysis } from '../core/analyzer.js';
import type { ParsedRule } from './parser.js';
import { parseSize, parseAge } from './parser.js';

export interface MatchResult {
  matched: boolean;
  confidence: number;
  matchedConditions: string[];
  failedConditions: string[];
}

export function matchFile(file: FileAnalysis, rule: ParsedRule): MatchResult {
  const matchedConditions: string[] = [];
  const failedConditions: string[] = [];
  let requiredFailed = false;

  const match = rule.match;

  // Extension match (required if specified)
  if (match.extension && match.extension.length > 0) {
    if (match.extension.includes(file.extension.toLowerCase())) {
      matchedConditions.push('extension');
    } else {
      failedConditions.push('extension');
      requiredFailed = true;
    }
  }

  // Filename pattern match
  if (match.filename && match.filename.length > 0) {
    const matched = match.filename.some(pattern => matchGlob(file.filename, pattern));
    if (matched) {
      matchedConditions.push('filename');
    } else {
      failedConditions.push('filename');
    }
  }

  // Type/category match (required if specified)
  if (match.type) {
    if (file.category === match.type) {
      matchedConditions.push('type');
    } else {
      failedConditions.push('type');
      requiredFailed = true;
    }
  }

  // EXIF check
  if (match.hasExif !== undefined) {
    const hasExif = file.metadata && 'dateTaken' in file.metadata;
    if (hasExif === match.hasExif) {
      matchedConditions.push('hasExif');
    } else {
      failedConditions.push('hasExif');
    }
  }

  // Content contains
  if (match.contentContains && match.contentContains.length > 0) {
    if (file.textContent) {
      const lowerContent = file.textContent.toLowerCase();
      const matched = match.contentContains.some(term =>
        lowerContent.includes(term.toLowerCase())
      );
      if (matched) {
        matchedConditions.push('contentContains');
      } else {
        failedConditions.push('contentContains');
      }
    } else {
      failedConditions.push('contentContains');
    }
  }

  // Location match (required if specified)
  if (match.location) {
    const fileDir = dirname(file.path);
    const targetDir = expandPath(match.location);
    if (fileDir.startsWith(targetDir)) {
      matchedConditions.push('location');
    } else {
      failedConditions.push('location');
      requiredFailed = true;
    }
  }

  // Age check
  if (match.age) {
    if (matchAge(file.modified, match.age)) {
      matchedConditions.push('age');
    } else {
      failedConditions.push('age');
    }
  }

  // Access time check
  if (match.accessed) {
    if (matchAge(file.accessed, match.accessed)) {
      matchedConditions.push('accessed');
    } else {
      failedConditions.push('accessed');
    }
  }

  // Size checks
  if (match.size) {
    if (matchSizeExact(file.size, match.size)) {
      matchedConditions.push('size');
    } else {
      failedConditions.push('size');
    }
  }

  if (match.minSize) {
    if (matchSizeMin(file.size, match.minSize)) {
      matchedConditions.push('minSize');
    } else {
      failedConditions.push('minSize');
    }
  }

  if (match.maxSize) {
    if (matchSizeMax(file.size, match.maxSize)) {
      matchedConditions.push('maxSize');
    } else {
      failedConditions.push('maxSize');
    }
  }

  // Determine if matched
  const totalConditions = matchedConditions.length + failedConditions.length;

  if (requiredFailed || totalConditions === 0) {
    return {
      matched: false,
      confidence: 0,
      matchedConditions,
      failedConditions,
    };
  }

  const confidence = matchedConditions.length / totalConditions;

  return {
    matched: matchedConditions.length > 0 && !requiredFailed,
    confidence,
    matchedConditions,
    failedConditions,
  };
}

export function matchGlob(filename: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  return new RegExp(`^${regex}$`, 'i').test(filename);
}

export function matchAge(date: Date, ageSpec: string): boolean {
  const parsed = parseAge(ageSpec);
  if (!parsed) return false;

  const now = new Date();
  const ageMs = now.getTime() - date.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (parsed.operator === '>') {
    return ageDays > parsed.days;
  } else {
    return ageDays < parsed.days;
  }
}

export function matchSizeExact(size: number, sizeSpec: string): boolean {
  const targetSize = parseSize(sizeSpec);
  if (targetSize === null) return false;

  // Allow 10% tolerance
  const tolerance = targetSize * 0.1;
  return Math.abs(size - targetSize) <= tolerance;
}

export function matchSizeMin(size: number, sizeSpec: string): boolean {
  const minSize = parseSize(sizeSpec);
  if (minSize === null) return false;
  return size >= minSize;
}

export function matchSizeMax(size: number, sizeSpec: string): boolean {
  const maxSize = parseSize(sizeSpec);
  if (maxSize === null) return false;
  return size <= maxSize;
}

export function findBestMatch(
  file: FileAnalysis,
  rules: ParsedRule[]
): { rule: ParsedRule; result: MatchResult } | null {
  let bestMatch: { rule: ParsedRule; result: MatchResult } | null = null;

  // Rules should already be sorted by priority
  for (const rule of rules) {
    if (!rule.enabled) continue;

    const result = matchFile(file, rule);

    if (result.matched) {
      if (!bestMatch || result.confidence > bestMatch.result.confidence) {
        bestMatch = { rule, result };
      }
    }
  }

  return bestMatch;
}

export function findAllMatches(
  file: FileAnalysis,
  rules: ParsedRule[]
): { rule: ParsedRule; result: MatchResult }[] {
  const matches: { rule: ParsedRule; result: MatchResult }[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const result = matchFile(file, rule);

    if (result.matched) {
      matches.push({ rule, result });
    }
  }

  // Sort by confidence descending
  matches.sort((a, b) => b.result.confidence - a.result.confidence);

  return matches;
}
