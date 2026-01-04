import inquirer from 'inquirer';
import chalk from 'chalk';
import type { FileAnalysis } from '../core/analyzer.js';
import { formatSize, colorByCategory } from './colors.js';
import { getCategoryIcon } from '../utils/mime.js';

export type FileAction = 'accept' | 'skip' | 'edit' | 'quit' | 'always' | 'never';

export interface FileActionResult {
  action: FileAction;
  newDestination?: string;
  saveAsRule?: boolean;
}

export async function promptFileAction(
  file: FileAnalysis,
  destination: string,
  ruleName: string,
  confidence: number,
  progress: { current: number; total: number }
): Promise<FileActionResult> {
  const category = file.category || 'other';
  const icon = getCategoryIcon(category as any);
  const colorFn = colorByCategory(category);

  console.log();
  console.log(chalk.bold(`  [${progress.current}/${progress.total}] ${file.filename}`));
  console.log(chalk.dim(`  ${file.path}`));
  console.log(`  ${icon} ${colorFn(category)} • ${formatSize(file.size)}`);

  if (file.metadata) {
    const meta = Object.entries(file.metadata)
      .filter(([k]) => ['artist', 'album', 'title', 'author', 'camera'].includes(k))
      .map(([k, v]) => `${k}: ${v}`)
      .slice(0, 3);

    if (meta.length > 0) {
      console.log(chalk.dim(`  ${meta.join(' • ')}`));
    }
  }

  console.log();
  console.log(chalk.cyan(`  → ${destination}`));
  console.log(chalk.dim(`  Rule: ${ruleName} (${Math.round(confidence * 100)}%)`));
  console.log();

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Action:',
    choices: [
      { name: 'Accept', value: 'accept' },
      { name: 'Skip', value: 'skip' },
      { name: 'Edit destination', value: 'edit' },
      { name: 'Always apply this rule', value: 'always' },
      { name: 'Never apply this rule', value: 'never' },
      new inquirer.Separator(),
      { name: 'Quit', value: 'quit' },
    ],
  }]);

  if (action === 'edit') {
    const { newDest, saveRule } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newDest',
        message: 'New destination:',
        default: destination,
      },
      {
        type: 'confirm',
        name: 'saveRule',
        message: 'Save as rule for similar files?',
        default: false,
      },
    ]);

    return {
      action: 'accept',
      newDestination: newDest,
      saveAsRule: saveRule,
    };
  }

  return { action };
}

export async function confirmAction(
  message: string,
  defaultValue = false
): Promise<boolean> {
  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message,
    default: defaultValue,
  }]);

  return confirm;
}

export async function selectMultiple<T>(
  message: string,
  choices: { name: string; value: T; checked?: boolean }[]
): Promise<T[]> {
  const { selected } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'selected',
    message,
    choices,
  }]);

  return selected;
}

export async function selectOne<T>(
  message: string,
  choices: { name: string; value: T }[]
): Promise<T> {
  const { selected } = await inquirer.prompt([{
    type: 'list',
    name: 'selected',
    message,
    choices,
  }]);

  return selected;
}

export async function inputText(
  message: string,
  defaultValue?: string
): Promise<string> {
  const { value } = await inquirer.prompt([{
    type: 'input',
    name: 'value',
    message,
    default: defaultValue,
  }]);

  return value;
}

export async function inputNumber(
  message: string,
  defaultValue?: number
): Promise<number> {
  const { value } = await inquirer.prompt([{
    type: 'number',
    name: 'value',
    message,
    default: defaultValue,
  }]);

  return value;
}

export async function selectDuplicateAction(
  group: { hash: string; files: FileAnalysis[] }
): Promise<{ keep: string | null; delete: string[] }> {
  console.log();
  console.log(chalk.yellow(`  Duplicate group (${formatSize(group.files[0]?.size || 0)}):`));

  for (let i = 0; i < group.files.length; i++) {
    const file = group.files[i];
    console.log(chalk.dim(`  ${i + 1}. ${file.path}`));
  }

  console.log();

  const choices = [
    ...group.files.map((file, i) => ({
      name: `Keep #${i + 1}: ${file.filename}`,
      value: file.path,
    })),
    { name: 'Keep all (skip)', value: null },
  ];

  const { keep } = await inquirer.prompt([{
    type: 'list',
    name: 'keep',
    message: 'Which file to keep?',
    choices,
  }]);

  if (keep === null) {
    return { keep: null, delete: [] };
  }

  const toDelete = group.files
    .map(f => f.path)
    .filter(p => p !== keep);

  return { keep, delete: toDelete };
}

export async function promptSetupOptions(): Promise<{
  downloadModels: boolean;
  ocrLanguages: string[];
  watchFolders: string[];
}> {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'downloadModels',
      message: 'Download AI models (~100 MB)?',
      default: true,
    },
    {
      type: 'checkbox',
      name: 'ocrLanguages',
      message: 'Select OCR languages:',
      choices: [
        { name: 'English', value: 'eng', checked: true },
        { name: 'Russian', value: 'rus' },
        { name: 'German', value: 'deu' },
        { name: 'French', value: 'fra' },
        { name: 'Spanish', value: 'spa' },
        { name: 'Chinese (Simplified)', value: 'chi_sim' },
        { name: 'Japanese', value: 'jpn' },
      ],
      when: (ans) => ans.downloadModels,
    },
    {
      type: 'checkbox',
      name: 'watchFolders',
      message: 'Select folders to watch:',
      choices: [
        { name: '~/Downloads', value: '~/Downloads', checked: true },
        { name: '~/Desktop', value: '~/Desktop' },
        { name: '~/Documents', value: '~/Documents' },
        { name: '~/Pictures', value: '~/Pictures' },
      ],
    },
  ]);

  return {
    downloadModels: answers.downloadModels,
    ocrLanguages: answers.ocrLanguages || ['eng'],
    watchFolders: answers.watchFolders || ['~/Downloads'],
  };
}

export async function promptNewRule(): Promise<{
  name: string;
  extensions: string[];
  patterns: string[];
  destination: string;
  priority: number;
}> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Rule name:',
      validate: (input) => input.length > 0 || 'Name is required',
    },
    {
      type: 'input',
      name: 'extensions',
      message: 'File extensions (comma-separated, e.g., jpg,png):',
      filter: (input) => input.split(',').map((s: string) => s.trim()).filter(Boolean),
    },
    {
      type: 'input',
      name: 'patterns',
      message: 'Filename patterns (comma-separated, e.g., Screenshot*):',
      filter: (input) => input.split(',').map((s: string) => s.trim()).filter(Boolean),
    },
    {
      type: 'input',
      name: 'destination',
      message: 'Destination folder:',
      validate: (input) => input.length > 0 || 'Destination is required',
    },
    {
      type: 'number',
      name: 'priority',
      message: 'Priority (1-100, higher = checked first):',
      default: 50,
      validate: (input) => (input >= 1 && input <= 100) || 'Priority must be 1-100',
    },
  ]);

  return answers;
}
