import { dirname, join } from 'path';
import { type Config, expandPath } from '../config.js';
import type { FileAnalysis } from './analyzer.js';
import { interpolatePath } from '../utils/paths.js';
import { analyzeFilename } from '../utils/filename-analyzer.js';

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
  // Local destination for in-place organization
  localDestination?: string;
}

export interface RuleMatch {
  rule: Rule;
  confidence: number;
  destination?: string;
}

export interface MatchOptions {
  baseDir?: string;  // If set, organize within this directory
  useGlobalDestinations?: boolean;  // Use global destinations like ~/Documents
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

  match(file: FileAnalysis, options: MatchOptions = {}): RuleMatch | null {
    for (const rule of this.rules) {
      const match = this.matchRule(file, rule);
      if (match) {
        const destination = this.resolveDestination(file, rule, options);
        return {
          rule,
          confidence: match.confidence,
          destination,
        };
      }
    }
    return null;
  }

  matchAll(file: FileAnalysis, options: MatchOptions = {}): RuleMatch[] {
    const matches: RuleMatch[] = [];

    for (const rule of this.rules) {
      const match = this.matchRule(file, rule);
      if (match) {
        const destination = this.resolveDestination(file, rule, options);
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

    // Filename pattern match (required if specified)
    if (rule.match.filename && rule.match.filename.length > 0) {
      totalConditions++;
      const matched = rule.match.filename.some(pattern =>
        this.matchGlob(file.filename, pattern)
      );
      if (matched) {
        matchCount++;
      } else {
        return null; // Filename pattern is required
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

  private resolveDestination(
    file: FileAnalysis,
    rule: Rule,
    options: MatchOptions = {}
  ): string | undefined {
    const { baseDir, useGlobalDestinations = false } = options;

    // For delete actions, no destination needed
    if (rule.action.delete) {
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

    // LOCAL ORGANIZATION: organize within the specified directory
    if (baseDir && !useGlobalDestinations) {
      const localDest = this.getLocalDestination(file, rule, variables);
      if (localDest) {
        return join(baseDir, localDest);
      }
      return undefined;
    }

    // GLOBAL ORGANIZATION: use configured destinations
    const destTemplate = rule.action.moveTo || rule.action.suggestTo || rule.action.archiveTo;
    if (!destTemplate) {
      return undefined;
    }

    // Add global destinations from config
    for (const [key, value] of Object.entries(this.config.destinations)) {
      variables[`destinations.${key}`] = value;
    }

    // Interpolate and expand path
    let result = interpolatePath(destTemplate, variables);
    result = expandPath(result);

    return result;
  }

  private getLocalDestination(
    file: FileAnalysis,
    rule: Rule,
    variables: Record<string, string | number>
  ): string | undefined {
    // Use rule's localDestination if defined
    if (rule.localDestination) {
      return interpolatePath(rule.localDestination, variables);
    }

    // Use smart filename analysis for documents
    const category = file.category;
    const ruleName = rule.name.toLowerCase();

    // For documents, use smart filename analysis
    if (category === 'document' || ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(file.extension)) {
      const filenameAnalysis = analyzeFilename(file.filename);

      // Use the smart suggested folder from filename analysis
      if (filenameAnalysis.suggestedFolder && filenameAnalysis.suggestedFolder !== 'Documents') {
        return filenameAnalysis.suggestedFolder;
      }
    }

    // For photos with EXIF, organize by date
    if ((ruleName.includes('photo') || category === 'image') && file.metadata) {
      const meta = file.metadata as Record<string, unknown>;
      if (meta.dateTaken instanceof Date) {
        return interpolatePath('Photos/{exif.year}/{exif.month}', variables);
      }
    }

    // For screenshots, use smart analysis
    if (ruleName.includes('screenshot')) {
      const filenameAnalysis = analyzeFilename(file.filename);
      if (filenameAnalysis.year) {
        const month = filenameAnalysis.month?.toString().padStart(2, '0') || variables.month;
        return `Screenshots/${filenameAnalysis.year}-${month}`;
      }
      return interpolatePath('Screenshots/{year}-{month}', variables);
    }

    // For music with metadata
    if (ruleName.includes('music') || ruleName.includes('audio') || category === 'audio') {
      const artist = variables['audio.artist'];
      const album = variables['audio.album'];
      if (artist && album) {
        return `Music/${artist}/${album}`;
      }
      if (artist) {
        return `Music/${artist}`;
      }
      return 'Music/Unsorted';
    }

    // For videos
    if (category === 'video') {
      return interpolatePath('Videos/{year}', variables);
    }

    // For archives
    if (category === 'archive') {
      // Try to detect what's in the archive by name
      const filenameAnalysis = analyzeFilename(file.filename);
      if (filenameAnalysis.entity) {
        return `Archives/${filenameAnalysis.entity}`;
      }
      return 'Archives';
    }

    // For code files - use smart analysis
    if (category === 'code') {
      const filenameAnalysis = analyzeFilename(file.filename);
      if (filenameAnalysis.language) {
        return filenameAnalysis.suggestedFolder;
      }
      return 'Code';
    }

    // For executables/installers
    if (category === 'executable' || ruleName.includes('installer')) {
      return 'Installers';
    }

    // E-books
    if (ruleName.includes('ebook') || ruleName.includes('book')) {
      return 'Books';
    }

    // Fonts
    if (ruleName.includes('font')) {
      return 'Fonts';
    }

    // Design files
    if (ruleName.includes('design')) {
      return 'Design';
    }

    // Torrents
    if (ruleName.includes('torrent')) {
      return 'Torrents';
    }

    // Logs
    if (ruleName.includes('log')) {
      return 'Logs';
    }

    // For other images
    if (category === 'image') {
      return interpolatePath('Images/{year}', variables);
    }

    // Data files
    if (category === 'data') {
      return 'Data';
    }

    // Default fallback - try smart analysis
    const filenameAnalysis = analyzeFilename(file.filename);
    if (filenameAnalysis.suggestedFolder !== 'Other') {
      return filenameAnalysis.suggestedFolder;
    }

    return 'Other';
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
      // Screenshots - highest priority for specific filename patterns
      {
        name: 'Screenshots',
        priority: 100,
        match: {
          extension: ['png', 'jpg', 'jpeg'],
          filename: ['Screenshot*', 'Снимок*', 'Screen Shot*', 'Capture*', 'Снимок экрана*'],
        },
        action: {
          moveTo: '{destinations.screenshots}/{year}-{month}/',
        },
      },

      // Photos with EXIF
      {
        name: 'Photos with EXIF',
        priority: 90,
        match: {
          extension: ['jpg', 'jpeg', 'heic', 'heif', 'raw', 'cr2', 'nef', 'arw', 'dng'],
          hasExif: true,
        },
        action: {
          moveTo: '{destinations.photos}/{exif.year}/{exif.month}/',
        },
      },

      // Design files
      {
        name: 'Design files',
        priority: 85,
        match: {
          extension: ['psd', 'ai', 'sketch', 'fig', 'xd', 'svg'],
        },
        action: {
          suggestTo: '{destinations.photos}/Design/',
        },
      },

      // Code - React/Vue/Svelte components
      {
        name: 'Frontend components',
        priority: 75,
        match: {
          extension: ['jsx', 'tsx', 'vue', 'svelte'],
        },
        action: {
          suggestTo: '{destinations.code}/Components/',
        },
      },

      // Code - Config files
      {
        name: 'Config files',
        priority: 80,
        match: {
          extension: ['json', 'yaml', 'yml', 'toml', 'ini', 'env'],
        },
        action: {
          suggestTo: '{destinations.code}/Config/',
        },
      },

      // Code - JavaScript/TypeScript
      {
        name: 'JavaScript/TypeScript',
        priority: 70,
        match: {
          extension: ['js', 'ts', 'mjs', 'cjs'],
        },
        action: {
          suggestTo: '{destinations.code}/JavaScript/',
        },
      },

      // Code - Python
      {
        name: 'Python scripts',
        priority: 70,
        match: {
          extension: ['py', 'pyw', 'ipynb'],
        },
        action: {
          suggestTo: '{destinations.code}/Python/',
        },
      },

      // Code - Go
      {
        name: 'Go files',
        priority: 70,
        match: {
          extension: ['go'],
        },
        action: {
          suggestTo: '{destinations.code}/Go/',
        },
      },

      // Code - SQL/Database
      {
        name: 'Database files',
        priority: 75,
        match: {
          extension: ['sql'],
        },
        action: {
          suggestTo: '{destinations.code}/Database/',
        },
      },

      // Code - Stylesheets
      {
        name: 'Stylesheets',
        priority: 70,
        match: {
          extension: ['css', 'scss', 'sass', 'less', 'styl'],
        },
        action: {
          suggestTo: '{destinations.code}/Styles/',
        },
      },

      // Code - Shell scripts
      {
        name: 'Shell scripts',
        priority: 70,
        match: {
          extension: ['sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd'],
        },
        action: {
          suggestTo: '{destinations.code}/Scripts/',
        },
      },

      // Code - Other languages
      {
        name: 'Code files',
        priority: 60,
        match: {
          type: 'code',
        },
        action: {
          suggestTo: '{destinations.code}/',
        },
      },

      // Other images
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

      // Resumes and CVs
      {
        name: 'Resumes',
        priority: 95,
        match: {
          extension: ['pdf', 'docx', 'doc'],
          filename: ['*resume*', '*cv*', '*Resume*', '*CV*', '*резюме*', '*Резюме*'],
        },
        action: {
          moveTo: '{destinations.documents}/Resumes/',
        },
      },

      // Invoices and receipts
      {
        name: 'Invoices',
        priority: 90,
        match: {
          extension: ['pdf'],
          filename: ['*invoice*', '*receipt*', '*счёт*', '*чек*', '*Invoice*', '*Receipt*'],
        },
        action: {
          moveTo: '{destinations.finance}/Invoices/{year}/',
        },
      },

      // Contracts
      {
        name: 'Contracts',
        priority: 90,
        match: {
          extension: ['pdf', 'docx', 'doc'],
          filename: ['*contract*', '*agreement*', '*договор*', '*Contract*', '*Agreement*', '*Договор*'],
        },
        action: {
          moveTo: '{destinations.documents}/Contracts/{year}/',
        },
      },

      // E-books
      {
        name: 'E-books',
        priority: 85,
        match: {
          extension: ['epub', 'mobi', 'azw', 'azw3', 'fb2', 'djvu'],
        },
        action: {
          moveTo: '{destinations.documents}/Books/',
        },
      },

      // PDF documents
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

      // Spreadsheets
      {
        name: 'Spreadsheets',
        priority: 75,
        match: {
          extension: ['xlsx', 'xls', 'csv', 'numbers', 'ods'],
        },
        action: {
          suggestTo: '{destinations.documents}/Spreadsheets/{year}/',
        },
      },

      // Presentations
      {
        name: 'Presentations',
        priority: 75,
        match: {
          extension: ['pptx', 'ppt', 'key', 'odp'],
        },
        action: {
          suggestTo: '{destinations.documents}/Presentations/{year}/',
        },
      },

      // Office documents
      {
        name: 'Office documents',
        priority: 70,
        match: {
          extension: ['docx', 'doc', 'odt', 'rtf', 'pages'],
        },
        action: {
          suggestTo: '{destinations.documents}/{year}/',
        },
      },

      // Text files
      {
        name: 'Text files',
        priority: 65,
        match: {
          extension: ['txt', 'md', 'markdown', 'rst'],
        },
        action: {
          suggestTo: '{destinations.documents}/Notes/',
        },
      },

      // Music files
      {
        name: 'Music files',
        priority: 85,
        match: {
          extension: ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'wma', 'alac'],
        },
        action: {
          moveTo: '{destinations.music}/{audio.artist}/{audio.album}/',
        },
      },

      // Video files
      {
        name: 'Video files',
        priority: 85,
        match: {
          extension: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'flv', 'm4v', '3gp'],
        },
        action: {
          suggestTo: '{destinations.video}/{year}/',
        },
      },

      // Code projects
      {
        name: 'Code archives',
        priority: 80,
        match: {
          extension: ['zip', 'tar', 'gz'],
          filename: ['*-main.zip', '*-master.zip', '*-src*', '*source*'],
        },
        action: {
          suggestTo: '{destinations.code}/Archives/',
        },
      },

      // Archives
      {
        name: 'Archives',
        priority: 75,
        match: {
          extension: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'],
        },
        action: {
          suggestTo: '{destinations.archives}/',
        },
      },

      // Torrent files
      {
        name: 'Torrents',
        priority: 90,
        match: {
          extension: ['torrent'],
        },
        action: {
          suggestTo: '{destinations.archives}/Torrents/',
        },
      },

      // Font files
      {
        name: 'Fonts',
        priority: 85,
        match: {
          extension: ['ttf', 'otf', 'woff', 'woff2', 'eot'],
        },
        action: {
          suggestTo: '{destinations.documents}/Fonts/',
        },
      },

      // Disk images and installers
      {
        name: 'Disk images',
        priority: 70,
        match: {
          extension: ['iso', 'img', 'dmg'],
        },
        action: {
          suggestTo: '{destinations.archives}/Disk Images/',
        },
      },

      // Old installers - suggest deletion
      {
        name: 'Old installers',
        priority: 100,
        match: {
          extension: ['dmg', 'pkg', 'exe', 'msi', 'deb', 'rpm', 'appimage'],
          age: '> 30 days',
        },
        action: {
          delete: true,
          confirm: true,
        },
      },

      // Incomplete downloads
      {
        name: 'Incomplete downloads',
        priority: 100,
        match: {
          extension: ['crdownload', 'part', 'partial', 'download'],
        },
        action: {
          delete: true,
          confirm: true,
        },
      },

      // Temporary files
      {
        name: 'Temporary files',
        priority: 100,
        match: {
          extension: ['tmp', 'temp', 'bak', 'swp', 'swo', 'swn'],
        },
        action: {
          delete: true,
        },
      },

      // Office temp/lock files
      {
        name: 'Office lock files',
        priority: 100,
        match: {
          filename: ['~$*'],
        },
        action: {
          delete: true,
          confirm: true,
        },
      },

      // Log files
      {
        name: 'Log files',
        priority: 60,
        match: {
          extension: ['log'],
        },
        action: {
          suggestTo: '{destinations.archives}/Logs/',
        },
      },

      // macOS metadata files
      {
        name: 'macOS junk',
        priority: 100,
        match: {
          filename: ['.DS_Store', '._*', '.Spotlight*', '.Trashes'],
        },
        action: {
          delete: true,
        },
      },

      // Windows junk
      {
        name: 'Windows junk',
        priority: 100,
        match: {
          filename: ['Thumbs.db', 'desktop.ini', '*.lnk'],
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
