#!/usr/bin/env node

import { Command } from 'commander';
import { VERSION } from './config.js';
import { showBanner } from './ui/banner.js';
import { registerAllCommands } from './commands/index.js';

const program = new Command();

program
  .name('sortora')
  .description('Offline AI file organizer')
  .version(VERSION);

registerAllCommands(program);

// #8: Graceful shutdown handlers
process.on('SIGTERM', () => {
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Show animated banner when run without arguments
async function main() {
  const args = process.argv.slice(2);

  // Show banner if no command or --help/--version
  if (args.length === 0) {
    await showBanner(true);
    program.outputHelp();
    return;
  }

  program.parse();
}

main().catch(console.error);
