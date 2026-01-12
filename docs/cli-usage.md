# CLI Usage Guide

Complete guide to using Sortora from the command line.

## Getting Started

When you run `sortora` without any arguments, you'll see an animated banner with gradient colors:

```
   ███████╗ ██████╗ ██████╗ ████████╗ ██████╗ ██████╗  █████╗
   ██╔════╝██╔═══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔══██╗
   ███████╗██║   ██║██████╔╝   ██║   ██║   ██║██████╔╝███████║
   ╚════██║██║   ██║██╔══██╗   ██║   ██║   ██║██╔══██╗██╔══██║
   ███████║╚██████╔╝██║  ██║   ██║   ╚██████╔╝██║  ██║██║  ██║
   ╚══════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝

   Smart Offline File Organizer
   ───────────────────────────────────────────────────────
   v1.1.1
```

The banner features:
- Line-by-line animated reveal
- Cyan-to-blue gradient colors
- Typewriter effect for the tagline
- Version display

## Command Overview

```bash
sortora [command] [options]
```

### Available Commands

| Command | Description |
|---------|-------------|
| `sortora` | Show animated banner and help menu |
| `sortora setup` | Initialize Sortora and download AI models |
| `sortora scan <path>` | Scan directory and analyze files |
| `sortora organize <path>` | Organize files based on rules |
| `sortora watch <path>` | Monitor directory for new files |
| `sortora duplicates <path>` | Find and manage duplicate files |
| `sortora undo` | Undo recent operations |
| `sortora rules` | Manage organization rules |

## Setup Command

Initialize Sortora and optionally download AI models.

```bash
# Full setup with AI models (~100 MB)
sortora setup

# Minimal setup without AI
sortora setup --minimal

# Full setup with all OCR languages
sortora setup --full
```

### What Setup Does

1. Creates configuration directory (`~/.config/sortora/`)
2. Initializes SQLite database
3. Downloads AI models (unless `--minimal`):
   - Embedding model (MiniLM ~23 MB)
   - Classifier model (MobileBERT ~25 MB)
   - OCR engine (Tesseract ~15 MB)

## Scan Command

Scan a directory and analyze files without making changes.

```bash
sortora scan <path> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-d, --deep` | Scan subdirectories recursively |
| `--duplicates` | Calculate file hashes to find duplicates |
| `--ai` | Use AI for smart classification |
| `--json` | Output results as JSON |

### Examples

```bash
# Basic scan
sortora scan ~/Downloads

# Recursive scan with AI
sortora scan ~/Documents -d --ai

# Scan and find duplicates
sortora scan ~/Pictures --duplicates

# Export to JSON
sortora scan ~/Downloads --json > scan-results.json
```

### Output

The scan command displays:
- Total files found
- File categories breakdown
- Size statistics
- AI classifications (if `--ai` enabled)
- Duplicate groups (if `--duplicates` enabled)

## Organize Command

Organize files based on smart rules and AI classification.

```bash
sortora organize <path> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-d, --deep` | Scan subdirectories recursively |
| `--dry-run` | Preview changes without applying |
| `-i, --interactive` | Confirm each action |
| `--auto` | Apply all suggestions automatically |
| `--global` | Move files to global destinations |
| `--confidence <n>` | Minimum confidence for auto mode (0-1) |

### Organization Modes

#### Local Mode (Default)

Files are organized within the target directory:

```bash
sortora organize ~/Downloads

# Result:
# ~/Downloads/Documents/
# ~/Downloads/Code/
# ~/Downloads/Screenshots/
```

#### Global Mode

Files are moved to system directories:

```bash
sortora organize ~/Downloads --global

# Result:
# ~/Documents/...
# ~/Pictures/...
# ~/Projects/...
```

### Examples

```bash
# Preview what will happen
sortora organize ~/Downloads --dry-run

# Interactive mode - confirm each action
sortora organize ~/Downloads -i

# Automatic mode with high confidence threshold
sortora organize ~/Downloads --auto --confidence 0.9

# Deep scan with global destinations
sortora organize ~/Documents -d --global
```

### Interactive Mode Actions

When running with `-i` or `--interactive`:

- **Accept**: Apply the suggested action
- **Skip**: Skip this file
- **Edit destination**: Manually specify destination
- **Quit**: Stop processing

## Watch Command

Monitor a directory for new files and organize them automatically.

```bash
sortora watch <path> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--auto` | Automatically organize new files |

### Examples

```bash
# Watch and suggest
sortora watch ~/Downloads

# Watch and auto-organize
sortora watch ~/Downloads --auto
```

Press `Ctrl+C` to stop watching.

## Duplicates Command

Find and manage duplicate files.

```bash
sortora duplicates <path> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--clean` | Remove duplicates interactively |

### Examples

```bash
# Find duplicates
sortora duplicates ~/Pictures

# Find and clean duplicates
sortora duplicates ~/Documents --clean
```

The command shows:
- Number of duplicate groups
- Total space that could be freed
- List of duplicate files

## Undo Command

Undo recent file operations.

```bash
sortora undo [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--all` | Show all recent operations |
| `--id <id>` | Undo specific operation by ID |

### Examples

```bash
# Undo last operation
sortora undo

# Show operation history
sortora undo --all

# Undo specific operation
sortora undo --id 42
```

## Rules Command

Manage organization rules.

```bash
sortora rules [action] [file]
```

### Actions

| Action | Description |
|--------|-------------|
| `list` | List all active rules |
| `add` | Add a new custom rule |
| `test <file>` | Test which rule matches a file |
| `edit` | Open rules file in editor |

### Examples

```bash
# List all rules
sortora rules list

# Test a specific file
sortora rules test ~/Downloads/report.pdf

# Add new rule interactively
sortora rules add

# Edit rules file
sortora rules edit
```

## Global Options

These options work with all commands:

| Option | Description |
|--------|-------------|
| `-V, --version` | Show version number |
| `-h, --help` | Show help for command |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error occurred |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SORTORA_CONFIG_DIR` | Custom config directory |
| `SORTORA_DATA_DIR` | Custom data directory |
| `SORTORA_NO_AI` | Disable AI features |
| `EDITOR` | Editor for `rules edit` |

## Tips and Tricks

### Preview Before Organizing

Always use `--dry-run` first to see what will happen:

```bash
sortora organize ~/Downloads --dry-run
```

### Combine with Other Tools

```bash
# Organize and log results
sortora organize ~/Downloads --auto 2>&1 | tee organize.log

# Watch for new files in background
sortora watch ~/Downloads --auto &
```

### Custom Confidence Threshold

Use higher confidence in auto mode for more accurate results:

```bash
sortora organize ~/Downloads --auto --confidence 0.95
```

### Recursive Organization

For nested directories:

```bash
sortora organize ~/Projects -d
```

## Next Steps

- [Configuration](configuration.md) - Customize settings
- [Rules System](rules.md) - Create custom rules
- [AI Features](ai-features.md) - Enable smart classification
