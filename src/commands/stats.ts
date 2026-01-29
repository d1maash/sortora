import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

import { getAppPaths } from '../config.js';
import { Database } from '../storage/database.js';
import {
  renderStatsOverview,
  renderTopRules,
  renderDuplicateStats,
  renderOverallStats,
  type StatsData,
} from '../ui/table.js';
import { formatNumber } from '../ui/colors.js';

export function registerStatsCommand(program: Command): void {
  program
    .command('stats')
    .description('Show organization statistics and reports')
    .option('--json', 'Output as JSON')
    .option('--period <period>', 'Show stats for specific period (day, week, month)', 'all')
    .option('--rules', 'Show only top rules statistics')
    .option('--duplicates', 'Show only duplicate statistics')
    .action(async (options) => {
      const paths = getAppPaths();
      const db = new Database(paths.databaseFile);

      try {
        await db.init();

        const spinner = ora('Gathering statistics...').start();

        // Gather all statistics
        const statsData: StatsData = {
          day: db.getOperationsByPeriod('day'),
          week: db.getOperationsByPeriod('week'),
          month: db.getOperationsByPeriod('month'),
          topRules: db.getTopRules(10),
          duplicates: db.getDuplicateStats(),
          deletedDuplicates: db.getDeletedDuplicatesStats(),
          overall: db.getStats(),
        };

        spinner.succeed('Statistics gathered');

        if (options.json) {
          console.log(JSON.stringify(statsData, null, 2));
          return;
        }

        // Render specific sections or all
        if (options.rules) {
          renderTopRules(statsData.topRules);
        } else if (options.duplicates) {
          renderDuplicateStats(statsData);
        } else if (options.period !== 'all') {
          // Show specific period
          const period = options.period as 'day' | 'week' | 'month';
          const periodData = statsData[period];

          if (!periodData) {
            console.log(chalk.red(`\n  Invalid period: ${options.period}. Use day, week, or month.\n`));
            return;
          }

          const periodNames = { day: 'Today', week: 'This Week', month: 'This Month' };
          console.log(chalk.bold(`\n  Statistics for ${periodNames[period]}\n`));
          console.log(`  Files organized: ${chalk.cyan(periodData.total.toString())}`);

          if (Object.keys(periodData.byType).length > 0) {
            console.log(chalk.bold('\n  Operations by type:'));
            for (const [type, count] of Object.entries(periodData.byType)) {
              const typeColor = type === 'delete' ? chalk.red : chalk.cyan;
              console.log(`    ${typeColor(type)}: ${formatNumber(count)}`);
            }
          }

          if (Object.keys(periodData.byRule).length > 0) {
            console.log(chalk.bold('\n  Operations by rule:'));
            const sortedRules = Object.entries(periodData.byRule).sort((a, b) => b[1] - a[1]);
            for (const [rule, count] of sortedRules.slice(0, 10)) {
              console.log(`    ${chalk.cyan(rule)}: ${formatNumber(count)}`);
            }
          }
          console.log();
        } else {
          // Show all statistics
          renderStatsOverview(statsData);
          renderTopRules(statsData.topRules);
          renderDuplicateStats(statsData);
          renderOverallStats(statsData);
          console.log();
        }
      } catch (error) {
        console.error(chalk.red('Failed to gather statistics'));
        console.error(error);
        process.exit(1);
      } finally {
        db.close();
      }
    });
}
