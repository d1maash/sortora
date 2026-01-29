import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';

import { getAppPaths } from '../config.js';
import { Executor } from '../core/executor.js';
import { Database } from '../storage/database.js';

export function registerUndoCommand(program: Command): void {
  program
    .command('undo')
    .description('Undo recent operations')
    .option('--all', 'Show all operations')
    .option('--id <id>', 'Undo specific operation by ID')
    .option('--last <n>', 'Undo last N operations')
    .option('--all-recent', 'Undo all recent undoable operations')
    .action(async (options) => {
      const paths = getAppPaths();
      const db = new Database(paths.databaseFile);

      try {
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

        // #22: Batch undo - undo last N operations
        if (options.last) {
          const count = parseInt(options.last, 10);
          if (isNaN(count) || count < 1) {
            console.log(chalk.red('\n  Invalid count. Use a positive number.\n'));
            return;
          }

          const operations = db.getOperations(count);
          const undoable = operations.filter(op => !op.undoneAt);

          if (undoable.length === 0) {
            console.log(chalk.yellow('\n  No undoable operations found.\n'));
            return;
          }

          console.log(chalk.bold(`\n  Undoing ${undoable.length} operation(s):\n`));

          let undoneCount = 0;
          let failedCount = 0;

          for (const op of undoable) {
            const success = await executor.undo(op.id);
            if (success) {
              console.log(chalk.green(`  #${op.id} ${op.type}: ${op.source} - undone`));
              undoneCount++;
            } else {
              console.log(chalk.red(`  #${op.id} ${op.type}: ${op.source} - failed`));
              failedCount++;
            }
          }

          console.log(chalk.bold(`\n  Summary: ${undoneCount} undone, ${failedCount} failed.\n`));
          return;
        }

        // #22: Batch undo - undo all recent undoable operations
        if (options.allRecent) {
          const operations = db.getOperations(100);
          const undoable = operations.filter(op => !op.undoneAt);

          if (undoable.length === 0) {
            console.log(chalk.yellow('\n  No undoable operations found.\n'));
            return;
          }

          const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Undo ${undoable.length} recent operations?`,
            default: false,
          }]);

          if (!confirm) {
            console.log(chalk.yellow('\n  Cancelled.\n'));
            return;
          }

          let undoneCount = 0;
          let failedCount = 0;

          for (const op of undoable) {
            const success = await executor.undo(op.id);
            if (success) {
              console.log(chalk.green(`  #${op.id} ${op.type}: ${op.source} - undone`));
              undoneCount++;
            } else {
              console.log(chalk.red(`  #${op.id} ${op.type}: ${op.source} - failed`));
              failedCount++;
            }
          }

          console.log(chalk.bold(`\n  Summary: ${undoneCount} undone, ${failedCount} failed.\n`));
          return;
        }

        // Default: Undo last operation
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
      } catch (error) {
        console.error(chalk.red('Undo failed'));
        console.error(error);
        process.exit(1);
      } finally {
        db.close();
      }
    });
}
