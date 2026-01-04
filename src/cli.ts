#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { resolve } from 'path';
import { existsSync } from 'fs';

import { VERSION, loadConfig, saveConfig, getAppPaths, ensureDirectories, expandPath } from './config.js';
import { Scanner } from './core/scanner.js';
import { Analyzer } from './core/analyzer.js';
import { RuleEngine } from './core/rule-engine.js';
import { Suggester } from './core/suggester.js';
import { Executor } from './core/executor.js';
import { Watcher } from './core/watcher.js';
import { Database } from './storage/database.js';
import { ModelManager } from './ai/model-manager.js';
import { renderScanStats, renderFileTable } from './ui/table.js';
import { logger } from './utils/logger.js';

const program = new Command();

program
  .name('sortora')
  .description('Offline AI file organizer')
  .version(VERSION);

// ═══════════════════════════════════════════════════════════════
// SETUP command
// ═══════════════════════════════════════════════════════════════
program
  .command('setup')
  .description('Initial setup - download AI models and create config')
  .option('--minimal', 'Skip AI models (~50 MB)')
  .option('--full', 'Include all languages for OCR (~120 MB)')
  .action(async (options) => {
    console.log(chalk.bold('\n  Sortora Setup\n'));

    ensureDirectories();
    const paths = getAppPaths();

    const spinner = ora('Initializing database...').start();
    try {
      const db = new Database(paths.databaseFile);
      await db.init();
      spinner.succeed('Database initialized');
    } catch (error) {
      spinner.fail('Failed to initialize database');
      console.error(error);
      process.exit(1);
    }

    if (!options.minimal) {
      const modelManager = new ModelManager(paths.modelsDir);

      console.log(chalk.dim('\n  Downloading AI models...\n'));

      const modelSpinner = ora('Loading embedding model (MiniLM ~23 MB)...').start();
      try {
        await modelManager.loadEmbeddings();
        modelSpinner.succeed('Embedding model loaded');
      } catch (error) {
        modelSpinner.fail('Failed to load embedding model');
        logger.error('Embedding model error:', error);
      }

      const classifierSpinner = ora('Loading classifier model (MobileBERT ~25 MB)...').start();
      try {
        await modelManager.loadClassifier();
        classifierSpinner.succeed('Classifier model loaded');
      } catch (error) {
        classifierSpinner.fail('Failed to load classifier model');
        logger.error('Classifier model error:', error);
      }

      const ocrSpinner = ora('Loading OCR engine (Tesseract ~15 MB)...').start();
      try {
        await modelManager.loadOCR(['eng']);
        ocrSpinner.succeed('OCR engine loaded');
      } catch (error) {
        ocrSpinner.fail('Failed to load OCR engine');
        logger.error('OCR engine error:', error);
      }
    }

    // Create default config
    const config = loadConfig();
    saveConfig(config);

    console.log(chalk.green('\n  Setup complete!\n'));
    console.log(chalk.dim(`  Config: ${paths.configFile}`));
    console.log(chalk.dim(`  Database: ${paths.databaseFile}`));
    console.log(chalk.dim(`  Models: ${paths.modelsDir}\n`));
    console.log(chalk.cyan('  Run: sortora scan ~/Downloads\n'));
  });

// ═══════════════════════════════════════════════════════════════
// SCAN command
// ═══════════════════════════════════════════════════════════════
program
  .command('scan <path>')
  .description('Scan a directory and analyze files')
  .option('-d, --deep', 'Scan recursively')
  .option('--duplicates', 'Find duplicate files')
  .option('--ai', 'Use AI for smart classification')
  .option('--json', 'Output as JSON')
  .action(async (targetPath, options) => {
    const fullPath = resolve(expandPath(targetPath));

    if (!existsSync(fullPath)) {
      console.error(chalk.red(`Path not found: ${fullPath}`));
      process.exit(1);
    }

    console.log(chalk.bold(`\n  Scanning ${chalk.cyan(fullPath)}...\n`));

    const paths = getAppPaths();
    const db = new Database(paths.databaseFile);
    await db.init();

    const scanner = new Scanner(db);
    const analyzer = new Analyzer(paths.modelsDir);

    // Enable AI if requested
    if (options.ai) {
      const aiSpinner = ora('Loading AI models...').start();
      try {
        await analyzer.enableAI();
        aiSpinner.succeed('AI models loaded');
      } catch (error) {
        aiSpinner.fail('Failed to load AI models. Run "sortora setup" first.');
        logger.error('AI error:', error);
      }
    }

    const spinner = ora('Scanning files...').start();

    try {
      const files = await scanner.scan(fullPath, {
        recursive: options.deep || false,
        findDuplicates: options.duplicates || false,
      });

      spinner.succeed(`Found ${files.length} files`);

      if (files.length === 0) {
        console.log(chalk.yellow('\n  No files found.\n'));
        return;
      }

      const analyzeSpinner = ora('Analyzing files...').start();
      const analyzed = await analyzer.analyzeMany(files, { useAI: options.ai && analyzer.isAIEnabled() });
      analyzeSpinner.succeed('Analysis complete');

      if (options.json) {
        console.log(JSON.stringify(analyzed, null, 2));
      } else {
        renderScanStats(analyzed);

        // Show file list with sizes
        console.log(chalk.bold('\n  Files:\n'));
        renderFileTable(analyzed);

        // Show AI classifications if enabled
        if (options.ai && analyzer.isAIEnabled()) {
          console.log(chalk.bold('\n  AI Classifications:\n'));
          for (const file of analyzed.slice(0, 10)) {
            if (file.aiCategory) {
              const confidence = Math.round((file.aiConfidence || 0) * 100);
              console.log(chalk.dim(`    ${file.filename}`));
              console.log(chalk.green(`      → ${file.aiCategory} (${confidence}%)\n`));
            }
          }
          if (analyzed.length > 10) {
            console.log(chalk.dim(`    ... and ${analyzed.length - 10} more files\n`));
          }
        }

        if (options.duplicates) {
          const duplicates = scanner.findDuplicates(analyzed);
          if (duplicates.length > 0) {
            console.log(chalk.yellow(`\n  Found ${duplicates.length} duplicate groups\n`));
          }
        }

        console.log(chalk.cyan(`\n  Run: sortora organize ${targetPath}\n`));
      }
    } catch (error) {
      spinner.fail('Scan failed');
      console.error(error);
      process.exit(1);
    }
  });

