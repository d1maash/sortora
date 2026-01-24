import Table from 'cli-table3';
import chalk from 'chalk';
import { formatSize, formatNumber, colorByCategory } from './colors.js';
import type { FileAnalysis } from '../core/analyzer.js';
import { getCategoryIcon } from '../utils/mime.js';

export interface PeriodStats {
  total: number;
  byType: Record<string, number>;
  byRule: Record<string, number>;
}

export interface StatsData {
  day: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
  topRules: { ruleName: string; count: number; lastUsed: number }[];
  duplicates: {
    totalGroups: number;
    totalDuplicateFiles: number;
    potentialSavings: number;
  };
  deletedDuplicates: {
    totalDeleted: number;
    totalSaved: number;
  };
  overall: {
    totalFiles: number;
    totalSize: number;
    totalOperations: number;
    categories: Record<string, number>;
  };
}

export interface TableOptions {
  head?: string[];
  colWidths?: number[];
  wordWrap?: boolean;
}

export function createTable(options: TableOptions = {}): Table.Table {
  return new Table({
    head: options.head?.map(h => chalk.bold(h)) || [],
    colWidths: options.colWidths,
    wordWrap: options.wordWrap ?? true,
    style: {
      head: [],
      border: ['gray'],
    },
  });
}

export function renderScanStats(files: FileAnalysis[]): void {
  // Group by category
  const categories = new Map<string, { count: number; size: number }>();

  for (const file of files) {
    const category = file.category || 'other';
    const existing = categories.get(category) || { count: 0, size: 0 };
    existing.count++;
    existing.size += file.size;
    categories.set(category, existing);
  }

  // Create stats table
  const table = new Table({
    head: [
      chalk.bold('Type'),
      chalk.bold('Count'),
      chalk.bold('Size'),
    ],
    colWidths: [20, 10, 12],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  // Sort by count descending
  const sorted = [...categories.entries()].sort((a, b) => b[1].count - a[1].count);

  let totalCount = 0;
  let totalSize = 0;

  for (const [category, stats] of sorted) {
    const icon = getCategoryIcon(category as any);
    const colorFn = colorByCategory(category);

    table.push([
      `${icon} ${colorFn(category.charAt(0).toUpperCase() + category.slice(1))}`,
      formatNumber(stats.count),
      formatSize(stats.size),
    ]);

    totalCount += stats.count;
    totalSize += stats.size;
  }

  // Add total row
  table.push([
    chalk.bold('TOTAL'),
    chalk.bold(formatNumber(totalCount)),
    chalk.bold(formatSize(totalSize)),
  ]);

  console.log('\n  ' + chalk.bold('Statistics:'));
  console.log(table.toString().split('\n').map(line => '  ' + line).join('\n'));
}

export function renderFileTable(files: FileAnalysis[], limit = 20): void {
  const table = new Table({
    head: [
      chalk.bold('Filename'),
      chalk.bold('Type'),
      chalk.bold('Size'),
    ],
    colWidths: [40, 12, 10],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  const displayFiles = files.slice(0, limit);

  for (const file of displayFiles) {
    const category = file.category || 'other';
    const icon = getCategoryIcon(category as any);
    const colorFn = colorByCategory(category);

    const filename = file.filename.length > 35
      ? file.filename.slice(0, 32) + '...'
      : file.filename;

    table.push([
      filename,
      `${icon} ${colorFn(category)}`,
      formatSize(file.size),
    ]);
  }

  console.log(table.toString().split('\n').map(line => '  ' + line).join('\n'));

  if (files.length > limit) {
    console.log(chalk.dim(`  ... and ${files.length - limit} more files`));
  }
}

export function renderDuplicatesTable(
  duplicates: { hash: string; files: FileAnalysis[] }[]
): void {
  console.log(chalk.bold('\n  Duplicate Files:\n'));

  for (let i = 0; i < duplicates.length; i++) {
    const group = duplicates[i];
    const size = group.files[0]?.size || 0;

    console.log(chalk.yellow(`  Group ${i + 1}`) + chalk.dim(` (${formatSize(size)} each):`));

    for (const file of group.files) {
      console.log(chalk.dim(`    - ${file.path}`));
    }

    console.log();
  }

  // Calculate total wasted space
  let wastedSpace = 0;
  for (const group of duplicates) {
    const fileSize = group.files[0]?.size || 0;
    wastedSpace += fileSize * (group.files.length - 1);
  }

  console.log(chalk.yellow(`  Total duplicates: ${duplicates.length} groups`));
  console.log(chalk.yellow(`  Space to recover: ${formatSize(wastedSpace)}\n`));
}

export function renderOperationsTable(
  operations: {
    id: number;
    type: string;
    source: string;
    destination?: string | null;
    createdAt: number;
    undoneAt?: number | null;
  }[]
): void {
  const table = new Table({
    head: [
      chalk.bold('ID'),
      chalk.bold('Type'),
      chalk.bold('Source'),
      chalk.bold('Status'),
    ],
    colWidths: [6, 10, 45, 12],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  for (const op of operations) {
    const source = op.source.length > 40
      ? '...' + op.source.slice(-37)
      : op.source;

    const status = op.undoneAt
      ? chalk.gray('undone')
      : chalk.green('done');

    const typeColor = op.type === 'delete' ? chalk.red : chalk.cyan;

    table.push([
      `#${op.id}`,
      typeColor(op.type),
      source,
      status,
    ]);
  }

  console.log(table.toString().split('\n').map(line => '  ' + line).join('\n'));
}

export function renderRulesTable(
  rules: {
    name: string;
    priority: number;
    match: Record<string, unknown>;
    action: Record<string, unknown>;
  }[]
): void {
  const table = new Table({
    head: [
      chalk.bold('Rule'),
      chalk.bold('Priority'),
      chalk.bold('Match'),
      chalk.bold('Action'),
    ],
    colWidths: [25, 10, 25, 25],
    wordWrap: true,
    style: {
      head: [],
      border: ['gray'],
    },
  });

  for (const rule of rules) {
    const matchStr = Object.entries(rule.match)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n');

    const actionStr = Object.entries(rule.action)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    table.push([
      chalk.cyan(rule.name),
      rule.priority.toString(),
      chalk.dim(matchStr),
      chalk.dim(actionStr),
    ]);
  }

  console.log(table.toString().split('\n').map(line => '  ' + line).join('\n'));
}

export function renderStatsOverview(stats: StatsData): void {
  console.log(chalk.bold('\n  Organization Statistics\n'));

  // Period stats table
  const periodTable = new Table({
    head: [
      chalk.bold('Period'),
      chalk.bold('Files Organized'),
      chalk.bold('Moves'),
      chalk.bold('Copies'),
      chalk.bold('Deletes'),
    ],
    colWidths: [12, 18, 10, 10, 10],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  const periods: Array<{ name: string; data: PeriodStats }> = [
    { name: 'Today', data: stats.day },
    { name: 'This Week', data: stats.week },
    { name: 'This Month', data: stats.month },
  ];

  for (const period of periods) {
    periodTable.push([
      chalk.cyan(period.name),
      formatNumber(period.data.total),
      formatNumber(period.data.byType['move'] || 0),
      formatNumber(period.data.byType['copy'] || 0),
      chalk.red(formatNumber(period.data.byType['delete'] || 0)),
    ]);
  }

  console.log(periodTable.toString().split('\n').map(line => '  ' + line).join('\n'));
}

export function renderTopRules(
  topRules: { ruleName: string; count: number; lastUsed: number }[]
): void {
  if (topRules.length === 0) {
    console.log(chalk.dim('\n  No rules have been triggered yet.\n'));
    return;
  }

  console.log(chalk.bold('\n  Most Active Rules\n'));

  const table = new Table({
    head: [
      chalk.bold('Rule'),
      chalk.bold('Triggers'),
      chalk.bold('Last Used'),
    ],
    colWidths: [35, 12, 20],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  for (const rule of topRules) {
    const lastUsed = new Date(rule.lastUsed * 1000);
    const lastUsedStr = formatRelativeTime(lastUsed);

    table.push([
      chalk.cyan(rule.ruleName),
      formatNumber(rule.count),
      chalk.dim(lastUsedStr),
    ]);
  }

  console.log(table.toString().split('\n').map(line => '  ' + line).join('\n'));
}

export function renderDuplicateStats(stats: StatsData): void {
  console.log(chalk.bold('\n  Duplicate Files\n'));

  const { duplicates, deletedDuplicates } = stats;

  if (duplicates.totalGroups === 0 && deletedDuplicates.totalDeleted === 0) {
    console.log(chalk.dim('  No duplicates found or removed.\n'));
    return;
  }

  const table = new Table({
    head: [
      chalk.bold('Metric'),
      chalk.bold('Value'),
    ],
    colWidths: [35, 20],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  if (duplicates.totalGroups > 0) {
    table.push([
      'Current duplicate groups',
      chalk.yellow(formatNumber(duplicates.totalGroups)),
    ]);
    table.push([
      'Duplicate files (excluding originals)',
      chalk.yellow(formatNumber(duplicates.totalDuplicateFiles)),
    ]);
    table.push([
      'Potential space savings',
      chalk.yellow(formatSize(duplicates.potentialSavings)),
    ]);
  }

  if (deletedDuplicates.totalDeleted > 0) {
    table.push([
      'Duplicates removed',
      chalk.green(formatNumber(deletedDuplicates.totalDeleted)),
    ]);
    if (deletedDuplicates.totalSaved > 0) {
      table.push([
        'Space saved',
        chalk.green(formatSize(deletedDuplicates.totalSaved)),
      ]);
    }
  }

  console.log(table.toString().split('\n').map(line => '  ' + line).join('\n'));
}

export function renderOverallStats(stats: StatsData): void {
  console.log(chalk.bold('\n  Overall Statistics\n'));

  const { overall } = stats;

  const table = new Table({
    head: [
      chalk.bold('Metric'),
      chalk.bold('Value'),
    ],
    colWidths: [35, 20],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  table.push([
    'Total files analyzed',
    formatNumber(overall.totalFiles),
  ]);
  table.push([
    'Total size tracked',
    formatSize(overall.totalSize),
  ]);
  table.push([
    'Total operations performed',
    formatNumber(overall.totalOperations),
  ]);

  console.log(table.toString().split('\n').map(line => '  ' + line).join('\n'));

  // Categories breakdown
  const categories = Object.entries(overall.categories);
  if (categories.length > 0) {
    console.log(chalk.bold('\n  Files by Category\n'));

    const catTable = new Table({
      head: [
        chalk.bold('Category'),
        chalk.bold('Count'),
      ],
      colWidths: [25, 15],
      style: {
        head: [],
        border: ['gray'],
      },
    });

    const sortedCats = categories.sort((a, b) => b[1] - a[1]);
    for (const [category, count] of sortedCats) {
      const icon = getCategoryIcon(category as Parameters<typeof getCategoryIcon>[0]);
      const colorFn = colorByCategory(category);
      catTable.push([
        `${icon} ${colorFn(category.charAt(0).toUpperCase() + category.slice(1))}`,
        formatNumber(count),
      ]);
    }

    console.log(catTable.toString().split('\n').map(line => '  ' + line).join('\n'));
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} min ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  } else if (diffDay < 7) {
    return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
}
