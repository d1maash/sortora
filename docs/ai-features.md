# AI Features

Sortora includes optional AI-powered features that run 100% offline on your machine.

## Overview

| Feature | Model | Size | Purpose |
|---------|-------|------|---------|
| Classification | MobileBERT | ~25 MB | Categorize files |
| Embeddings | MiniLM | ~23 MB | Find similar files |
| OCR | Tesseract | ~15 MB | Read scanned documents |

## Setup

AI features require running setup:

```bash
# Download all AI models
sortora setup

# Or skip AI (use only rule-based sorting)
sortora setup --minimal
```

## Using AI Classification

Enable AI with the `--ai` flag:

```bash
# Scan with AI classification
sortora scan ~/Downloads --ai

# Organize with AI
sortora organize ~/Downloads --ai
```

### Classification Categories

The AI can classify files into these categories:

**Documents:**
- Work document
- Personal document
- Financial document
- Resume or CV
- Contract or legal
- Invoice or receipt
- Report or presentation
- Ebook or reading material

**Media:**
- Photo or image
- Screenshot
- Design or artwork
- Music or audio
- Video
- Podcast or recording

**Technical:**
- Code or programming
- Configuration file
- Database or data file
- Log file

**Other:**
- Download or installer
- Archive or backup
- Temporary or junk

## How It Works

### 1. Zero-Shot Classification

Sortora uses MobileBERT for zero-shot classification. This means it can categorize files without being specifically trained on your files.

```
Input: "Quarterly-Report-Q4-2024.xlsx"
→ Analyzes filename, extension, and content
→ Compares against category labels
→ Output: "report or presentation" (87% confidence)
```

### 2. Semantic Embeddings

MiniLM creates semantic embeddings (vector representations) of files:

```
Input: "meeting-notes-january.md"
→ Creates 384-dimensional vector
→ Can find similar files
→ Enables semantic search
```

### 3. OCR Processing

Tesseract OCR extracts text from images and scanned PDFs:

```
Input: scanned-invoice.pdf
→ Extracts visible text
→ Enables content-based classification
→ "INVOICE", "TOTAL: $500" → Financial document
```

## AI-Enhanced Rules

You can create rules that use AI:

```yaml
rules:
  - name: AI Work Documents
    priority: 80
    match:
      type: document
    useAi: true
    aiCategory: "work document"
    action:
      moveTo: "{destinations.work}/{year}/"
```

## Finding Similar Files

Use AI to find similar files:

```bash
# Find files similar to a specific file
sortora similar ~/Documents/report.pdf

# Find similar in a directory
sortora similar ~/Documents/report.pdf --in ~/Downloads
```

## Finding Duplicates

AI can find semantically similar (not just identical) files:

```bash
# Find duplicates using content hashing
sortora duplicates ~/Documents

# Find similar files using AI
sortora duplicates ~/Documents --ai
```

## Performance

### Model Loading
- First run: ~5-10 seconds (model loading)
- Subsequent runs: ~1-2 seconds (cached)

### Classification Speed
- ~50-100 files/second on modern CPU
- GPU not required

### Memory Usage
- ~200-300 MB RAM when AI is active
- ~50 MB RAM without AI

## Privacy

All AI processing happens locally:
- No internet connection required
- No data sent to external servers
- Models stored in `~/.local/share/sortora/models/`

## Disabling AI

If you don't need AI features:

```bash
# Skip AI during setup
sortora setup --minimal

# Run without AI
sortora organize ~/Downloads  # no --ai flag

# Disable AI globally
export SORTORA_NO_AI=true
```

## Troubleshooting

### "AI models not found"

```bash
sortora setup
```

### "Classification is slow"

First run loads models into memory. Subsequent operations are faster.

### "Wrong classification"

AI classification is a suggestion. Rules take precedence. You can:
1. Create specific rules for misclassified files
2. Use `--interactive` mode to confirm each action

## Technical Details

### Models Used

| Model | Source | License |
|-------|--------|---------|
| MobileBERT | Xenova/mobilebert-uncased-mnli | Apache 2.0 |
| MiniLM | Xenova/all-MiniLM-L6-v2 | Apache 2.0 |
| Tesseract | tesseract.js | Apache 2.0 |

### Frameworks

- **@xenova/transformers**: ONNX runtime for ML models
- **tesseract.js**: OCR engine

## Next Steps

- [Rules System](rules.md) - Combine AI with rules
- [Configuration](configuration.md) - Global settings
