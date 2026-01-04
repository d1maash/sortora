import { dirname } from 'path';
import { type Config, expandPath } from '../config.js';
import type { FileAnalysis } from './analyzer.js';
import { interpolatePath } from '../utils/paths.js';

export interface Rule {
  name: string;
  priority: number;
  match: {
    extension?: string[];
    filename?: string[];
    type?: string;
    hasExif?: boolean;
    contentContains?: string[];
    location?: string;
    age?: string;
    accessed?: string;
  };
  useAi?: boolean;
  action: {
    moveTo?: string;
    suggestTo?: string;
    archiveTo?: string;
    delete?: boolean;
    confirm?: boolean;
  };
}

export interface RuleMatch {
  rule: Rule;
  confidence: number;
  destination?: string;
}

export class RuleEngine {
  private rules: Rule[];
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.rules = [...config.rules, ...this.getDefaultRules()];
    this.sortRulesByPriority();
  }

  private sortRulesByPriority(): void {
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  match(file: FileAnalysis): RuleMatch | null {
    for (const rule of this.rules) {
      const match = this.matchRule(file, rule);
      if (match) {
        const destination = this.resolveDestination(file, rule);
        return {
          rule,
          confidence: match.confidence,
          destination,
        };
      }
    }
    return null;
  }

  matchAll(file: FileAnalysis): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const rule of this.rules) {
      const match = this.matchRule(file, rule);
      if (match) {
        const destination = this.resolveDestination(file, rule);
        matches.push({
          rule,
          confidence: match.confidence,
          destination,
        });
      }
    }

    return matches;
  }

  private matchRule(
    file: FileAnalysis,
    rule: Rule
  ): { confidence: number } | null {
    let matchCount = 0;
    let totalConditions = 0;

    // Extension match
    if (rule.match.extension && rule.match.extension.length > 0) {
      totalConditions++;
      if (rule.match.extension.includes(file.extension.toLowerCase())) {
        matchCount++;
      } else {
        return null; // Extension is required
      }
    }

    // Filename pattern match
    if (rule.match.filename && rule.match.filename.length > 0) {
      totalConditions++;
      const matched = rule.match.filename.some(pattern =>
        this.matchGlob(file.filename, pattern)
      );
      if (matched) {
        matchCount++;
      }
    }

    // Type/category match
    if (rule.match.type) {
      totalConditions++;
      if (file.category === rule.match.type) {
        matchCount++;
      } else {
        return null; // Type is required
      }
    }

    // EXIF check
    if (rule.match.hasExif !== undefined) {
      totalConditions++;
      const hasExif = file.metadata && 'dateTaken' in file.metadata;
      if (hasExif === rule.match.hasExif) {
        matchCount++;
      }
    }

    // Content contains
    if (rule.match.contentContains && rule.match.contentContains.length > 0) {
      totalConditions++;
      if (file.textContent) {
        const lowerContent = file.textContent.toLowerCase();
        const matched = rule.match.contentContains.some(term =>
          lowerContent.includes(term.toLowerCase())
        );
        if (matched) {
          matchCount++;
        }
      }
    }

    // Location match
    if (rule.match.location) {
      totalConditions++;
      const fileDir = dirname(file.path);
      const targetDir = expandPath(rule.match.location);
      if (fileDir.startsWith(targetDir)) {
        matchCount++;
      } else {
        return null; // Location is required
      }
    }

    // Age check
    if (rule.match.age) {
      totalConditions++;
      const ageMatch = this.matchAge(file.modified, rule.match.age);
      if (ageMatch) {
        matchCount++;
      }
    }

    // Access time check
    if (rule.match.accessed) {
      totalConditions++;
      const accessMatch = this.matchAge(file.accessed, rule.match.accessed);
      if (accessMatch) {
        matchCount++;
      }
    }

    // Need at least one match
    if (matchCount === 0 && totalConditions === 0) {
      return null;
    }

    // Calculate confidence
    const confidence = totalConditions > 0 ? matchCount / totalConditions : 0.5;

    return { confidence };
  }

  private matchGlob(filename: string, pattern: string): boolean {
    const regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${regex}$`, 'i').test(filename);
  }

  private matchAge(date: Date, ageSpec: string): boolean {
    const now = new Date();
    const ageMs = now.getTime() - date.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // Parse age spec like "> 30 days" or "< 7 days"
    const match = ageSpec.match(/([<>])\s*(\d+)\s*(days?|weeks?|months?|years?)/i);
    if (!match) return false;

    const [, operator, value, unit] = match;
    let targetDays = parseInt(value);

    switch (unit.toLowerCase()) {
      case 'week':
      case 'weeks':
        targetDays *= 7;
        break;
      case 'month':
      case 'months':
        targetDays *= 30;
        break;
      case 'year':
      case 'years':
        targetDays *= 365;
        break;
    }

    if (operator === '>') {
      return ageDays > targetDays;
    } else {
      return ageDays < targetDays;
    }
  }

  private resolveDestination(file: FileAnalysis, rule: Rule): string | undefined {
    const destTemplate = rule.action.moveTo || rule.action.suggestTo || rule.action.archiveTo;

    if (!destTemplate) {
      return undefined;
    }

    // Build variables for interpolation
    const now = new Date();
    const year = this.getFileYear(file) || now.getFullYear();
    const month = this.getFileMonth(file) || now.getMonth() + 1;

    const variables: Record<string, string | number> = {
      year,
      month: month.toString().padStart(2, '0'),
      filename: file.filename,
      extension: file.extension,
      category: file.category,
    };

    // Add destinations from config
    for (const [key, value] of Object.entries(this.config.destinations)) {
      variables[`destinations.${key}`] = value;
    }

    // Add metadata variables
    if (file.metadata) {
      const meta = file.metadata as Record<string, unknown>;

      if (meta.dateTaken instanceof Date) {
        variables['exif.year'] = meta.dateTaken.getFullYear();
        variables['exif.month'] = (meta.dateTaken.getMonth() + 1).toString().padStart(2, '0');
      }

      if (typeof meta.artist === 'string') {
        variables['audio.artist'] = this.sanitizePath(meta.artist);
      }
      if (typeof meta.album === 'string') {
        variables['audio.album'] = this.sanitizePath(meta.album);
      }
    }

    // Interpolate and expand path
    let result = interpolatePath(destTemplate, variables);
    result = expandPath(result);

    return result;
  }

  private getFileYear(file: FileAnalysis): number | null {
    if (file.metadata) {
      const meta = file.metadata as Record<string, unknown>;
      if (meta.dateTaken instanceof Date) {
        return meta.dateTaken.getFullYear();
      }
      if (typeof meta.year === 'number') {
        return meta.year;
      }
    }
    return file.modified.getFullYear();
  }

  private getFileMonth(file: FileAnalysis): number | null {
    if (file.metadata) {
      const meta = file.metadata as Record<string, unknown>;
      if (meta.dateTaken instanceof Date) {
        return meta.dateTaken.getMonth() + 1;
      }
    }
    return file.modified.getMonth() + 1;
  }

  private sanitizePath(str: string): string {
    return str
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getDefaultRules(): Rule[] {
    return [
      {
        name: 'Screenshots',
        priority: 100,
        match: {
          extension: ['png', 'jpg'],
          filename: ['Screenshot*', 'Снимок*', 'Screen Shot*', 'Capture*'],
        },
        action: {
          moveTo: '{destinations.screenshots}/{year}-{month}/',
        },
      },
      {
        name: 'Photos with EXIF',
        priority: 90,
        match: {
          extension: ['jpg', 'jpeg', 'heic', 'raw', 'cr2', 'nef', 'arw', 'dng'],
          hasExif: true,
        },
        action: {
          moveTo: '{destinations.photos}/{exif.year}/{exif.month}/',
        },
      },
      {
        name: 'Other images',
        priority: 80,
        match: {
          type: 'image',
        },
        action: {
          suggestTo: '{destinations.photos}/Unsorted/',
        },
      },
      {
        name: 'PDF documents',
        priority: 70,
        match: {
          extension: ['pdf'],
        },
        action: {
          suggestTo: '{destinations.documents}/{year}/',
        },
      },
      {
        name: 'Office documents',
        priority: 70,
        match: {
          extension: ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'],
        },
        action: {
          suggestTo: '{destinations.documents}/{year}/',
        },
      },
      {
        name: 'Music files',
        priority: 85,
        match: {
          extension: ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a'],
        },
        action: {
          moveTo: '{destinations.music}/{audio.artist}/{audio.album}/',
        },
      },
      {
        name: 'Video files',
        priority: 85,
        match: {
          extension: ['mp4', 'mkv', 'avi', 'mov', 'webm'],
        },
        action: {
          suggestTo: '{destinations.video}/{year}/',
        },
      },
      {
        name: 'Archives',
        priority: 75,
        match: {
          extension: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
        },
        action: {
          suggestTo: '{destinations.archives}/',
        },
      },
      {
        name: 'Old installers',
        priority: 100,
        match: {
          extension: ['dmg', 'pkg', 'exe', 'msi'],
          age: '> 30 days',
        },
        action: {
          delete: true,
          confirm: true,
        },
      },
      {
        name: 'Temporary files',
        priority: 100,
        match: {
          extension: ['tmp', 'temp', 'bak', 'swp'],
        },
        action: {
          delete: true,
        },
      },
    ];
  }

  getRules(): Rule[] {
    return this.rules;
  }

  addRule(rule: Rule): void {
    this.rules.push(rule);
    this.sortRulesByPriority();
  }

  removeRule(name: string): boolean {
    const index = this.rules.findIndex(r => r.name === name);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }
}
