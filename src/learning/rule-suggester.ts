import { PatternTracker, type TrackedPattern } from './pattern-tracker.js';
import type { ParsedRule } from '../rules/parser.js';
import type { Config } from '../config.js';

export interface SuggestedRule {
  rule: ParsedRule;
  confidence: number;
  basedOn: TrackedPattern[];
  description: string;
}

export class RuleSuggester {
  private patternTracker: PatternTracker;
  private config: Config;

  constructor(patternTracker: PatternTracker, config: Config) {
    this.patternTracker = patternTracker;
    this.config = config;
  }

  suggestRules(minConfidence = 0.7): SuggestedRule[] {
    const patterns = this.patternTracker.getLearnedPatterns(minConfidence);
    const suggestions: SuggestedRule[] = [];
    const processedPatterns = new Set<string>();

    // Group patterns by destination
    const byDestination = new Map<string, TrackedPattern[]>();
    for (const p of patterns) {
      const existing = byDestination.get(p.destination) || [];
      existing.push(p);
      byDestination.set(p.destination, existing);
    }

    // Generate rules for each destination group
    for (const [destination, destPatterns] of byDestination) {
      // Skip if patterns already processed
      const key = destPatterns.map(p => `${p.type}:${p.pattern}`).join('|');
      if (processedPatterns.has(key)) continue;
      processedPatterns.add(key);

      const suggestion = this.createRuleFromPatterns(destPatterns, destination);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions;
  }

  private createRuleFromPatterns(
    patterns: TrackedPattern[],
    destination: string
  ): SuggestedRule | null {
    if (patterns.length === 0) return null;

    const match: ParsedRule['match'] = {};
    const descriptions: string[] = [];

    // Group by type
    const extensions = patterns.filter(p => p.type === 'extension');
    const filenames = patterns.filter(p => p.type === 'filename');
    const folders = patterns.filter(p => p.type === 'folder');

    // Build match conditions
    if (extensions.length > 0) {
      match.extension = extensions.map(p => p.pattern.replace('.', ''));
      descriptions.push(`files with extensions: ${match.extension.join(', ')}`);
    }

    if (filenames.length > 0) {
      match.filename = filenames.map(p => p.pattern);
      descriptions.push(`files matching: ${match.filename.join(', ')}`);
    }

    if (folders.length > 0 && !match.extension && !match.filename) {
      match.location = folders[0].pattern;
      descriptions.push(`files from: ${folders[0].pattern}`);
    }

    // Calculate combined confidence
    const avgConfidence =
      patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;

    // Calculate total occurrences
    const totalOccurrences = patterns.reduce((sum, p) => sum + p.occurrences, 0);

    // Generate rule name
    const ruleName = this.generateRuleName(patterns, destination);

    const rule: ParsedRule = {
      name: ruleName,
      priority: 60, // Medium-high priority for learned rules
      enabled: true,
      match,
      action: {
        moveTo: destination,
      },
    };

    return {
      rule,
      confidence: avgConfidence,
      basedOn: patterns,
      description: `Move ${descriptions.join(' and ')} to ${destination}`,
    };
  }

  private generateRuleName(patterns: TrackedPattern[], destination: string): string {
    // Try to extract meaningful name from patterns
    const ext = patterns.find(p => p.type === 'extension');
    const filename = patterns.find(p => p.type === 'filename');

    if (filename) {
      const pattern = filename.pattern;
      if (pattern.toLowerCase().includes('screenshot')) {
        return 'Learned: Screenshots';
      }
      if (pattern.toLowerCase().includes('invoice') || pattern.toLowerCase().includes('счёт')) {
        return 'Learned: Invoices';
      }
      return `Learned: ${pattern.replace(/[*?]/g, '')} files`;
    }

    if (ext) {
      const extName = ext.pattern.replace('.', '').toUpperCase();
      return `Learned: ${extName} files`;
    }

    // Use destination folder name
    const destName = destination.split('/').pop() || 'files';
    return `Learned: ${destName}`;
  }

  suggestRuleForPattern(pattern: TrackedPattern): SuggestedRule {
    return this.createRuleFromPatterns([pattern], pattern.destination)!;
  }

  validateSuggestedRule(suggestion: SuggestedRule): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check if rule already exists
    const existingRules = this.config.rules;
    for (const existing of existingRules) {
      if (this.rulesOverlap(existing, suggestion.rule)) {
        issues.push(`Overlaps with existing rule: ${existing.name}`);
      }
    }

    // Check destination validity
    const dest = suggestion.rule.action.moveTo;
    if (dest && !dest.includes('{destinations.')) {
      // Could check if destination exists
    }

    // Check if match conditions are specific enough
    const match = suggestion.rule.match;
    if (!match.extension && !match.filename && !match.location && !match.type) {
      issues.push('Rule has no match conditions');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  private rulesOverlap(rule1: ParsedRule, rule2: ParsedRule): boolean {
    const match1 = rule1.match;
    const match2 = rule2.match;

    // Check extension overlap
    if (match1.extension && match2.extension) {
      const overlap = match1.extension.some(e => match2.extension!.includes(e));
      if (overlap) return true;
    }

    // Check filename overlap
    if (match1.filename && match2.filename) {
      // Simple check - could be more sophisticated
      const overlap = match1.filename.some(f => match2.filename!.includes(f));
      if (overlap) return true;
    }

    return false;
  }

  mergeWithExisting(
    suggestion: SuggestedRule,
    existingRule: ParsedRule
  ): ParsedRule {
    const merged: ParsedRule = { ...existingRule };

    // Merge extensions
    if (suggestion.rule.match.extension) {
      merged.match.extension = [
        ...(existingRule.match.extension || []),
        ...suggestion.rule.match.extension,
      ].filter((e, i, arr) => arr.indexOf(e) === i); // Dedupe
    }

    // Merge filename patterns
    if (suggestion.rule.match.filename) {
      merged.match.filename = [
        ...(existingRule.match.filename || []),
        ...suggestion.rule.match.filename,
      ].filter((f, i, arr) => arr.indexOf(f) === i);
    }

    return merged;
  }
}

export default RuleSuggester;
