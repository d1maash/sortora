import chalk from 'chalk';
import { VERSION } from '../config.js';

const LOGO = `
   ███████╗ ██████╗ ██████╗ ████████╗ ██████╗ ██████╗  █████╗
   ██╔════╝██╔═══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗██╔══██╗
   ███████╗██║   ██║██████╔╝   ██║   ██║   ██║██████╔╝███████║
   ╚════██║██║   ██║██╔══██╗   ██║   ██║   ██║██╔══██╗██╔══██║
   ███████║╚██████╔╝██║  ██║   ██║   ╚██████╔╝██║  ██║██║  ██║
   ╚══════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
`;

const TAGLINE = 'Smart Offline File Organizer';

// Gradient colors for the logo
const gradientColors = [
  '#FF6B6B', // Red
  '#FF8E53', // Orange
  '#FFC107', // Yellow
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#9C27B0', // Purple
  '#E91E63', // Pink
];

// Cyan gradient for modern look
const cyanGradient = [
  '#00FFFF', // Cyan
  '#00E5FF',
  '#00D4FF',
  '#00B8FF',
  '#0091FF',
  '#006EFF',
  '#0050FF',
];

function interpolateColor(color1: string, color2: string, factor: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function getGradientColor(index: number, total: number, colors: string[]): string {
  const segmentSize = total / (colors.length - 1);
  const segment = Math.min(Math.floor(index / segmentSize), colors.length - 2);
  const segmentProgress = (index - segment * segmentSize) / segmentSize;

  return interpolateColor(colors[segment], colors[segment + 1], segmentProgress);
}

function applyGradient(text: string, colors: string[]): string {
  const lines = text.split('\n');
  const maxLength = Math.max(...lines.map(l => l.length));

  return lines.map((line, lineIndex) => {
    return line.split('').map((char, charIndex) => {
      if (char === ' ' || char === '\n') return char;
      const totalChars = maxLength;
      const color = getGradientColor(charIndex + lineIndex * 2, totalChars + lines.length * 2, colors);
      return chalk.hex(color)(char);
    }).join('');
  }).join('\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function showBanner(animated = true): Promise<void> {
  const lines = LOGO.split('\n').filter(line => line.trim());

  if (animated) {
    // Clear some space
    console.log('\n');

    // Animated reveal - line by line
    for (let i = 0; i < lines.length; i++) {
      const coloredLine = lines[i].split('').map((char, charIndex) => {
        if (char === ' ') return char;
        const color = getGradientColor(charIndex, lines[i].length, cyanGradient);
        return chalk.hex(color)(char);
      }).join('');

      console.log(coloredLine);
      await sleep(50);
    }

    // Animated tagline
    console.log();
    const taglineWithPadding = `   ${TAGLINE}`;
    let displayedTagline = '';

    for (let i = 0; i < taglineWithPadding.length; i++) {
      displayedTagline += taglineWithPadding[i];
      process.stdout.write(`\r${chalk.dim(displayedTagline)}`);
      await sleep(20);
    }
    console.log('\n');

    // Decorative line with version
    const decorLine = '   ' + '─'.repeat(55);
    console.log(chalk.dim(decorLine));
    console.log(chalk.dim(`   v${VERSION}`));
    console.log();

  } else {
    // Static display
    console.log(applyGradient(LOGO, cyanGradient));
    console.log(chalk.dim(`   ${TAGLINE}`));
    console.log(chalk.dim('   ' + '─'.repeat(55)));
    console.log(chalk.dim(`   v${VERSION}`));
    console.log();
  }
}

export function showBannerSync(): void {
  console.log('\n');
  const lines = LOGO.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const coloredLine = line.split('').map((char, charIndex) => {
      if (char === ' ') return char;
      const color = getGradientColor(charIndex, line.length, cyanGradient);
      return chalk.hex(color)(char);
    }).join('');
    console.log(coloredLine);
  }

  console.log();
  console.log(chalk.dim(`   ${TAGLINE}`));
  console.log(chalk.dim('   ' + '─'.repeat(55)));
  console.log(chalk.dim(`   v${VERSION}`));
  console.log();
}

// Rainbow variant
export async function showBannerRainbow(): Promise<void> {
  console.log('\n');
  const lines = LOGO.split('\n').filter(line => line.trim());

  for (let i = 0; i < lines.length; i++) {
    const coloredLine = lines[i].split('').map((char, charIndex) => {
      if (char === ' ') return char;
      const offset = (i * 3 + charIndex) % (gradientColors.length * 10);
      const color = getGradientColor(offset, gradientColors.length * 10, gradientColors);
      return chalk.hex(color)(char);
    }).join('');

    console.log(coloredLine);
    await sleep(40);
  }

  console.log();
  console.log(chalk.dim(`   ${TAGLINE}`));
  console.log(chalk.dim('   ' + '─'.repeat(55)));
  console.log(chalk.dim(`   v${VERSION}`));
  console.log();
}
