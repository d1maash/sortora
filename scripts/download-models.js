#!/usr/bin/env node

/**
 * Post-install script for downloading AI models
 * Models are downloaded on first use, this script just ensures the directory exists
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const modelsDir = join(homedir(), '.local', 'share', 'sortora', 'models');

if (!existsSync(modelsDir)) {
  mkdirSync(modelsDir, { recursive: true });
  console.log('Sortora: Created models directory at', modelsDir);
}

console.log('Sortora: Models will be downloaded on first use');
console.log('Sortora: Run "sortora setup" to pre-download models');
