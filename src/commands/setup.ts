import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

import { loadConfig, saveConfig, getAppPaths, ensureDirectories } from '../config.js';
import { Database } from '../storage/database.js';
import { ModelManager } from '../ai/model-manager.js';
import { logger } from '../utils/logger.js';

export function registerSetupCommand(program: Command): void {
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
      let db: Database | undefined;
      try {
        db = new Database(paths.databaseFile);
        await db.init();
        spinner.succeed('Database initialized');
      } catch (error) {
        spinner.fail('Failed to initialize database');
        console.error(error);
        process.exit(1);
      } finally {
        db?.close();
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
}
