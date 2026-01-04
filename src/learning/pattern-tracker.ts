import { basename, dirname, extname } from 'path';
import { Database, type PatternRecord } from '../storage/database.js';
import type { FileAnalysis } from '../core/analyzer.js';

export interface TrackedPattern {
  type: 'extension' | 'filename' | 'folder' | 'content';
  pattern: string;
  destination: string;
  occurrences: number;
  lastUsed: Date;
  confidence: number;
}

export class PatternTracker {
  private db: Database;
  private minOccurrences = 3;

  constructor(db: Database) {
    this.db = db;
  }

  trackMove(file: FileAnalysis, destination: string): void {
    const destDir = dirname(destination);

    // Track by extension
    if (file.extension) {
      this.recordPattern('extension', `.${file.extension}`, destDir);
    }

    // Track by filename patterns
    const filenamePattern = this.extractFilenamePattern(file.filename);
    if (filenamePattern) {
      this.recordPattern('filename', filenamePattern, destDir);
    }

    // Track by source folder
    const sourceDir = dirname(file.path);
    this.recordPattern('folder', sourceDir, destDir);
  }

  private recordPattern(type: string, pattern: string, destination: string): void {
    const existing = this.db.findPattern(type, pattern);

    if (existing) {
      // Update if same destination, or if different but low confidence
      if (existing.destination === destination) {
        this.db.updatePatternOccurrence(existing.id);
      } else if (existing.occurrences < 3) {
        // Replace with new pattern
        this.db.insertPattern({
          type,
          pattern,
          destination,
          occurrences: 1,
          lastUsed: Math.floor(Date.now() / 1000),
        });
      }
    } else {
      this.db.insertPattern({
        type,
        pattern,
        destination,
        occurrences: 1,
        lastUsed: Math.floor(Date.now() / 1000),
      });
    }
  }

  private extractFilenamePattern(filename: string): string | null {
    // Common patterns
    const patterns = [
      /^(Screenshot|Screen Shot|Снимок|Capture)/i,
      /^(IMG_|DSC|DCIM|PXL_)/i,
      /^(invoice|receipt|счёт|чек)/i,
      /^(report|отчёт)/i,
      /\d{4}-\d{2}-\d{2}/, // Date pattern
    ];

    for (const pattern of patterns) {
      if (pattern.test(filename)) {
        return pattern.source;
      }
    }

    // Extract prefix if it looks like a pattern
    const prefixMatch = filename.match(/^([A-Za-z]+)[_-]/);
    if (prefixMatch) {
      return `${prefixMatch[1]}*`;
    }

    return null;
  }

  getLearnedPatterns(minConfidence = 0.5): TrackedPattern[] {
    const patterns = this.db.getPatterns();
    const result: TrackedPattern[] = [];

    for (const p of patterns) {
      const confidence = this.calculateConfidence(p);

      if (confidence >= minConfidence && p.occurrences >= this.minOccurrences) {
        result.push({
          type: p.type as TrackedPattern['type'],
          pattern: p.pattern,
          destination: p.destination,
          occurrences: p.occurrences,
          lastUsed: new Date(p.lastUsed * 1000),
          confidence,
        });
      }
    }

    // Sort by confidence and occurrences
    result.sort((a, b) => {
      const confDiff = b.confidence - a.confidence;
      if (Math.abs(confDiff) > 0.1) return confDiff;
      return b.occurrences - a.occurrences;
    });

    return result;
  }

  private calculateConfidence(pattern: PatternRecord): number {
    // Base confidence from occurrences
    let confidence = Math.min(pattern.occurrences / 10, 0.7);

    // Boost for recent usage
    const daysSinceUse = (Date.now() / 1000 - pattern.lastUsed) / (60 * 60 * 24);
    if (daysSinceUse < 7) {
      confidence += 0.2;
    } else if (daysSinceUse < 30) {
      confidence += 0.1;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  suggestDestination(file: FileAnalysis): TrackedPattern | null {
    const patterns = this.getLearnedPatterns(0.6);

    // Check extension patterns first
    for (const p of patterns) {
      if (p.type === 'extension' && p.pattern === `.${file.extension}`) {
        return p;
      }
    }

    // Check filename patterns
    for (const p of patterns) {
      if (p.type === 'filename') {
        const regex = new RegExp(p.pattern.replace(/\*/g, '.*'), 'i');
        if (regex.test(file.filename)) {
          return p;
        }
      }
    }

    // Check folder patterns
    const sourceDir = dirname(file.path);
    for (const p of patterns) {
      if (p.type === 'folder' && p.pattern === sourceDir) {
        return p;
      }
    }

    return null;
  }

  getPatternStats(): {
    totalPatterns: number;
    byType: Record<string, number>;
    topDestinations: { destination: string; count: number }[];
  } {
    const patterns = this.db.getPatterns();

    const byType: Record<string, number> = {};
    const destCounts: Record<string, number> = {};

    for (const p of patterns) {
      byType[p.type] = (byType[p.type] || 0) + 1;
      destCounts[p.destination] = (destCounts[p.destination] || 0) + 1;
    }

    const topDestinations = Object.entries(destCounts)
      .map(([destination, count]) => ({ destination, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalPatterns: patterns.length,
      byType,
      topDestinations,
    };
  }

  clearOldPatterns(maxAgeDays = 90): number {
    const cutoff = Math.floor(Date.now() / 1000) - maxAgeDays * 24 * 60 * 60;
    const patterns = this.db.getPatterns();

    let removed = 0;
    for (const p of patterns) {
      if (p.lastUsed < cutoff && p.occurrences < 5) {
        // Would need a delete method in db
        removed++;
      }
    }

    return removed;
  }
}

export default PatternTracker;
