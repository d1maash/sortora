# Frequently Asked Questions

## General

### Is Sortora safe to use?

Yes! Sortora is designed with safety in mind:
- **Dry run mode**: Preview changes before applying
- **Interactive mode**: Confirm each action
- **Trash support**: Deleted files go to trash, not permanent deletion
- **Undo support**: Rollback any operation
- **No network**: Works 100% offline

### Does Sortora send my files anywhere?

No. Sortora works entirely offline. No files or metadata are ever sent to external servers.

### What platforms are supported?

- macOS (10.15+)
- Linux (Ubuntu 18.04+, Fedora, Arch, etc.)
- Windows 10/11

### What Node.js version is required?

Node.js 18 or higher.

## Organization

### How does "local mode" differ from "global mode"?

**Local mode** (default) organizes files within the target directory:
```
sortora organize ~/Downloads
# Creates ~/Downloads/Documents/, ~/Downloads/Code/, etc.
```

**Global mode** moves files to system directories:
```
sortora organize ~/Downloads --global
# Moves to ~/Documents/, ~/Pictures/, ~/Projects/, etc.
```

### Can I undo an organization?

Yes! Use the undo command:

```bash
# Undo last operation
sortora undo

# Undo specific operation
sortora undo --id 123

# Undo all recent operations
sortora undo --all
```

### How do I preview what will happen?

Use dry run mode:

```bash
sortora organize ~/Downloads --dry-run
```

### Can I organize specific file types only?

Create custom rules or use interactive mode to skip unwanted files:

```bash
sortora organize ~/Downloads -i
```

## AI Features

### Are AI features required?

No. Sortora works great without AI using:
- Smart filename analysis
- Rule-based matching
- Extension and MIME type detection

AI is optional and adds:
- Zero-shot classification
- Similar file detection
- OCR for scanned documents

### How much space do AI models need?

About 100 MB for all models:
- MiniLM: ~23 MB
- MobileBERT: ~25 MB
- Tesseract OCR: ~15 MB
- Cache and metadata: ~10 MB

### Can I use Sortora without downloading AI models?

Yes:

```bash
sortora setup --minimal
```

### Why is the first run slow?

AI models are loaded into memory on first use. Subsequent operations are faster as models remain cached.

## Rules

### How do I create custom rules?

Create `~/.config/sortora/rules.yaml`:

```yaml
rules:
  - name: My Custom Rule
    priority: 80
    match:
      extension: [pdf]
      filename: ["*invoice*"]
    action:
      moveTo: ~/Documents/Invoices/
```

### Can I disable built-in rules?

Not directly, but you can override them with higher-priority custom rules.

### How do I see which rule matched a file?

Use dry run mode:

```bash
sortora organize ~/Downloads --dry-run
# Shows rule name and confidence for each suggestion
```

## Troubleshooting

### "Command not found: sortora"

Add npm global bin to your PATH:

```bash
export PATH="$(npm bin -g):$PATH"
```

### "Cannot find module" error

Reinstall Sortora:

```bash
npm uninstall -g sortora
npm install -g sortora
```

### "AI models failed to load"

Run setup again:

```bash
sortora setup
```

### Files aren't being detected

Check if files are ignored:
- Hidden files (starting with `.`)
- Patterns in `ignorePatterns` config
- Empty files (0 bytes)

### Wrong file classification

1. Create a specific rule for the file type
2. Use `--interactive` mode to correct
3. The rule system takes precedence over AI

### Organize command is slow

- Large directories take longer
- AI classification adds processing time
- Use `--no-ai` for faster processing

## Configuration

### Where are config files stored?

- Config: `~/.config/sortora/`
- Data: `~/.local/share/sortora/`
- On Windows: `%USERPROFILE%\.config\sortora\`

### How do I reset all settings?

```bash
rm -rf ~/.config/sortora
rm -rf ~/.local/share/sortora
sortora setup
```

### Can I use different configs for different folders?

Yes, create `.sortora.yaml` in any folder for local overrides.

## Privacy & Security

### Is my data safe?

- All processing happens locally
- No cloud services or APIs
- No telemetry or analytics
- Open source code you can audit

### What data is stored?

- File metadata (names, sizes, dates)
- Operation history (for undo)
- AI model cache
- No file contents are stored

### Can I delete stored data?

```bash
rm -rf ~/.local/share/sortora
```

## Contributing

### How can I contribute?

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

### How do I report bugs?

Open an issue on GitHub with:
- Sortora version (`sortora --version`)
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Error message

### Can I request features?

Yes! Open a GitHub issue with the "feature request" label.
