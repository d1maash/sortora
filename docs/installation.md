# Installation Guide

## Requirements

- **Node.js** 18.0 or higher
- **npm** 8.0 or higher
- **Disk space**: ~50 MB for base, ~150 MB with AI models

## Quick Install

```bash
npm install -g sortora
```

## Verify Installation

```bash
sortora --version
# Output: 0.1.0
```

## Initial Setup

Run the setup command to initialize the database and optionally download AI models:

```bash
# Full setup with AI models (~100 MB download)
sortora setup

# Minimal setup without AI models
sortora setup --minimal
```

### What Setup Does

1. Creates config directory: `~/.config/sortora/`
2. Creates data directory: `~/.local/share/sortora/`
3. Initializes SQLite database
4. Downloads AI models (optional):
   - MiniLM embedding model (~23 MB)
   - MobileBERT classifier (~25 MB)
   - Tesseract OCR engine (~15 MB)

## Directory Structure

After setup, Sortora creates the following directories:

```
~/.config/sortora/
├── config.yaml      # Main configuration
└── rules.yaml       # Custom rules

~/.local/share/sortora/
├── sortora.db       # SQLite database
├── models/          # AI models cache
└── cache/           # Analysis cache
```

## Platform-Specific Notes

### macOS

Works out of the box. Trash integration uses `~/.Trash`.

### Linux

Works out of the box. Trash uses `~/.local/share/Trash/files/`.

### Windows

Works with some limitations:
- Use PowerShell or Git Bash
- Trash uses `~/.sortora-trash` (custom folder)

## Updating

```bash
npm update -g sortora
```

## Uninstalling

```bash
# Remove the package
npm uninstall -g sortora

# Optionally remove data (manual)
rm -rf ~/.config/sortora
rm -rf ~/.local/share/sortora
```

## Troubleshooting

### "Command not found"

Make sure npm global bin is in your PATH:

```bash
# Check npm bin location
npm bin -g

# Add to PATH if needed
export PATH="$(npm bin -g):$PATH"
```

### "Node version too old"

Update Node.js to version 18 or higher:

```bash
# Using nvm
nvm install 18
nvm use 18

# Or download from nodejs.org
```

### "AI models failed to download"

Try running setup again:

```bash
sortora setup
```

Or use minimal mode:

```bash
sortora setup --minimal
```

## Next Steps

- [Configuration](configuration.md) - Customize Sortora
- [Quick Start](../README.md#quick-start) - Start organizing
