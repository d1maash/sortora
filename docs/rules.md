# Rules System

Sortora uses a powerful rules system to determine how files should be organized. Rules are matched against files based on various conditions.

## How Rules Work

1. Files are scanned and analyzed
2. Each file is matched against rules (highest priority first)
3. First matching rule determines the destination
4. Actions are suggested or applied

## Built-in Rules

Sortora comes with sensible default rules:

| Rule | Priority | Matches | Action |
|------|----------|---------|--------|
| Screenshots | 100 | `Screenshot*.png` | Move to Screenshots |
| Photos with EXIF | 90 | HEIC, RAW with EXIF data | Move to Photos by date |
| Resumes | 95 | `*resume*.pdf`, `*cv*.docx` | Move to Resumes |
| Contracts | 90 | `*contract*.pdf`, `*agreement*` | Move to Contracts |
| Invoices | 90 | `*invoice*.pdf`, `*receipt*` | Move to Finance |
| Frontend components | 75 | `.jsx`, `.tsx`, `.vue`, `.svelte` | Move to Code/Components |
| Config files | 80 | `.json`, `.yaml`, `.toml` | Move to Code/Config |
| Old installers | 100 | `.dmg`, `.exe` older than 30 days | Suggest delete |
| Temporary files | 100 | `.tmp`, `.bak`, `.swp` | Delete |

## Rule Structure

```yaml
name: Rule Name
priority: 50           # Higher = checked first (1-100)
match:
  extension: [pdf, docx]
  filename: ["*pattern*"]
  type: document
  hasExif: true
  contentContains: ["keyword"]
  location: ~/Downloads
  age: "> 30 days"
  accessed: "> 7 days"
useAi: false
action:
  moveTo: "{destinations.documents}/{year}/"
  suggestTo: "{destinations.documents}/"
  archiveTo: "{destinations.archives}/"
  delete: true
  confirm: true
```

## Match Conditions

### extension
Match files by extension (case-insensitive):

```yaml
match:
  extension: [pdf, docx, doc]
```

### filename
Match files by glob pattern:

```yaml
match:
  filename:
    - "Invoice*"
    - "*_report_*"
    - "Contract*"
```

### type
Match by file category:

```yaml
match:
  type: image    # image, document, audio, video, code, archive, executable, data
```

### hasExif
Match images with EXIF data:

```yaml
match:
  hasExif: true
```

### contentContains
Match by file content (text files only):

```yaml
match:
  contentContains:
    - "INVOICE"
    - "TOTAL:"
```

### location
Match files in specific directory:

```yaml
match:
  location: ~/Downloads
```

### age
Match by file age (modification time):

```yaml
match:
  age: "> 30 days"   # older than 30 days
  age: "< 7 days"    # newer than 7 days
```

Supported units: `days`, `weeks`, `months`, `years`

### accessed
Match by last access time:

```yaml
match:
  accessed: "> 90 days"  # not accessed in 90 days
```

## Actions

### moveTo
Move file to destination (auto-apply):

```yaml
action:
  moveTo: "{destinations.photos}/{year}/{month}/"
```

### suggestTo
Suggest moving (requires confirmation):

```yaml
action:
  suggestTo: "{destinations.documents}/{year}/"
```

### archiveTo
Compress and move to destination:

```yaml
action:
  archiveTo: "{destinations.archives}/{year}/"
```

### delete
Delete file (moves to trash by default):

```yaml
action:
  delete: true
  confirm: true   # always ask before deleting
```

## Path Variables

Use these variables in destination paths:

| Variable | Description | Example |
|----------|-------------|---------|
| `{year}` | File year | `2025` |
| `{month}` | File month (padded) | `01` |
| `{filename}` | Original filename | `report.pdf` |
| `{extension}` | File extension | `pdf` |
| `{category}` | File category | `document` |
| `{destinations.X}` | Configured destination | `~/Documents` |
| `{exif.year}` | EXIF date year | `2024` |
| `{exif.month}` | EXIF date month | `12` |
| `{audio.artist}` | Music artist | `Artist Name` |
| `{audio.album}` | Music album | `Album Name` |

## Custom Rules

Create custom rules in `~/.config/sortora/rules.yaml`:

```yaml
rules:
  # Move work documents to Work folder
  - name: Work Documents
    priority: 85
    match:
      extension: [pdf, docx, xlsx]
      filename: ["*report*", "*project*", "*meeting*"]
    action:
      moveTo: "{destinations.work}/{year}/"

  # Archive old downloads
  - name: Old Downloads
    priority: 50
    match:
      location: ~/Downloads
      age: "> 60 days"
    action:
      archiveTo: "{destinations.archives}/Old Downloads/"
      confirm: true

  # Delete crash reports
  - name: Crash Reports
    priority: 100
    match:
      filename: ["*.crash", "*.dmp", "hs_err_*"]
    action:
      delete: true
```

## Rule Priority

Rules are checked from highest to lowest priority. First match wins.

| Priority | Use Case |
|----------|----------|
| 100 | Cleanup rules (temp files, junk) |
| 90-95 | Specific document types |
| 80-85 | Category rules |
| 70-75 | General rules |
| 50-60 | Catch-all rules |

## Testing Rules

Test your rules without applying:

```bash
# See which rules match
sortora rules test ~/Downloads/file.pdf

# Dry run to see all suggestions
sortora organize ~/Downloads --dry-run
```

## Listing Rules

```bash
# List all active rules
sortora rules list

# List with details
sortora rules list --verbose
```

## Next Steps

- [AI Features](ai-features.md) - Smart classification
- [Configuration](configuration.md) - Global settings
