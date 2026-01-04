# API Reference

Sortora can be used as a library in your Node.js projects.

## Installation

```bash
npm install sortora
```

## Quick Example

```typescript
import { Scanner, Analyzer, RuleEngine, Suggester } from 'sortora';

// Initialize components
const scanner = new Scanner();
const analyzer = new Analyzer('/path/to/models');
const ruleEngine = new RuleEngine(config);
const suggester = new Suggester(ruleEngine, config);

// Scan and analyze
const files = await scanner.scan('/path/to/folder');
const analyzed = await analyzer.analyzeMany(files);

// Get suggestions
const suggestions = suggester.generateSuggestions(analyzed, {
  baseDir: '/path/to/folder',
});

// Process suggestions
for (const suggestion of suggestions) {
  console.log(`${suggestion.file.filename} → ${suggestion.destination}`);
}
```

## Core Classes

### Scanner

Scans directories for files.

```typescript
import { Scanner } from 'sortora';

const scanner = new Scanner(database);

// Scan a directory
const files = await scanner.scan('/path', {
  recursive: true,
  findDuplicates: true,
});

// Find duplicates
const duplicates = scanner.findDuplicates(analyzedFiles);
```

#### Methods

| Method | Description |
|--------|-------------|
| `scan(path, options)` | Scan directory for files |
| `findDuplicates(files)` | Find duplicate files by hash |

#### Scan Options

```typescript
interface ScanOptions {
  recursive?: boolean;      // Scan subdirectories
  findDuplicates?: boolean; // Calculate file hashes
}
```

### Analyzer

Analyzes file metadata and content.

```typescript
import { Analyzer } from 'sortora';

const analyzer = new Analyzer('/path/to/models');

// Enable AI features
await analyzer.enableAI();

// Analyze single file
const analysis = await analyzer.analyze('/path/to/file.pdf', true);

// Analyze multiple files
const analyses = await analyzer.analyzeMany(files, {
  parallel: 5,
  useAI: true,
});
```

#### Methods

| Method | Description |
|--------|-------------|
| `enableAI()` | Load AI models |
| `isAIEnabled()` | Check if AI is ready |
| `analyze(path, useAI)` | Analyze single file |
| `analyzeMany(files, options)` | Analyze multiple files |
| `classifyWithAI(analysis)` | Classify using AI |
| `getEmbedding(analysis)` | Get semantic embedding |
| `findSimilar(analysis, candidates)` | Find similar files |

#### FileAnalysis Type

```typescript
interface FileAnalysis {
  path: string;
  filename: string;
  extension: string;
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  mimeType: string | null;
  category: FileCategory;
  hash?: string;
  metadata?: FileMetadata;
  textContent?: string;
  embedding?: number[];
  aiCategory?: string;
  aiConfidence?: number;
}
```

### RuleEngine

Matches files against rules.

```typescript
import { RuleEngine } from 'sortora';

const ruleEngine = new RuleEngine(config);

// Match single file
const match = ruleEngine.match(analysis, {
  baseDir: '/path/to/folder',
  useGlobalDestinations: false,
});

// Get all matching rules
const matches = ruleEngine.matchAll(analysis);

// Manage rules
ruleEngine.addRule(customRule);
ruleEngine.removeRule('Rule Name');
const rules = ruleEngine.getRules();
```

#### Rule Type

```typescript
interface Rule {
  name: string;
  priority: number;
  match: {
    extension?: string[];
    filename?: string[];
    type?: string;
    hasExif?: boolean;
    contentContains?: string[];
    location?: string;
    age?: string;
    accessed?: string;
  };
  useAi?: boolean;
  action: {
    moveTo?: string;
    suggestTo?: string;
    archiveTo?: string;
    delete?: boolean;
    confirm?: boolean;
  };
}
```

### Suggester

Generates organization suggestions.

```typescript
import { Suggester } from 'sortora';

const suggester = new Suggester(ruleEngine, config);

// Generate suggestions
const suggestions = suggester.generateSuggestions(analyses, {
  baseDir: '/path/to/folder',
  useGlobalDestinations: false,
});

// Get alternatives
const alternatives = suggester.getAlternatives(analysis, 3);

// Group suggestions
const byDestination = suggester.groupByDestination(suggestions);
const byAction = suggester.groupByAction(suggestions);
```

#### Suggestion Type

```typescript
interface Suggestion {
  file: FileAnalysis;
  destination: string;
  ruleName: string;
  confidence: number;
  action: 'move' | 'copy' | 'delete' | 'archive';
  requiresConfirmation: boolean;
}
```

### Executor

Executes file operations.

```typescript
import { Executor } from 'sortora';

const executor = new Executor(database);

// Execute single suggestion
await executor.execute(suggestion);

// Execute multiple
await executor.executeMany(suggestions, {
  parallel: 3,
  onProgress: (current, total) => {
    console.log(`${current}/${total}`);
  },
});

// Undo operations
const operations = await executor.getRecentOperations(10);
await executor.undo(operationId);
await executor.undoAll();
```

## Utility Functions

### File System

```typescript
import {
  exists,
  isReadable,
  isWritable,
  getFileInfo,
  safeCopy,
  safeMove,
  safeDelete,
  listDirectory,
} from 'sortora';

// Check file
const fileExists = await exists('/path/to/file');
const info = await getFileInfo('/path/to/file');

// Safe operations
await safeCopy(source, destination);
await safeMove(source, destination);
await safeDelete(path, toTrash);

// List directory
const files = await listDirectory('/path', {
  recursive: true,
  includeHidden: false,
  maxDepth: 10,
});
```

### Path Utilities

```typescript
import {
  expandTilde,
  interpolatePath,
  sanitizeFilename,
  getExtension,
} from 'sortora';

// Expand ~ to home directory
const fullPath = expandTilde('~/Documents');

// Interpolate path template
const dest = interpolatePath('{year}/{month}/', { year: 2025, month: '01' });

// Sanitize filename
const safe = sanitizeFilename('file<>name.txt');
```

### MIME Types

```typescript
import {
  getMimeType,
  getFileCategory,
  isImage,
  isDocument,
  isCode,
} from 'sortora';

const mime = getMimeType('file.pdf'); // 'application/pdf'
const category = getFileCategory('file.pdf'); // 'document'
const isImg = isImage('photo.jpg'); // true
```

### Filename Analysis

```typescript
import { analyzeFilename } from 'sortora';

const analysis = analyzeFilename('Invoice_Acme_Corp_2025.pdf');
// {
//   documentType: 'invoice',
//   entity: 'Acme Corp',
//   year: 2025,
//   suggestedFolder: 'Finance/Invoices/Acme Corp'
// }
```

## Configuration

```typescript
import { loadConfig, saveConfig, getAppPaths } from 'sortora';

// Load configuration
const config = loadConfig();

// Modify and save
config.settings.mode = 'auto';
saveConfig(config);

// Get paths
const paths = getAppPaths();
// {
//   configDir: '~/.config/sortora',
//   dataDir: '~/.local/share/sortora',
//   ...
// }
```

## Database

```typescript
import { Database } from 'sortora';

const db = new Database('/path/to/db.sqlite');
await db.init();

// Operations are tracked automatically
// Use for custom queries if needed
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  FileAnalysis,
  FileCategory,
  Rule,
  RuleMatch,
  Suggestion,
  Config,
} from 'sortora';
```

## Next Steps

- [Examples](https://github.com/yourusername/sortora/tree/main/examples)
- [Contributing](../CONTRIBUTING.md)
