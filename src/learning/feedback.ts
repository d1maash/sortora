import { Database } from '../storage/database.js';
import { PatternTracker } from './pattern-tracker.js';
import type { FileAnalysis } from '../core/analyzer.js';
import type { Suggestion } from '../core/suggester.js';

export type FeedbackType = 'accept' | 'reject' | 'modify' | 'skip';

export interface Feedback {
  suggestion: Suggestion;
  type: FeedbackType;
  modifiedDestination?: string;
  timestamp: Date;
}

export interface FeedbackStats {
  totalFeedback: number;
  accepted: number;
  rejected: number;
  modified: number;
  skipped: number;
  acceptanceRate: number;
  ruleAccuracy: Record<string, number>;
}

export class FeedbackHandler {
  private db: Database;
  private patternTracker: PatternTracker;
  private sessionFeedback: Feedback[] = [];

  constructor(db: Database, patternTracker: PatternTracker) {
    this.db = db;
    this.patternTracker = patternTracker;
  }

  recordFeedback(
    suggestion: Suggestion,
    type: FeedbackType,
    modifiedDestination?: string
  ): void {
    const feedback: Feedback = {
      suggestion,
      type,
      modifiedDestination,
      timestamp: new Date(),
    };

    this.sessionFeedback.push(feedback);

    // Learn from feedback
    switch (type) {
      case 'accept':
        this.handleAccept(suggestion);
        break;
      case 'reject':
        this.handleReject(suggestion);
        break;
      case 'modify':
        if (modifiedDestination) {
          this.handleModify(suggestion, modifiedDestination);
        }
        break;
    }
  }

  private handleAccept(suggestion: Suggestion): void {
    // Track the successful pattern
    this.patternTracker.trackMove(suggestion.file, suggestion.destination);
  }

  private handleReject(suggestion: Suggestion): void {
    // Could implement negative learning
    // For now, just don't learn from rejected suggestions
  }

  private handleModify(suggestion: Suggestion, newDestination: string): void {
    // Learn from the corrected destination
    this.patternTracker.trackMove(suggestion.file, newDestination);
  }

  getSessionStats(): FeedbackStats {
    const stats: FeedbackStats = {
      totalFeedback: this.sessionFeedback.length,
      accepted: 0,
      rejected: 0,
      modified: 0,
      skipped: 0,
      acceptanceRate: 0,
      ruleAccuracy: {},
    };

    const ruleStats: Record<string, { accepted: number; total: number }> = {};

    for (const fb of this.sessionFeedback) {
      switch (fb.type) {
        case 'accept':
          stats.accepted++;
          break;
        case 'reject':
          stats.rejected++;
          break;
        case 'modify':
          stats.modified++;
          break;
        case 'skip':
          stats.skipped++;
          break;
      }

      // Track per-rule stats
      const ruleName = fb.suggestion.ruleName;
      if (!ruleStats[ruleName]) {
        ruleStats[ruleName] = { accepted: 0, total: 0 };
      }
      ruleStats[ruleName].total++;
      if (fb.type === 'accept') {
        ruleStats[ruleName].accepted++;
      }
    }

    // Calculate acceptance rate
    const actionable = stats.accepted + stats.rejected + stats.modified;
    if (actionable > 0) {
      stats.acceptanceRate = (stats.accepted + stats.modified) / actionable;
    }

    // Calculate rule accuracy
    for (const [ruleName, rs] of Object.entries(ruleStats)) {
      if (rs.total > 0) {
        stats.ruleAccuracy[ruleName] = rs.accepted / rs.total;
      }
    }

    return stats;
  }

  shouldAskForFeedback(suggestion: Suggestion): boolean {
    // Ask for feedback if:
    // 1. Low confidence
    if (suggestion.confidence < 0.7) return true;

    // 2. Rule has low accuracy
    const stats = this.getSessionStats();
    const ruleAccuracy = stats.ruleAccuracy[suggestion.ruleName];
    if (ruleAccuracy !== undefined && ruleAccuracy < 0.5) return true;

    // 3. First time seeing this type of file
    const similarFeedback = this.sessionFeedback.filter(
      fb => fb.suggestion.file.category === suggestion.file.category
    );
    if (similarFeedback.length < 2) return true;

    return false;
  }

  getSuggestionQuality(suggestion: Suggestion): 'high' | 'medium' | 'low' {
    const stats = this.getSessionStats();
    const ruleAccuracy = stats.ruleAccuracy[suggestion.ruleName];

    if (suggestion.confidence >= 0.9 && (ruleAccuracy === undefined || ruleAccuracy >= 0.8)) {
      return 'high';
    }

    if (suggestion.confidence >= 0.7 && (ruleAccuracy === undefined || ruleAccuracy >= 0.5)) {
      return 'medium';
    }

    return 'low';
  }

  getProblematicRules(): { ruleName: string; accuracy: number; feedback: Feedback[] }[] {
    const stats = this.getSessionStats();
    const problematic: { ruleName: string; accuracy: number; feedback: Feedback[] }[] = [];

    for (const [ruleName, accuracy] of Object.entries(stats.ruleAccuracy)) {
      if (accuracy < 0.5) {
        const ruleFeedback = this.sessionFeedback.filter(
          fb => fb.suggestion.ruleName === ruleName
        );
        problematic.push({ ruleName, accuracy, feedback: ruleFeedback });
      }
    }

    return problematic.sort((a, b) => a.accuracy - b.accuracy);
  }

  suggestRuleImprovements(): string[] {
    const improvements: string[] = [];
    const problematic = this.getProblematicRules();

    for (const { ruleName, accuracy, feedback } of problematic) {
      // Analyze what went wrong
      const rejections = feedback.filter(fb => fb.type === 'reject');
      const modifications = feedback.filter(fb => fb.type === 'modify');

      if (rejections.length > modifications.length) {
        improvements.push(
          `Rule "${ruleName}" has ${Math.round(accuracy * 100)}% accuracy. ` +
          `Consider making the match conditions more specific.`
        );
      } else if (modifications.length > 0) {
        // Analyze common destinations in modifications
        const destCounts: Record<string, number> = {};
        for (const fb of modifications) {
          if (fb.modifiedDestination) {
            destCounts[fb.modifiedDestination] = (destCounts[fb.modifiedDestination] || 0) + 1;
          }
        }

        const topDest = Object.entries(destCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 1)[0];

        if (topDest) {
          improvements.push(
            `Rule "${ruleName}" often gets modified to "${topDest[0]}". ` +
            `Consider updating the rule destination.`
          );
        }
      }
    }

    return improvements;
  }

  clearSession(): void {
    this.sessionFeedback = [];
  }
}

export default FeedbackHandler;
