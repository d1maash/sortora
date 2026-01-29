import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { resolve } from 'path';
import { existsSync } from 'fs';

import { loadConfig, getAppPaths, expandPath } from '../config.js';
import { Scanner } from '../core/scanner.js';
import { Analyzer } from '../core/analyzer.js';
import { RuleEngine } from '../core/rule-engine.js';
import { Suggester } from '../core/suggester.js';
import { Executor } from '../core/executor.js';
import { Database } from '../storage/database.js';
import { createProgressBar } from '../ui/progress.js';
import { formatSize } from '../ui/colors.js';

export function registerOrganizeCommand(program: Command): void {
  program
    .command('organize <path>')
    .description('Organize files based on rules')
    .option('-d, --deep', 'Scan subdirectories recursively')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('-i, --interactive', 'Confirm each action')
    .option('--auto', 'Apply actions automatically')
    .option('--global', 'Move files to global destinations (~/Documents, ~/Pictures, etc.)')
    .option('--confidence <number>', 'Minimum confidence for auto mode (0-1)', '0.8')
    .action(async (targetPath, options) => {
      const fullPath = resolve(expandPath(targetPath));

      if (!existsSync(fullPath)) {
        console.error(chalk.red(`Path not found: ${fullPath}`));
        process.exit(1);
      }

      const modeText = options.global
        ? chalk.yellow('(global mode - files will be moved to ~/Documents, etc.)')
        : chalk.green('(local mode - files will be organized within the directory)');

      console.log(chalk.bold(`\n  Organizing ${chalk.cyan(fullPath)}...`));
      console.log(`  ${modeText}\n`);

      const config = loadConfig();
      const paths = getAppPaths();
      const db = new Database(paths.databaseFile);

      try {
        await db.init();

        const scanner = new Scanner(db);
        const analyzer = new Analyzer(paths.modelsDir);
        const ruleEngine = new RuleEngine(config);
        const suggester = new Suggester(ruleEngine, config);
        const executor = new Executor(db);

        const spinner = ora('Scanning files...').start();
        const files = await scanner.scan(fullPath, { recursive: options.deep || false });
        spinner.succeed(`Found ${files.length} files`);

        if (files.length === 0) {
          console.log(chalk.yellow('\n  No files to organize.\n'));
          return;
        }

        const analyzeSpinner = ora('Analyzing files...').start();
        const analyzed = await analyzer.analyzeMany(files);
        analyzeSpinner.succeed('Analysis complete');

        // Generate suggestions with local or global destinations
        const suggestions = suggester.generateSuggestions(analyzed, {
          baseDir: fullPath,
          useGlobalDestinations: options.global || false,
        });

        if (suggestions.length === 0) {
          console.log(chalk.yellow('\n  No suggestions - files already organized.\n'));
          return;
        }

        console.log(chalk.bold(`\n  ${suggestions.length} suggestions:\n`));

        if (options.dryRun) {
          for (const suggestion of suggestions) {
            console.log(chalk.dim(`  ${suggestion.file.filename}`));
            console.log(chalk.cyan(`    -> ${suggestion.destination}`));
            console.log(chalk.dim(`    Rule: ${suggestion.ruleName} (${Math.round(suggestion.confidence * 100)}%)\n`));
          }
          return;
        }

        const minConfidence = parseFloat(options.confidence);

        // #23: Track summary stats
        let filesMoved = 0;
        let totalSizeMoved = 0;
        let filesSkipped = 0;
        let errors = 0;

        // #17: Progress bar for organize
        const progressBar = createProgressBar(suggestions.length, 'Organizing');

        for (let i = 0; i < suggestions.length; i++) {
          const suggestion = suggestions[i];
          const progress = `[${i + 1}/${suggestions.length}]`;

          console.log(chalk.bold(`\n  ${progress} ${suggestion.file.filename}`));
          console.log(chalk.dim(`    ${suggestion.file.path}`));
          console.log(chalk.cyan(`    -> ${suggestion.destination}`));
          console.log(chalk.dim(`    Rule: ${suggestion.ruleName} (${Math.round(suggestion.confidence * 100)}%)`));

          let shouldExecute = false;

          if (options.auto && suggestion.confidence >= minConfidence) {
            shouldExecute = true;
          } else if (options.interactive || !options.auto) {
            const { action } = await inquirer.prompt([{
              type: 'list',
              name: 'action',
              message: 'Action:',
              choices: [
                { name: 'Accept', value: 'accept' },
                { name: 'Skip', value: 'skip' },
                { name: 'Edit destination', value: 'edit' },
                { name: 'Quit', value: 'quit' },
              ],
            }]);

            if (action === 'quit') {
              console.log(chalk.yellow('\n  Stopped.\n'));
              progressBar.clear();
              break;
            }

            // #1: Fix "Edit destination" bug - use else if chain
            if (action === 'edit') {
              const { newDest } = await inquirer.prompt([{
                type: 'input',
                name: 'newDest',
                message: 'New destination:',
                default: suggestion.destination,
              }]);
              suggestion.destination = expandPath(newDest);
              shouldExecute = true;
            } else if (action === 'accept') {
              shouldExecute = true;
            }
            // action === 'skip' leaves shouldExecute as false
          }

          if (shouldExecute) {
            try {
              await executor.execute(suggestion);
              console.log(chalk.green('    Done'));
              filesMoved++;
              totalSizeMoved += suggestion.file.size;
            } catch (error) {
              console.log(chalk.red(`    Error: ${error}`));
              errors++;
            }
          } else {
            console.log(chalk.dim('    Skipped'));
            filesSkipped++;
          }

          progressBar.update(i + 1);
        }

        progressBar.finish();

        // #23: Show summary after organize
        console.log(chalk.bold('\n  Summary:'));
        console.log(chalk.green(`    Files organized: ${filesMoved}`));
        console.log(chalk.dim(`    Total size: ${formatSize(totalSizeMoved)}`));
        if (filesSkipped > 0) {
          console.log(chalk.yellow(`    Skipped: ${filesSkipped}`));
        }
        if (errors > 0) {
          console.log(chalk.red(`    Errors: ${errors}`));
        }
        console.log(chalk.dim(`\n  Run "sortora undo" to revert changes.\n`));
      } catch (error) {
        console.error(chalk.red('Organization failed'));
        console.error(error);
        process.exit(1);
      } finally {
        db.close();
      }
    });
}
