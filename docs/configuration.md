# Configuration

Sortora uses YAML configuration files located in `~/.config/sortora/`.

## Configuration Files

| File | Purpose |
|------|---------|
| `config.yaml` | Main settings and destinations |
| `rules.yaml` | Custom organization rules |

## Main Configuration

### Default Config

```yaml
version: 1

settings:
  mode: suggest           # 'suggest' or 'auto'
  confirmDestructive: true
  ignoreHidden: true
  ignorePatterns:
    - "*.tmp"
    - "*.crdownload"
    - ".DS_Store"
    - "Thumbs.db"
    - "desktop.ini"

destinations:
  photos: ~/Pictures/Sorted
  screenshots: ~/Pictures/Screenshots
  documents: ~/Documents/Sorted
  work: ~/Documents/Work
  finance: ~/Documents/Finance
  code: ~/Projects
  music: ~/Music/Sorted
  video: ~/Videos/Sorted
  archives: ~/Archives
  trash: ~/.Trash
```

### Settings

#### mode
- `suggest` (default): Show suggestions and ask for confirmation
- `auto`: Automatically apply high-confidence suggestions

#### confirmDestructive
When `true`, always ask before deleting files, even in auto mode.

#### ignoreHidden
When `true`, skip hidden files (starting with `.`).

#### ignorePatterns
List of glob patterns to ignore during scanning.

### Destinations

Destinations are named paths used in rules. You can customize where files should be moved:

```yaml
destinations:
  photos: ~/Dropbox/Photos       # Custom cloud folder
  documents: /mnt/nas/Documents  # Network storage
  code: ~/dev                    # Custom code folder
```

## Environment Variables

Some settings can be overridden with environment variables:

```bash
# Custom config directory
export SORTORA_CONFIG_DIR=~/.sortora

# Custom data directory
export SORTORA_DATA_DIR=~/sortora-data

# Disable AI features
export SORTORA_NO_AI=true
```

## Per-Directory Config

You can create a `.sortora.yaml` in any directory to override settings for that folder:

```yaml
# ~/Downloads/.sortora.yaml
settings:
  mode: auto

destinations:
  documents: ./Sorted/Docs
  code: ./Sorted/Code
```

## Configuration Examples

### Minimal Config

```yaml
version: 1
settings:
  mode: auto
```

### Developer Config

```yaml
version: 1

settings:
  mode: suggest
  ignorePatterns:
    - "node_modules/**"
    - ".git/**"
    - "*.log"
    - "dist/**"
    - "build/**"

destinations:
  code: ~/Projects
  documents: ~/Documents/Dev
```

### Photographer Config

```yaml
version: 1

settings:
  mode: suggest

destinations:
  photos: ~/Pictures/PhotoLibrary
  screenshots: ~/Pictures/Screenshots

  # Custom destinations
  raw: ~/Pictures/RAW
  edited: ~/Pictures/Edited
```

## Resetting Configuration

To reset to defaults:

```bash
# Remove config file
rm ~/.config/sortora/config.yaml

# Regenerate on next run
sortora setup --minimal
```

## Next Steps

- [Rules System](rules.md) - Create custom rules
- [AI Features](ai-features.md) - Enable smart classification
