# Contributing to Sortora

Thank you for your interest in contributing to Sortora! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 8 or higher
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/sortora.git
   cd sortora
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Run in development mode:
   ```bash
   npm run dev
   ```

## Development

### Project Structure

```
sortora/
├── src/
│   ├── cli.ts           # CLI entry point
│   ├── index.ts         # Library exports
│   ├── config.ts        # Configuration
│   ├── core/            # Core logic
│   │   ├── scanner.ts
│   │   ├── analyzer.ts
│   │   ├── rule-engine.ts
│   │   ├── suggester.ts
│   │   └── executor.ts
│   ├── ai/              # AI features
│   ├── analyzers/       # File type analyzers
│   ├── storage/         # Database
│   ├── ui/              # CLI UI components
│   └── utils/           # Utilities
├── docs/                # Documentation
├── bin/                 # CLI binary
└── tests/               # Tests
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns
- Use meaningful variable names
- Add comments for complex logic

### Linting

```bash
npm run lint
```

## Making Changes

### Branches

- `main` - stable release
- `develop` - development branch
- `feature/*` - new features
- `fix/*` - bug fixes

### Commit Messages

Follow conventional commits:

```
feat: add new file type detection
fix: correct path handling on Windows
docs: update installation guide
refactor: simplify rule matching logic
test: add tests for filename analyzer
```

### Pull Request Process

1. Create a branch from `develop`:
   ```bash
   git checkout -b feature/my-feature develop
   ```

2. Make your changes

3. Write tests if applicable

4. Update documentation if needed

5. Run tests and lint:
   ```bash
   npm test
   npm run lint
   ```

6. Commit and push:
   ```bash
   git commit -m "feat: description"
   git push origin feature/my-feature
   ```

7. Open a Pull Request against `develop`

## Adding Features

### New File Type Analyzer

1. Create analyzer in `src/analyzers/`:
   ```typescript
   // src/analyzers/mytype.ts
   export async function analyzeMyType(
     filePath: string,
     filename: string
   ): Promise<MyTypeMetadata> {
     // Implementation
   }
   ```

2. Register in `src/analyzers/index.ts`

3. Add MIME types in `src/utils/mime.ts`

### New Organization Rule

1. Add rule in `src/core/rule-engine.ts` in `getDefaultRules()`

2. Test with:
   ```bash
   sortora organize ~/test-folder --dry-run
   ```

### New CLI Command

1. Add command in `src/cli.ts`:
   ```typescript
   program
     .command('mycommand <arg>')
     .description('Description')
     .action(async (arg) => {
       // Implementation
     });
   ```

## Reporting Bugs

When reporting bugs, please include:

1. Sortora version (`sortora --version`)
2. Node.js version (`node --version`)
3. Operating system
4. Steps to reproduce
5. Expected behavior
6. Actual behavior
7. Error messages/logs

## Feature Requests

For feature requests, please:

1. Check if it already exists as an issue
2. Describe the use case
3. Explain why it would be useful
4. Consider if it could be a plugin

## Code of Conduct

- Be respectful and inclusive
- Accept constructive criticism
- Focus on what's best for the project
- Show empathy towards others

## Questions?

- Open an issue with the "question" label
- Check existing issues and documentation first

Thank you for contributing!
