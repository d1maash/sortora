import { readFileSync, existsSync } from 'fs';
import YAML from 'yaml';
import { z } from 'zod';

const MatchSchema = z.object({
  extension: z.array(z.string()).optional(),
  filename: z.array(z.string()).optional(),
  type: z.string().optional(),
  hasExif: z.boolean().optional(),
  contentContains: z.array(z.string()).optional(),
  location: z.string().optional(),
  age: z.string().optional(),
  accessed: z.string().optional(),
  size: z.string().optional(),
  minSize: z.string().optional(),
  maxSize: z.string().optional(),
});

const ActionSchema = z.object({
  moveTo: z.string().optional(),
  copyTo: z.string().optional(),
  suggestTo: z.string().optional(),
  archiveTo: z.string().optional(),
  delete: z.boolean().optional(),
  rename: z.string().optional(),
  confirm: z.boolean().optional(),
  tag: z.array(z.string()).optional(),
});

const RuleSchema = z.object({
  name: z.string(),
  priority: z.number().default(50),
  enabled: z.boolean().default(true),
  match: MatchSchema,
  useAi: z.boolean().optional(),
  action: ActionSchema,
});

const RulesFileSchema = z.object({
  version: z.number().default(1),
  settings: z.object({
    mode: z.enum(['suggest', 'auto']).default('suggest'),
    confirmDestructive: z.boolean().default(true),
    ignoreHidden: z.boolean().default(true),
    ignorePatterns: z.array(z.string()).default([]),
  }).optional(),
  destinations: z.record(z.string()).optional(),
  rules: z.array(RuleSchema).default([]),
});

export type ParsedRule = z.infer<typeof RuleSchema>;
export type RulesFile = z.infer<typeof RulesFileSchema>;

export function parseRulesFile(filePath: string): RulesFile {
  if (!existsSync(filePath)) {
    return RulesFileSchema.parse({});
  }

  const content = readFileSync(filePath, 'utf-8');
  const parsed = YAML.parse(content);

  return RulesFileSchema.parse(parsed);
}

export function parseRulesFromYaml(yamlContent: string): RulesFile {
  const parsed = YAML.parse(yamlContent);
  return RulesFileSchema.parse(parsed);
}

export function parseRule(ruleObj: unknown): ParsedRule {
  return RuleSchema.parse(ruleObj);
}

export function validateRule(ruleObj: unknown): { valid: boolean; errors?: string[] } {
  try {
    RuleSchema.parse(ruleObj);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

export function serializeRules(rules: ParsedRule[]): string {
  const rulesFile: RulesFile = {
    version: 1,
    rules,
  };

  return YAML.stringify(rulesFile, {
    indent: 2,
    lineWidth: 100,
  });
}

export function serializeRule(rule: ParsedRule): string {
  return YAML.stringify(rule, {
    indent: 2,
    lineWidth: 100,
  });
}

export function mergeRules(base: ParsedRule[], override: ParsedRule[]): ParsedRule[] {
  const merged = new Map<string, ParsedRule>();

  // Add base rules
  for (const rule of base) {
    merged.set(rule.name, rule);
  }

  // Override with new rules
  for (const rule of override) {
    merged.set(rule.name, rule);
  }

  // Sort by priority
  return [...merged.values()].sort((a, b) => b.priority - a.priority);
}

export function parseSize(sizeStr: string): number | null {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'b').toLowerCase();

  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] || 1);
}

export function parseAge(ageStr: string): { operator: '>' | '<'; days: number } | null {
  const match = ageStr.match(/([<>])\s*(\d+)\s*(days?|weeks?|months?|years?)/i);
  if (!match) return null;

  const [, operator, value, unit] = match;
  let days = parseInt(value);

  switch (unit.toLowerCase()) {
    case 'week':
    case 'weeks':
      days *= 7;
      break;
    case 'month':
    case 'months':
      days *= 30;
      break;
    case 'year':
    case 'years':
      days *= 365;
      break;
  }

  return { operator: operator as '>' | '<', days };
}
