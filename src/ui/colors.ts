import chalk from 'chalk';

export const colors = {
  // Primary colors
  primary: chalk.cyan,
  secondary: chalk.blue,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  info: chalk.magenta,

  // Text colors
  muted: chalk.dim,
  highlight: chalk.bold,
  underline: chalk.underline,

  // File type colors
  image: chalk.magenta,
  document: chalk.blue,
  audio: chalk.green,
  video: chalk.yellow,
  code: chalk.cyan,
  archive: chalk.gray,
  executable: chalk.red,
  other: chalk.white,

  // Status colors
  added: chalk.green,
  modified: chalk.yellow,
  deleted: chalk.red,
  moved: chalk.cyan,
  skipped: chalk.gray,

  // Size colors
  sizeSmall: chalk.green,
  sizeMedium: chalk.yellow,
  sizeLarge: chalk.red,
};

export function colorByCategory(category: string): chalk.ChalkFunction {
  const categoryColors: Record<string, chalk.ChalkFunction> = {
    image: colors.image,
    document: colors.document,
    audio: colors.audio,
    video: colors.video,
    code: colors.code,
    archive: colors.archive,
    executable: colors.executable,
    data: colors.info,
    other: colors.other,
  };

  return categoryColors[category] || colors.other;
}

export function colorBySize(bytes: number): chalk.ChalkFunction {
  const MB = 1024 * 1024;

  if (bytes < 10 * MB) {
    return colors.sizeSmall;
  }
  if (bytes < 100 * MB) {
    return colors.sizeMedium;
  }
  return colors.sizeLarge;
}

export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  const formatted = unitIndex === 0 ? size.toString() : size.toFixed(1);
  const colorFn = colorBySize(bytes);

  return colorFn(`${formatted} ${units[unitIndex]}`);
}

export function formatNumber(num: number): string {
  return num.toLocaleString();
}

export function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date * 1000) : date;
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatRelativeTime(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date * 1000) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes === 0) {
        return 'just now';
      }
      return `${diffMinutes}m ago`;
    }
    return `${diffHours}h ago`;
  }

  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;

  return `${Math.floor(diffDays / 365)}y ago`;
}

export function box(content: string, title?: string): string {
  const lines = content.split('\n');
  const maxLength = Math.max(...lines.map(l => l.length), title?.length || 0);

  const top = title
    ? `┌─ ${title} ${'─'.repeat(maxLength - title.length)}┐`
    : `┌${'─'.repeat(maxLength + 2)}┐`;
  const bottom = `└${'─'.repeat(maxLength + 2)}┘`;

  const body = lines.map(line => `│ ${line.padEnd(maxLength)} │`).join('\n');

  return `${top}\n${body}\n${bottom}`;
}

export function indent(text: string, spaces = 2): string {
  const prefix = ' '.repeat(spaces);
  return text.split('\n').map(line => prefix + line).join('\n');
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function progressBar(current: number, total: number, width = 30): string {
  const percentage = Math.min(current / total, 1);
  const filled = Math.round(width * percentage);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percent = (percentage * 100).toFixed(0).padStart(3);

  return `${colors.primary(bar)} ${percent}%`;
}
