<p align="center">
  <img src="docs/assets/logo.png" alt="Sortora" width="120" />
</p>

<h1 align="center">Sortora</h1>

<p align="center">
  <strong>Smart offline file organizer with AI-powered classification</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#commands">Commands</a> •
  <a href="#documentation">Docs</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/sortora?color=blue" alt="npm version" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node version" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="license" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey" alt="platform" />
</p>

---

## What is Sortora?

Sortora is an intelligent CLI tool that automatically organizes your files using smart filename analysis and optional AI classification. It works **100% offline** - no cloud services, no data leaving your machine.

```bash
# Organize your Downloads folder
sortora organize ~/Downloads

# Preview what will happen (dry run)
sortora organize ~/Downloads --dry-run
```

**Before:**
```
~/Downloads/
├── Договор ООО Ромашка 2025.pdf
├── Invoice_Acme_Corp_January_2025.pdf
├── John-Smith-Resume.docx
├── react-components.tsx
├── api-server.py
├── Снимок экрана 2025-01-15.png
└── ... 50 more files
```

**After:**
```
~/Downloads/
├── Contracts/
│   └── Ромашка/
│       └── 2025/
│           └── Договор ООО Ромашка 2025.pdf
├── Finance/
│   └── Invoices/
│       └── Acme Corp/
│           └── Invoice_Acme_Corp_January_2025.pdf
├── Documents/
│   └── Resumes/
│       └── John Smith/
│           └── John-Smith-Resume.docx
├── Code/
│   ├── React/
│   │   └── Components/
│   │       └── react-components.tsx
│   └── Python/
│       └── api-server.py
└── Screenshots/
    └── 2025-01/
        └── Снимок экрана 2025-01-15.png
```

## Features

### Smart Filename Analysis
- **Extracts company names**: `Договор ООО Ромашка` → `Contracts/Ромашка/`
- **Extracts person names**: `John-Smith-Resume.pdf` → `Resumes/John Smith/`
- **Detects document types**: contracts, invoices, resumes, reports
- **Recognizes dates**: organizes by year/month from filename

### Code File Organization
- **Groups by language**: Python, JavaScript, Go, Rust, etc.
- **Detects file type**: components, configs, utils, tests, styles
- **Framework awareness**: React, Vue, Svelte components

### AI Classification (Optional)
- **Zero-shot classification** using MobileBERT
- **Semantic embeddings** using MiniLM
- **OCR support** for scanned documents
- **100% offline** - models run locally

### Safe Operations
- **Dry run mode** - preview changes before applying
- **Interactive mode** - confirm each action
- **Undo support** - rollback any operation
- **Trash integration** - deleted files go to trash

## Installation

```bash
# Install globally
npm install -g sortora

# Run setup to download AI models (optional)
sortora setup
```

### Requirements
- Node.js 18 or higher
- ~100 MB disk space for AI models (optional)

## Quick Start

### 1. Scan a directory
```bash
sortora scan ~/Downloads
```

### 2. Preview organization
```bash
sortora organize ~/Downloads --dry-run
```

### 3. Organize files
```bash
# Interactive mode (confirm each action)
sortora organize ~/Downloads -i

# Auto mode (apply all suggestions)
sortora organize ~/Downloads --auto
```

## Commands

| Command | Description |
|---------|-------------|
| `sortora setup` | Initial setup, download AI models |
| `sortora scan <path>` | Scan and analyze files |
| `sortora organize <path>` | Organize files based on rules |
| `sortora watch <path>` | Watch folder and auto-organize |
| `sortora duplicates <path>` | Find duplicate files |
| `sortora undo` | Undo last operation |
| `sortora rules list` | List all rules |

### Organize Options

```bash
sortora organize <path> [options]

Options:
  -d, --deep          Scan subdirectories recursively
  --dry-run           Preview changes without applying
  -i, --interactive   Confirm each action
  --auto              Apply all suggestions automatically
  --global            Move files to global destinations (~/Documents, etc.)
  --confidence <n>    Minimum confidence for auto mode (0-1)
```

### Organization Modes

**Local Mode (default)**
Files are organized within the target directory:
```bash
sortora organize ~/Downloads
# Creates: ~/Downloads/Documents/, ~/Downloads/Code/, etc.
```

**Global Mode**
Files are moved to system directories:
```bash
sortora organize ~/Downloads --global
# Moves to: ~/Documents/, ~/Pictures/, ~/Projects/, etc.
```

## Supported File Types

### Documents
| Type | Extensions | Smart Sorting |
|------|------------|---------------|
| Contracts | pdf, docx | `Contracts/{Company}/{Year}/` |
| Invoices | pdf | `Finance/Invoices/{Company}/` |
| Resumes | pdf, docx | `Documents/Resumes/{Name}/` |
| Reports | xlsx, pdf | `Documents/Reports/{Year}/` |
| Presentations | pptx, key | `Documents/Presentations/` |

### Code
| Language | Extensions | Smart Sorting |
|----------|------------|---------------|
| JavaScript/TypeScript | js, ts, jsx, tsx | `Code/{Language}/{Type}/` |
| Python | py | `Code/Python/` |
| Go | go | `Code/Go/` |
| Vue/React/Svelte | vue, jsx, tsx | `Code/{Framework}/Components/` |
| Config | json, yaml, toml | `Code/Config/` |
| SQL | sql | `Code/Database/` |

### Media
| Type | Extensions | Smart Sorting |
|------|------------|---------------|
| Screenshots | png, jpg | `Screenshots/{Year}-{Month}/` |
| Photos | jpg, heic, raw | `Photos/{Year}/{Month}/` |
| Music | mp3, flac | `Music/{Artist}/{Album}/` |
| Video | mp4, mkv | `Videos/{Year}/` |

## Configuration

Config file location: `~/.config/sortora/config.yaml`

```yaml
version: 1

settings:
  mode: suggest  # or 'auto'
  confirmDestructive: true
  ignoreHidden: true
  ignorePatterns:
    - "*.tmp"
    - ".DS_Store"

destinations:
  photos: ~/Pictures/Sorted
  documents: ~/Documents/Sorted
  code: ~/Projects
  music: ~/Music/Sorted
```

## Documentation

- [Installation Guide](docs/installation.md)
- [Configuration](docs/configuration.md)
- [Rules System](docs/rules.md)
- [AI Features](docs/ai-features.md)
- [API Reference](docs/api.md)
- [FAQ](docs/faq.md)

## Why Sortora?

| Feature | Sortora | Others |
|---------|---------|--------|
| Works offline | Yes | Often require cloud |
| Smart filename analysis | Yes | Basic patterns |
| AI classification | Yes (optional) | Rarely |
| Code file support | Yes | No |
| Multi-language filenames | Yes (RU, EN) | Often EN only |
| Undo support | Yes | Rarely |
| Open source | Yes | Often paid |

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

```bash
# Clone the repo
git clone https://github.com/yourusername/sortora.git

# Install dependencies
npm install

# Run in development
npm run dev

# Build
npm run build
```

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Made with care for your messy folders
</p>
