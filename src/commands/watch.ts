import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'path';
import { existsSync } from 'fs';

import { loadConfig, getAppPaths, expandPath } from '../config.js';
import { Watcher } from '../core/watcher.js';
import { Database } from '../storage/database.js';

export function registerWatchCommand(program: Command): void {
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

      watcher.on('changed', (file) => {
        const time = new Date().toLocaleTimeString();
        console.log(chalk.dim(`${time} |`) + chalk.yellow(` Changed: ${file.filename}`));
      });

      watcher.on('organized', (_file, destination) => {
        console.log(chalk.green(`       -> ${destination}`));
      });

      watcher.on('error', (error) => {
        console.error(chalk.red(`       Error: ${error.message}`));
      });

      await watcher.start(fullPath, { auto: options.auto || false });

      // #6: Close DB on exit
      process.on('SIGINT', () => {
        watcher.stop();
        db.close();
        console.log(chalk.yellow('\n  Stopped watching.\n'));
        process.exit(0);
      });
    });
}
