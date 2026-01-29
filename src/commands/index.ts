import { Command } from 'commander';

import { registerSetupCommand } from './setup.js';
import { registerScanCommand } from './scan.js';
import { registerOrganizeCommand } from './organize.js';
import { registerWatchCommand } from './watch.js';
import { registerDuplicatesCommand } from './duplicates.js';
import { registerUndoCommand } from './undo.js';
import { registerRenameCommand } from './rename.js';
import { registerRulesCommand } from './rules.js';
import { registerStatsCommand } from './stats.js';
import { registerAICommand } from './ai.js';
import { registerPreviewCommand } from './preview.js';

export function registerAllCommands(program: Command): void {
  registerSetupCommand(program);
  registerScanCommand(program);
  registerOrganizeCommand(program);
  registerWatchCommand(program);
  registerDuplicatesCommand(program);
  registerUndoCommand(program);
  registerRenameCommand(program);
  registerRulesCommand(program);
  registerStatsCommand(program);
  registerAICommand(program);
  registerPreviewCommand(program);
}
