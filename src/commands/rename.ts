import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { resolve } from 'path';
import { existsSync } from 'fs';

import { getAppPaths, expandPath } from '../config.js';
import { Scanner } from '../core/scanner.js';
import { Database } from '../storage/database.js';
import { SmartRenamer } from '../ai/smart-renamer.js';
import { renameFile } from '../actions/rename.js';
import { logger } from '../utils/logger.js';

export function registerRenameCommand(program: Command): void {
  program
    .command('rename <path>')
    .description('Smart rename files using EXIF data and AI analysis')
    .option('-d, --deep', 'Scan subdirectories recursively')
    .option('--ai', 'Use AI for content-based naming')
    .option('--ocr', 'Use OCR to read text from images')
    .option('--dry-run', 'Preview renames without making changes')
    .option('--auto', 'Apply renames automatically without confirmation')
    .option('--event <name>', 'Event or trip name to use in filenames')
    .option('--lang <lang>', 'Language for names (ru/en)', 'ru')
    .option('--json', 'Output suggestions as JSON')
    .action(async (targetPath, options) => {
      const fullPath = resolve(expandPath(targetPath));

      if (!existsSync(fullPath)) {
        console.error(chalk.red(`Path not found: ${fullPath}`));
        process.exit(1);
      }

      console.log(chalk.bold(`\n  Smart Rename: ${chalk.cyan(fullPath)}\n`));

      const paths = getAppPaths();
      const db = new Database(paths.databaseFile);

      try {
        await db.init();

        const renamer = new SmartRenamer(paths.modelsDir, {
          language: options.lang === 'en' ? 'en' : 'ru',
        });

        // Enable AI if requested
        if (options.ai) {
          const aiSpinner = ora('Loading AI models...').start();
          try {
            await renamer.enableAI();
            aiSpinner.succeed('AI models loaded');
          } catch (error) {
            aiSpinner.fail('Failed to load AI models. Run "sortora setup" first.');
            logger.error('AI error:', error);
          }
        }

        // Enable OCR if requested
        if (options.ocr) {
          const ocrSpinner = ora('Loading OCR engine...').start();
          try {
            await renamer.enableOCR(['eng', 'rus']);
            ocrSpinner.succeed('OCR engine loaded');
          } catch (error) {
            ocrSpinner.fail('Failed to load OCR. Run "sortora setup" first.');
            logger.error('OCR error:', error);
          }
        }

        // Scan for files
        const scanner = new Scanner(db);
        const spinner = ora('Scanning files...').start();

        const files = await scanner.scan(fullPath, {
          recursive: options.deep || false,
        });

        spinner.succeed(`Found ${files.length} files`);

        if (files.length === 0) {
          console.log(chalk.yellow('\n  No files found.\n'));
          return;
        }

        // Filter files that need renaming
        const filesToRename = files.filter(f => renamer.isUnreadable(f.filename));

        if (filesToRename.length === 0) {
          console.log(chalk.green('\n  All files already have readable names!\n'));
          return;
        }

        console.log(chalk.dim(`\n  ${filesToRename.length} files need renaming:\n`));

        // Generate suggestions
        const suggestSpinner = ora('Analyzing files and generating names...').start();
        const suggestions = await renamer.suggestBatch(
          filesToRename.map(f => f.path),
          {
            useAI: options.ai && renamer.isAIEnabled(),
            useOCR: options.ocr,
            eventHint: options.event,
            groupByDate: true,
            groupByLocation: true,
          }
        );
        suggestSpinner.succeed('Suggestions generated');

        // JSON output
        if (options.json) {
          console.log(JSON.stringify(suggestions, null, 2));
          return;
        }

        // Dry run - just show suggestions
        if (options.dryRun) {
          console.log(chalk.bold('\n  Suggested renames (dry run):\n'));
          for (const suggestion of suggestions) {
            const confidence = Math.round(suggestion.confidence * 100);
            const confidenceColor = confidence >= 70 ? chalk.green : confidence >= 50 ? chalk.yellow : chalk.red;

            console.log(chalk.dim(`  ${suggestion.original}`));
            console.log(chalk.cyan(`    -> ${suggestion.suggested}`));
            console.log(chalk.dim(`      ${suggestion.reason} (${confidenceColor(confidence + '%')})\n`));
          }
          return;
        }

        // Process renames
        let renamed = 0;
        let skipped = 0;

        for (let i = 0; i < suggestions.length; i++) {
          const suggestion = suggestions[i];
          const file = filesToRename[i];
          const progress = `[${i + 1}/${suggestions.length}]`;

          // Skip files with same name
          if (suggestion.original === suggestion.suggested) {
            continue;
          }

          const confidence = Math.round(suggestion.confidence * 100);
          const confidenceColor = confidence >= 70 ? chalk.green : confidence >= 50 ? chalk.yellow : chalk.red;

          console.log(chalk.bold(`\n  ${progress} ${suggestion.original}`));
          console.log(chalk.cyan(`    -> ${suggestion.suggested}`));
          console.log(chalk.dim(`      ${suggestion.reason} (${confidenceColor(confidence + '%')})`));

          let shouldRename = false;

          if (options.auto) {
            // Auto mode: rename if confidence >= 50%
            shouldRename = suggestion.confidence >= 0.5;
            if (!shouldRename) {
              console.log(chalk.yellow('    Skipped (low confidence)'));
              skipped++;
            }
          } else {
            // Interactive mode
            const { action } = await inquirer.prompt([{
              type: 'list',
              name: 'action',
              message: 'Action:',
              choices: [
                { name: 'Accept', value: 'accept' },
                { name: 'Edit name', value: 'edit' },
                { name: 'Skip', value: 'skip' },
                { name: 'Skip all remaining', value: 'quit' },
              ],
            }]);

            if (action === 'quit') {
              console.log(chalk.yellow('\n  Stopped.\n'));
              break;
            }

            // Fix: same edit bug as organize - use else if chain
            if (action === 'edit') {
              const { newName } = await inquirer.prompt([{
                type: 'input',
                name: 'newName',
                message: 'New name:',
                default: suggestion.suggested,
              }]);
              suggestion.suggested = newName;
              shouldRename = true;
            } else if (action === 'accept') {
              shouldRename = true;
            } else {
              // skip
              skipped++;
            }
          }

          if (shouldRename) {
            try {
              const result = await renameFile(file.path, suggestion.suggested, {
                preserveExtension: true,
              });

              if (result.success) {
                // Log to database for undo support
                db.insertOperation({
                  type: 'rename',
                  source: file.path,
                  destination: result.destination,
                  ruleName: null,
                  confidence: suggestion.confidence,
                });

                console.log(chalk.green('    Renamed'));
                renamed++;
              } else {
                console.log(chalk.red(`    ${result.error}`));
              }
            } catch (error) {
              console.log(chalk.red(`    Error: ${error}`));
            }
          }
        }

        console.log(chalk.bold('\n  Summary:'));
        console.log(chalk.green(`    Renamed: ${renamed} files`));
        if (skipped > 0) {
          console.log(chalk.yellow(`    Skipped: ${skipped} files`));
        }
        console.log(chalk.dim(`\n  Run "sortora undo" to revert changes.\n`));
      } catch (error) {
        console.error(chalk.red('Rename failed'));
        console.error(error);
        process.exit(1);
      } finally {
        db.close();
      }
    });
}
