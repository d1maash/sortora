import { readFile } from 'fs/promises';
import { extname } from 'path';

export interface CodeMetadata {
  language?: string;
  framework?: string;
  lineCount?: number;
  hasTests?: boolean;
  isConfig?: boolean;
  isMinified?: boolean;
  dependencies?: string[];
}

export interface CodeAnalysisResult {
  metadata: CodeMetadata;
  textContent: string;
}

const languageByExtension: Record<string, string> = {
  js: 'JavaScript',
  jsx: 'JavaScript (React)',
  ts: 'TypeScript',
  tsx: 'TypeScript (React)',
  py: 'Python',
  rb: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  scala: 'Scala',
  cpp: 'C++',
  c: 'C',
  h: 'C/C++ Header',
  hpp: 'C++ Header',
  cs: 'C#',
  fs: 'F#',
  php: 'PHP',
  swift: 'Swift',
  m: 'Objective-C',
  lua: 'Lua',
  r: 'R',
  sql: 'SQL',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Zsh',
  ps1: 'PowerShell',
  bat: 'Batch',
  vue: 'Vue',
  svelte: 'Svelte',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  md: 'Markdown',
};

const configFiles: Record<string, string> = {
  'package.json': 'npm',
  'tsconfig.json': 'TypeScript',
  'vite.config.ts': 'Vite',
  'vite.config.js': 'Vite',
  'webpack.config.js': 'Webpack',
  'rollup.config.js': 'Rollup',
  'jest.config.js': 'Jest',
  'vitest.config.ts': 'Vitest',
  '.eslintrc.js': 'ESLint',
  '.eslintrc.json': 'ESLint',
  'prettier.config.js': 'Prettier',
  '.prettierrc': 'Prettier',
  'tailwind.config.js': 'Tailwind',
  'next.config.js': 'Next.js',
  'nuxt.config.ts': 'Nuxt',
  'cargo.toml': 'Rust',
  'go.mod': 'Go',
  'requirements.txt': 'Python',
  'pyproject.toml': 'Python',
  'gemfile': 'Ruby',
  'composer.json': 'PHP',
  'pom.xml': 'Maven',
  'build.gradle': 'Gradle',
  'makefile': 'Make',
  'dockerfile': 'Docker',
  'docker-compose.yml': 'Docker Compose',
  '.gitignore': 'Git',
  '.env': 'Environment',
  '.env.local': 'Environment',
  '.env.example': 'Environment',
};

export async function analyzeCode(
  filePath: string,
  filename: string
): Promise<CodeAnalysisResult> {
  const metadata: CodeMetadata = {};
  let textContent = '';

  try {
    textContent = await readFile(filePath, 'utf-8');

    // Detect language by extension
    const ext = extname(filename).toLowerCase().slice(1);
    metadata.language = languageByExtension[ext];

    // Check if it's a config file
    const lowerFilename = filename.toLowerCase();
    if (configFiles[lowerFilename]) {
      metadata.isConfig = true;
      metadata.framework = configFiles[lowerFilename];
    }

    // Count lines
    metadata.lineCount = textContent.split('\n').length;

    // Check if minified (long lines, no newlines)
    const avgLineLength = textContent.length / (metadata.lineCount || 1);
    metadata.isMinified = avgLineLength > 500 || (metadata.lineCount < 5 && textContent.length > 1000);

    // Detect tests
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /_test\./,
      /test_/,
      /\/tests?\//,
      /__tests__/,
    ];
    metadata.hasTests = testPatterns.some(p => p.test(filePath));

    // Detect framework from content
    if (!metadata.framework) {
      metadata.framework = detectFramework(textContent, ext);
    }

    // Extract dependencies if it's package.json
    if (lowerFilename === 'package.json') {
      try {
        const pkg = JSON.parse(textContent);
        const deps = [
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.devDependencies || {}),
        ];
        metadata.dependencies = deps.slice(0, 20);
      } catch {
        // JSON parse failed
      }
    }
  } catch {
    // File reading failed
  }

  return { metadata, textContent };
}

function detectFramework(content: string, _ext: string): string | undefined {
  const frameworks: Record<string, RegExp[]> = {
    'React': [/from ['"]react['"]/, /import React/, /React\.Component/],
    'Vue': [/from ['"]vue['"]/, /createApp/, /defineComponent/],
    'Angular': [/@angular\/core/, /@Component/, /@Injectable/],
    'Svelte': [/<script.*>/, /<style.*>/, /\$:.*=/],
    'Next.js': [/from ['"]next/, /getServerSideProps/, /getStaticProps/],
    'Express': [/from ['"]express['"]/, /require\(['"]express['"]\)/, /app\.get\(/],
    'FastAPI': [/from fastapi/, /FastAPI\(\)/, /@app\.(get|post)/],
    'Django': [/from django/, /django\./, /models\.Model/],
    'Flask': [/from flask/, /Flask\(__name__\)/],
    'Spring': [/@SpringBootApplication/, /@RestController/, /@Autowired/],
  };

  for (const [framework, patterns] of Object.entries(frameworks)) {
    if (patterns.some(p => p.test(content))) {
      return framework;
    }
  }

  return undefined;
}

export function getProjectType(
  files: { filename: string; metadata: CodeMetadata }[]
): string {
  const configCounts: Record<string, number> = {};

  for (const { filename, metadata } of files) {
    const lower = filename.toLowerCase();
    if (configFiles[lower]) {
      const framework = configFiles[lower];
      configCounts[framework] = (configCounts[framework] || 0) + 1;
    }
    if (metadata.framework) {
      configCounts[metadata.framework] = (configCounts[metadata.framework] || 0) + 1;
    }
  }

  // Find most common framework
  let maxCount = 0;
  let projectType = 'Unknown';

  for (const [framework, count] of Object.entries(configCounts)) {
    if (count > maxCount) {
      maxCount = count;
      projectType = framework;
    }
  }

  return projectType;
}
