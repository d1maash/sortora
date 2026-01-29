import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { resolve } from 'path';
import { existsSync } from 'fs';

import { getAppPaths, expandPath } from '../config.js';
import { Scanner } from '../core/scanner.js';
import { Analyzer } from '../core/analyzer.js';
import { Executor } from '../core/executor.js';
import { Database } from '../storage/database.js';

export function registerDuplicatesCommand(program: Command): void {
  program
    .command('duplicates <path>')
    .description('Find and manage duplicate files')
    .option('--clean', 'Remove duplicates interactively')
    .action(async (targetPath, options) => {
      const fullPath = resolve(expandPath(targetPath));

      if (!existsSync(fullPath)) {
        console.error(chalk.red(`Path not found: ${fullPath}`));
        process.exit(1);
      }

      console.log(chalk.bold(`\n  Finding duplicates in ${chalk.cyan(fullPath)}...\n`));

      const paths = getAppPaths();
      const db = new Database(paths.databaseFile);

      try {
        await db.init();

        const scanner = new Scanner(db);

        const spinner = ora('Scanning files...').start();
        const files = await scanner.scan(fullPath, { recursive: true, findDuplicates: true });
        spinner.succeed(`Scanned ${files.length} files`);

        const hashSpinner = ora('Computing file hashes...').start();
        const analyzer = new Analyzer(paths.modelsDir);
        const analyzed = await analyzer.analyzeMany(files);
        hashSpinner.succeed('Hashes computed');

        const duplicates = scanner.findDuplicates(analyzed);

        if (duplicates.length === 0) {
          console.log(chalk.green('\n  No duplicates found!\n'));
          return;
        }

        let totalSize = 0;
        for (const group of duplicates) {
          const wastedSize = group.files.slice(1).reduce((sum, f) => sum + f.size, 0);
          totalSize += wastedSize;
        }

        console.log(chalk.yellow(`\n  Found ${duplicates.length} duplicate groups`));
        console.log(chalk.yellow(`  ${(totalSize / 1024 / 1024).toFixed(1)} MB could be freed\n`));

        for (const group of duplicates) {
          console.log(chalk.bold(`\n  Hash: ${group.hash.slice(0, 12)}...`));
          for (const file of group.files) {
            console.log(chalk.dim(`    - ${file.path}`));
          }
        }

        if (options.clean) {
          const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: 'Remove duplicates (keep first of each)?',
            default: false,
          }]);

          if (confirm) {
            const executor = new Executor(db);
            for (const group of duplicates) {
              for (const file of group.files.slice(1)) {
                await executor.delete(file.path, true);
                console.log(chalk.red(`  Deleted: ${file.path}`));
              }
            }
            console.log(chalk.green('\n  Duplicates removed!\n'));
          }
        }
      } catch (error) {
        console.error(chalk.red('Duplicate scan failed'));
        console.error(error);
        process.exit(1);
      } finally {
        db.close();
      }
    });
}