// ═══════════════════════════════════════════════════════════════
// ORGANIZE command
// ═══════════════════════════════════════════════════════════════
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
          break;
        }

        if (action === 'edit') {
          const { newDest } = await inquirer.prompt([{
            type: 'input',
            name: 'newDest',
            message: 'New destination:',
            default: suggestion.destination,
          }]);
          suggestion.destination = expandPath(newDest);
          shouldExecute = true;
        }

        shouldExecute = action === 'accept';
      }

      if (shouldExecute) {
        try {
          await executor.execute(suggestion);
          console.log(chalk.green('    Done'));
        } catch (error) {
          console.log(chalk.red(`    Error: ${error}`));
        }
      } else {
        console.log(chalk.dim('    Skipped'));
      }
    }

    console.log(chalk.green('\n  Organization complete!\n'));
  });

// ═══════════════════════════════════════════════════════════════
// WATCH command
// ═══════════════════════════════════════════════════════════════
program
  .command('watch <path>')
  .description('Monitor a directory for new files')
  .option('--auto', 'Automatically organize new files')
  .action(async (targetPath, options) => {
    const fullPath = resolve(expandPath(targetPath));

    if (!existsSync(fullPath)) {
      console.error(chalk.red(`Path not found: ${fullPath}`));
      process.exit(1);
    }

    console.log(chalk.bold(`\n  Watching ${chalk.cyan(fullPath)}`));
    console.log(chalk.dim('  Press Ctrl+C to stop\n'));

    const config = loadConfig();
    const paths = getAppPaths();
    const db = new Database(paths.databaseFile);
    await db.init();

    const watcher = new Watcher(db, config, paths.modelsDir);

    watcher.on('file', (file) => {
      const time = new Date().toLocaleTimeString();
      console.log(chalk.dim(`${time} |`) + chalk.cyan(` New: ${file.filename}`));
    });

    watcher.on('organized', (_file, destination) => {
      console.log(chalk.green(`       -> ${destination}`));
    });

    watcher.on('error', (error) => {
      console.error(chalk.red(`       Error: ${error.message}`));
    });

    await watcher.start(fullPath, { auto: options.auto || false });

    process.on('SIGINT', () => {
      watcher.stop();
      console.log(chalk.yellow('\n  Stopped watching.\n'));
      process.exit(0);
    });
  });

// ═══════════════════════════════════════════════════════════════
// DUPLICATES command
// ═══════════════════════════════════════════════════════════════
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
  });

