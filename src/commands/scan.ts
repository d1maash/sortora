import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { resolve } from 'path';
import { existsSync } from 'fs';

import { loadConfig, getAppPaths, expandPath, getAIProviderConfig, type AIProviderType } from '../config.js';
import { listProviders, type ProviderManagerConfig } from '../ai/providers/index.js';
import { Scanner } from '../core/scanner.js';
import { Analyzer } from '../core/analyzer.js';
import { Database } from '../storage/database.js';
import { renderScanStats, renderFileTable } from '../ui/table.js';
import { logger } from '../utils/logger.js';

export function registerScanCommand(program: Command): void {
  program
    .command('scan <path>')
    .description('Scan a directory and analyze files')
    .option('-d, --deep', 'Scan recursively')
    .option('--duplicates', 'Find duplicate files')
    .option('--ai', 'Use AI for smart classification')
    .option('--provider <provider>', 'AI provider to use (local, openai, anthropic, gemini, ollama)')
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

      try {
        await db.init();

        const scanner = new Scanner(db);
        const analyzer = new Analyzer(paths.modelsDir);

        // Enable AI if requested
        if (options.ai) {
          const config = loadConfig();
          const aiConfig = getAIProviderConfig(config);

          // Override provider if specified via CLI
          const providerType = (options.provider as AIProviderType) || aiConfig.provider;

          const providerConfig: ProviderManagerConfig = {
            provider: providerType,
            openai: aiConfig.openai,
            anthropic: aiConfig.anthropic,
            gemini: aiConfig.gemini,
            ollama: aiConfig.ollama,
            local: { modelsDir: paths.modelsDir },
          };

          const providerName = listProviders().find(p => p.type === providerType)?.name || providerType;
          const aiSpinner = ora(`Loading AI provider (${providerName})...`).start();

          try {
            await analyzer.enableAIWithProvider(providerConfig);
            aiSpinner.succeed(`AI provider loaded: ${analyzer.getActiveProviderName()}`);
          } catch (error) {
            aiSpinner.fail(`Failed to load AI provider. ${error instanceof Error ? error.message : ''}`);
            logger.error('AI error:', error);
          }
        }

        const spinner = ora('Scanning files...').start();

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
        const analyzed = await analyzer.analyzeMany(files, {
          useAI: options.ai && analyzer.isAIEnabled(),
        });
        analyzeSpinner.succeed(`Analysis complete (${analyzed.length} files)`);

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
                console.log(chalk.green(`      -> ${file.aiCategory} (${confidence}%)\n`));
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
        console.error(chalk.red('Scan failed'));
        console.error(error);
        process.exit(1);
      } finally {
        db.close();
      }
    });
}
