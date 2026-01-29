import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { resolve } from 'path';
import { existsSync } from 'fs';

import { loadConfig, getAppPaths, expandPath } from '../config.js';
import { Scanner } from '../core/scanner.js';
import { Analyzer, type FileAnalysis } from '../core/analyzer.js';
import { RuleEngine } from '../core/rule-engine.js';
import { Suggester } from '../core/suggester.js';
import { Executor } from '../core/executor.js';
import { Database } from '../storage/database.js';
import { formatSize } from '../ui/colors.js';
import { getCategoryIcon } from '../utils/mime.js';

export function registerPreviewCommand(program: Command): void {
  program
    .command('preview <path>')
    .description('Interactive file browser with rule matching preview')
    .option('-d, --deep', 'Scan subdirectories recursively')
    .action(async (targetPath, options) => {
      const fullPath = resolve(expandPath(targetPath));

      if (!existsSync(fullPath)) {
        console.error(chalk.red(`Path not found: ${fullPath}`));
        process.exit(1);
      }

      console.log(chalk.bold(`\n  Preview: ${chalk.cyan(fullPath)}\n`));

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

        const spinner = ora('Scanning and analyzing files...').start();
        const files = await scanner.scan(fullPath, { recursive: options.deep || false });

        if (files.length === 0) {
          spinner.fail('No files found');
          return;
        }

        const analyzed = await analyzer.analyzeMany(files);
        spinner.succeed(`Found ${analyzed.length} files`);

        // Generate suggestions for all files
        const suggestions = suggester.generateSuggestions(analyzed, {
          baseDir: fullPath,
        });

        // Build a map of file path -> suggestion
        const suggestionMap = new Map(suggestions.map(s => [s.file.path, s]));

        // Interactive browsing loop
        let running = true;
        while (running) {
          // Build file list for selection
          const choices = analyzed.map(file => {
            const suggestion = suggestionMap.get(file.path);
            const icon = getCategoryIcon(file.category as Parameters<typeof getCategoryIcon>[0]);
            const size = formatSize(file.size);
            const dest = suggestion
              ? chalk.dim(` -> ${suggestion.ruleName}`)
              : chalk.dim(' (no rule)');

            return {
              name: `${icon} ${file.filename}  ${size}${dest}`,
              value: file.path,
              short: file.filename,
            };
          });

          choices.push({
            name: chalk.yellow('  Exit preview'),
            value: '__exit__',
            short: 'Exit',
          });

          const { selectedPath } = await inquirer.prompt([{
            type: 'list',
            name: 'selectedPath',
            message: 'Select a file to preview:',
            choices,
            pageSize: 15,
          }]);

          if (selectedPath === '__exit__') {
            running = false;
            continue;
          }

          // Show file details
          const file = analyzed.find(f => f.path === selectedPath);
          if (!file) continue;

          const suggestion = suggestionMap.get(file.path);

          showFileDetails(file, suggestion);

          // File actions
          const { fileAction } = await inquirer.prompt([{
            type: 'list',
            name: 'fileAction',
            message: 'Action:',
            choices: [
              ...(suggestion ? [
                { name: chalk.green(`Move to ${suggestion.destination}`), value: 'move' },
              ] : []),
              { name: 'Back to list', value: 'back' },
              { name: chalk.yellow('Exit preview'), value: 'exit' },
            ],
          }]);

          if (fileAction === 'exit') {
            running = false;
          } else if (fileAction === 'move' && suggestion) {
            try {
              await executor.execute(suggestion);
              console.log(chalk.green(`\n  Moved to: ${suggestion.destination}\n`));
              // Remove from analyzed list
              const idx = analyzed.indexOf(file);
              if (idx >= 0) analyzed.splice(idx, 1);
              suggestionMap.delete(file.path);
            } catch (error) {
              console.log(chalk.red(`\n  Error: ${error}\n`));
            }
          }
        }

        console.log(chalk.dim('\n  Preview closed.\n'));
      } catch (error) {
        console.error(chalk.red('Preview failed'));
        console.error(error);
        process.exit(1);
      } finally {
        db.close();
      }
    });
}

function showFileDetails(file: FileAnalysis, suggestion?: { destination: string; ruleName: string; confidence: number } | null): void {
  console.log(chalk.bold(`\n  File: ${file.filename}`));
  console.log(chalk.dim(`  Path: ${file.path}`));
  console.log(chalk.dim(`  Size: ${formatSize(file.size)}`));
  console.log(chalk.dim(`  Type: ${file.mimeType || 'unknown'}`));
  console.log(chalk.dim(`  Category: ${file.category || 'unknown'}`));
  console.log(chalk.dim(`  Modified: ${file.modified.toLocaleDateString()}`));

  if (suggestion) {
    console.log(chalk.cyan(`\n  Rule: ${suggestion.ruleName}`));
    console.log(chalk.cyan(`  Confidence: ${Math.round(suggestion.confidence * 100)}%`));
    console.log(chalk.cyan(`  Destination: ${suggestion.destination}`));
  } else {
    console.log(chalk.yellow('\n  No matching rule found'));
  }
  console.log();
}
