import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { resolve } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { platform } from 'os';
import YAML from 'yaml';

import { loadConfig, saveConfig, getAppPaths, expandPath } from '../config.js';
import { Analyzer } from '../core/analyzer.js';
import { RuleEngine } from '../core/rule-engine.js';
import { Database } from '../storage/database.js';

export function registerRulesCommand(program: Command): void {
  program
    .command('rules')
    .description('Manage organization rules')
    .argument('[action]', 'list, add, test <file>, edit, export [file], import <file>')
    .argument('[file]', 'File path for test/export/import action')
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
        try {
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
        } finally {
          db.close();
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
        // #2: Fix editor fallback for Windows
        let editor: string;
        if (process.env.EDITOR) {
          editor = process.env.EDITOR;
        } else if (platform() === 'win32') {
          editor = 'notepad';
        } else {
          editor = 'nano';
        }

        const { spawn } = await import('child_process');
        spawn(editor, [paths.configFile], { stdio: 'inherit' });
        return;
      }

      // #20: Export rules to a YAML file
      if (action === 'export') {
        const exportPath = file ? resolve(expandPath(file)) : resolve('sortora-rules.yaml');

        const rulesData = {
          version: 1,
          rules: config.rules,
        };

        const yamlContent = YAML.stringify(rulesData);
        writeFileSync(exportPath, yamlContent, 'utf-8');

        console.log(chalk.green(`\n  Rules exported to: ${exportPath}`));
        console.log(chalk.dim(`  ${config.rules.length} rule(s) exported.\n`));
        return;
      }

      // #20: Import rules from a YAML file
      if (action === 'import') {
        if (!file) {
          console.log(chalk.red('\n  Please specify a file to import: sortora rules import <file>\n'));
          return;
        }

        const importPath = resolve(expandPath(file));

        if (!existsSync(importPath)) {
          console.error(chalk.red(`File not found: ${importPath}`));
          process.exit(1);
        }

        try {
          const content = readFileSync(importPath, 'utf-8');
          const parsed = YAML.parse(content);

          if (!parsed || !Array.isArray(parsed.rules)) {
            console.log(chalk.red('\n  Invalid rules file format. Expected { rules: [...] }\n'));
            return;
          }

          const importedRules = parsed.rules;

          const { mode } = await inquirer.prompt([{
            type: 'list',
            name: 'mode',
            message: `Import ${importedRules.length} rule(s). How?`,
            choices: [
              { name: 'Merge with existing rules', value: 'merge' },
              { name: 'Replace all existing rules', value: 'replace' },
              { name: 'Cancel', value: 'cancel' },
            ],
          }]);

          if (mode === 'cancel') {
            console.log(chalk.yellow('\n  Import cancelled.\n'));
            return;
          }

          if (mode === 'replace') {
            config.rules = importedRules;
          } else {
            // Merge: add rules that don't exist by name
            const existingNames = new Set(config.rules.map(r => r.name));
            let added = 0;
            for (const rule of importedRules) {
              if (!existingNames.has(rule.name)) {
                config.rules.push(rule);
                added++;
              }
            }
            console.log(chalk.dim(`  ${added} new rule(s) added, ${importedRules.length - added} skipped (duplicate names).`));
          }

          saveConfig(config);
          console.log(chalk.green(`\n  Rules imported successfully. Total: ${config.rules.length} rule(s).\n`));
        } catch (error) {
          console.error(chalk.red(`\n  Failed to import rules: ${error instanceof Error ? error.message : error}\n`));
        }
        return;
      }

      console.log(chalk.yellow('\n  Unknown action. Use: list, add, test <file>, edit, export [file], import <file>\n'));
    });
}
