import ora, { Ora } from 'ora';
import chalk from 'chalk';

export interface SpinnerOptions {
  text: string;
  color?: 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray';
  spinner?: 'dots' | 'line' | 'arrow' | 'bouncingBar';
}

export class ProgressSpinner {
  private spinner: Ora;

  constructor(options: string | SpinnerOptions) {
    const opts = typeof options === 'string' ? { text: options } : options;

    this.spinner = ora({
      text: opts.text,
      color: opts.color || 'cyan',
      spinner: opts.spinner || 'dots',
    });
  }

  start(): this {
    this.spinner.start();
    return this;
  }

  stop(): this {
    this.spinner.stop();
    return this;
  }

  succeed(text?: string): this {
    this.spinner.succeed(text);
    return this;
  }

  fail(text?: string): this {
    this.spinner.fail(text);
    return this;
  }

  warn(text?: string): this {
    this.spinner.warn(text);
    return this;
  }

  info(text?: string): this {
    this.spinner.info(text);
    return this;
  }

  text(text: string): this {
    this.spinner.text = text;
    return this;
  }

  prefixText(text: string): this {
    this.spinner.prefixText = text;
    return this;
  }
}

export function createSpinner(text: string): ProgressSpinner {
  return new ProgressSpinner(text);
}

export class ProgressBar {
  private current = 0;
  private total: number;
  private width: number;
  private label: string;
  private lastRender = '';

  constructor(total: number, options: { width?: number; label?: string } = {}) {
    this.total = total;
    this.width = options.width || 30;
    this.label = options.label || '';
  }

  increment(amount = 1): void {
    this.current = Math.min(this.current + amount, this.total);
    this.render();
  }

  update(current: number): void {
    this.current = Math.min(current, this.total);
    this.render();
  }

  setTotal(total: number): void {
    this.total = total;
    this.render();
  }

  private render(): void {
    const percentage = this.total > 0 ? this.current / this.total : 0;
    const filled = Math.round(this.width * percentage);
    const empty = this.width - filled;

    const bar = chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    const percent = (percentage * 100).toFixed(0).padStart(3);
    const counts = `${this.current}/${this.total}`;

    const output = this.label
      ? `  ${this.label}: ${bar} ${percent}% (${counts})`
      : `  ${bar} ${percent}% (${counts})`;

    // Clear previous line and write new
    if (this.lastRender) {
      process.stdout.write('\r' + ' '.repeat(this.lastRender.length) + '\r');
    }
    process.stdout.write(output);
    this.lastRender = output;
  }

  finish(): void {
    this.current = this.total;
    this.render();
    console.log(); // New line
  }

  clear(): void {
    if (this.lastRender) {
      process.stdout.write('\r' + ' '.repeat(this.lastRender.length) + '\r');
      this.lastRender = '';
    }
  }
}

export function createProgressBar(total: number, label?: string): ProgressBar {
  return new ProgressBar(total, { label });
}

export class MultiProgress {
  private bars: Map<string, { current: number; total: number; label: string }> = new Map();
  private lineCount = 0;

  addBar(id: string, total: number, label: string): void {
    this.bars.set(id, { current: 0, total, label });
    this.render();
  }

  update(id: string, current: number): void {
    const bar = this.bars.get(id);
    if (bar) {
      bar.current = Math.min(current, bar.total);
      this.render();
    }
  }

  increment(id: string, amount = 1): void {
    const bar = this.bars.get(id);
    if (bar) {
      bar.current = Math.min(bar.current + amount, bar.total);
      this.render();
    }
  }

  private render(): void {
    // Move cursor up and clear previous lines
    if (this.lineCount > 0) {
      process.stdout.write(`\x1b[${this.lineCount}A`);
    }

    const lines: string[] = [];
    const width = 25;

    for (const [, bar] of this.bars) {
      const percentage = bar.total > 0 ? bar.current / bar.total : 0;
      const filled = Math.round(width * percentage);
      const empty = width - filled;

      const barStr = chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
      const percent = (percentage * 100).toFixed(0).padStart(3);

      lines.push(`  ${bar.label.padEnd(15)} ${barStr} ${percent}%`);
    }

    const output = lines.join('\n') + '\n';
    process.stdout.write(output);
    this.lineCount = lines.length;
  }

  finish(): void {
    for (const [, bar] of this.bars) {
      bar.current = bar.total;
    }
    this.render();
  }

  clear(): void {
    if (this.lineCount > 0) {
      process.stdout.write(`\x1b[${this.lineCount}A`);
      for (let i = 0; i < this.lineCount; i++) {
        process.stdout.write('\x1b[2K\n');
      }
      process.stdout.write(`\x1b[${this.lineCount}A`);
    }
    this.bars.clear();
    this.lineCount = 0;
  }
}

export function createMultiProgress(): MultiProgress {
  return new MultiProgress();
}
