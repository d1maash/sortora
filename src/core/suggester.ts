import { join } from 'path';
import { RuleEngine, type RuleMatch } from './rule-engine.js';
import type { FileAnalysis } from './analyzer.js';
import type { Config } from '../config.js';

export interface Suggestion {
  file: FileAnalysis;
  destination: string;
  ruleName: string;
  confidence: number;
  action: 'move' | 'copy' | 'delete' | 'archive';
  requiresConfirmation: boolean;
}

export class Suggester {
  private ruleEngine: RuleEngine;

  constructor(ruleEngine: RuleEngine, _config: Config) {
    this.ruleEngine = ruleEngine;
  }

  generateSuggestion(file: FileAnalysis): Suggestion | null {
    const match = this.ruleEngine.match(file);

    if (!match) {
      return null;
    }

    return this.matchToSuggestion(file, match);
  }

  generateSuggestions(files: FileAnalysis[]): Suggestion[] {
    const suggestions: Suggestion[] = [];

    for (const file of files) {
      const suggestion = this.generateSuggestion(file);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Sort by confidence descending
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions;
  }

  private matchToSuggestion(file: FileAnalysis, match: RuleMatch): Suggestion | null {
    const { rule, confidence, destination } = match;

    // Determine action type
    let action: Suggestion['action'] = 'move';
    let requiresConfirmation = false;

    if (rule.action.delete) {
      action = 'delete';
      requiresConfirmation = rule.action.confirm ?? true;
    } else if (rule.action.archiveTo) {
      action = 'archive';
    } else if (rule.action.suggestTo) {
      action = 'move';
      requiresConfirmation = true;
    }

    // Build final destination path
    let finalDestination = destination || '';

    if (action !== 'delete' && !finalDestination) {
      return null;
    }

    // Add filename to destination if it's a directory
    if (action !== 'delete' && !finalDestination.includes(file.filename)) {
      finalDestination = join(finalDestination, file.filename);
    }

    // Don't suggest moving to same location
    if (action === 'move' && finalDestination === file.path) {
      return null;
    }

    return {
      file,
      destination: finalDestination,
      ruleName: rule.name,
      confidence,
      action,
      requiresConfirmation,
    };
  }

  suggestDestination(file: FileAnalysis): string[] {
    const matches = this.ruleEngine.matchAll(file);
    const destinations: string[] = [];

    for (const match of matches) {
      if (match.destination) {
        const fullPath = join(match.destination, file.filename);
        if (!destinations.includes(fullPath)) {
          destinations.push(fullPath);
        }
      }
    }

    return destinations;
  }

  getAlternatives(file: FileAnalysis, count = 3): Suggestion[] {
    const matches = this.ruleEngine.matchAll(file);
    const suggestions: Suggestion[] = [];

    for (const match of matches.slice(0, count)) {
      const suggestion = this.matchToSuggestion(file, match);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  explainSuggestion(suggestion: Suggestion): string[] {
    const reasons: string[] = [];

    reasons.push(`Rule: "${suggestion.ruleName}"`);
    reasons.push(`Confidence: ${Math.round(suggestion.confidence * 100)}%`);
    reasons.push(`Action: ${suggestion.action}`);

    if (suggestion.destination) {
      reasons.push(`Destination: ${suggestion.destination}`);
    }

    // Add file-specific reasons
    const file = suggestion.file;

    if (file.category) {
      reasons.push(`File type: ${file.category}`);
    }

    if (file.extension) {
      reasons.push(`Extension: .${file.extension}`);
    }

    if (file.metadata) {
      const meta = file.metadata as Record<string, unknown>;

      if (meta.dateTaken instanceof Date) {
        reasons.push(`Date taken: ${meta.dateTaken.toLocaleDateString()}`);
      }
      if (typeof meta.artist === 'string') {
        reasons.push(`Artist: ${meta.artist}`);
      }
    }

    return reasons;
  }

  filterSuggestions(
    suggestions: Suggestion[],
    options: {
      minConfidence?: number;
      actions?: Suggestion['action'][];
      categories?: string[];
      excludeConfirmation?: boolean;
    } = {}
  ): Suggestion[] {
    const {
      minConfidence = 0,
      actions,
      categories,
      excludeConfirmation = false,
    } = options;

    return suggestions.filter(s => {
      if (s.confidence < minConfidence) return false;
      if (actions && !actions.includes(s.action)) return false;
      if (categories && !categories.includes(s.file.category)) return false;
      if (excludeConfirmation && s.requiresConfirmation) return false;
      return true;
    });
  }

  groupByDestination(
    suggestions: Suggestion[]
  ): Map<string, Suggestion[]> {
    const groups = new Map<string, Suggestion[]>();

    for (const suggestion of suggestions) {
      // Get parent directory as group key
      const parts = suggestion.destination.split('/');
      parts.pop(); // Remove filename
      const dir = parts.join('/');

      const existing = groups.get(dir) || [];
      existing.push(suggestion);
      groups.set(dir, existing);
    }

    return groups;
  }

  groupByAction(
    suggestions: Suggestion[]
  ): Map<Suggestion['action'], Suggestion[]> {
    const groups = new Map<Suggestion['action'], Suggestion[]>();

    for (const suggestion of suggestions) {
      const existing = groups.get(suggestion.action) || [];
      existing.push(suggestion);
      groups.set(suggestion.action, existing);
    }

    return groups;
  }
}