// ═══════════════════════════════════════════════════════════════
// UNDO command
// ═══════════════════════════════════════════════════════════════
program
  .command('undo')
  .description('Undo recent operations')
  .option('--all', 'Show all operations')
  .option('--id <id>', 'Undo specific operation by ID')
  .action(async (options) => {
    const paths = getAppPaths();
    const db = new Database(paths.databaseFile);
    await db.init();

    const executor = new Executor(db);

    if (options.all) {
      const operations = db.getOperations(50);
      if (operations.length === 0) {
        console.log(chalk.yellow('\n  No operations to show.\n'));
        return;
      }

      console.log(chalk.bold('\n  Recent operations:\n'));
      for (const op of operations) {
        const date = new Date(op.createdAt * 1000).toLocaleString();
        const undone = op.undoneAt ? chalk.dim(' (undone)') : '';
        console.log(chalk.dim(`  #${op.id}`) + ` ${op.type}: ${op.source}${undone}`);
        console.log(chalk.dim(`       ${date}`));
      }
      return;
    }

    if (options.id) {
      const id = parseInt(options.id, 10);
      const success = await executor.undo(id);
      if (success) {
        console.log(chalk.green(`\n  Operation #${id} undone.\n`));
      } else {
        console.log(chalk.red(`\n  Could not undo operation #${id}.\n`));
      }
      return;
    }

    // Undo last operation
    const operations = db.getOperations(1);
    if (operations.length === 0) {
      console.log(chalk.yellow('\n  No operations to undo.\n'));
      return;
    }

    const lastOp = operations[0];
    if (lastOp.undoneAt) {
      console.log(chalk.yellow('\n  Last operation already undone.\n'));
      return;
    }

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Undo ${lastOp.type}: ${lastOp.source}?`,
      default: true,
    }]);

    if (confirm) {
      const success = await executor.undo(lastOp.id);
      if (success) {
        console.log(chalk.green('\n  Undone.\n'));
      } else {
        console.log(chalk.red('\n  Could not undo.\n'));
      }
    }
  });

// ═══════════════════════════════════════════════════════════════
// RULES command
// ═══════════════════════════════════════════════════════════════
program
  .command('rules')
  .description('Manage organization rules')
  .argument('[action]', 'list, add, test <file>, edit')
  .argument('[file]', 'File path for test action')
  .action(async (action, file) => {
    const config = loadConfig();
    const paths = getAppPaths();

    if (!action || action === 'list') {
      console.log(chalk.bold('\n  Organization Rules:\n'));

      if (config.rules.length === 0) {
        console.log(chalk.yellow('  No custom rules defined.'));
        console.log(chalk.dim('  Using default presets.\n'));
        return;
      }

      for (const rule of config.rules.sort((a, b) => b.priority - a.priority)) {
        console.log(chalk.cyan(`  ${rule.name}`) + chalk.dim(` (priority: ${rule.priority})`));
        if (rule.match.extension) {
          console.log(chalk.dim(`    Extensions: ${rule.match.extension.join(', ')}`));
        }
        if (rule.match.filename) {
          console.log(chalk.dim(`    Patterns: ${rule.match.filename.join(', ')}`));
        }
        if (rule.action.moveTo) {
          console.log(chalk.dim(`    -> ${rule.action.moveTo}`));
        }
        console.log();
      }
      return;
    }

    if (action === 'test' && file) {
      const fullPath = resolve(expandPath(file));
      if (!existsSync(fullPath)) {
        console.error(chalk.red(`File not found: ${fullPath}`));
        process.exit(1);
      }

      const db = new Database(paths.databaseFile);
      await db.init();

      const analyzer = new Analyzer(paths.modelsDir);
      const ruleEngine = new RuleEngine(config);

      const spinner = ora('Analyzing file...').start();
      const analysis = await analyzer.analyze(fullPath);
      spinner.succeed('Analysis complete');

      const matchedRule = ruleEngine.match(analysis);

      if (matchedRule) {
        console.log(chalk.green(`\n  Matched rule: ${matchedRule.rule.name}`));
        console.log(chalk.dim(`  Priority: ${matchedRule.rule.priority}`));
        if (matchedRule.destination) {
          console.log(chalk.cyan(`  Destination: ${matchedRule.destination}\n`));
        }
      } else {
        console.log(chalk.yellow('\n  No matching rule found.\n'));
      }
      return;
    }

    if (action === 'add') {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Rule name:',
        },
        {
          type: 'input',
          name: 'extensions',
          message: 'File extensions (comma-separated, e.g., jpg,png):',
        },
        {
          type: 'input',
          name: 'patterns',
          message: 'Filename patterns (comma-separated, e.g., Screenshot*):',
        },
        {
          type: 'input',
          name: 'destination',
          message: 'Destination folder:',
        },
        {
          type: 'number',
          name: 'priority',
          message: 'Priority (1-100):',
          default: 50,
        },
      ]);

      const newRule = {
        name: answers.name,
        priority: answers.priority,
        match: {
          extension: answers.extensions ? answers.extensions.split(',').map((s: string) => s.trim()) : undefined,
          filename: answers.patterns ? answers.patterns.split(',').map((s: string) => s.trim()) : undefined,
        },
        action: {
          moveTo: answers.destination,
        },
      };

      config.rules.push(newRule);
      saveConfig(config);

      console.log(chalk.green(`\n  Rule "${answers.name}" added.\n`));
      return;
    }

    if (action === 'edit') {
      const editor = process.env.EDITOR || 'nano';
      const { spawn } = await import('child_process');
      spawn(editor, [paths.configFile], { stdio: 'inherit' });
      return;
    }

    console.log(chalk.yellow('\n  Unknown action. Use: list, add, test <file>, edit\n'));
  });

// Parse and run
program.parse();
