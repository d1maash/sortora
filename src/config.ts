import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import YAML from 'yaml';
import { z } from 'zod';

export const VERSION = '1.1.1';

// AI Provider configuration schema
const AIProviderSchema = z.object({
  provider: z.enum(['local', 'openai', 'anthropic', 'gemini', 'ollama']).default('local'),
  openai: z.object({
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    model: z.string().default('gpt-4o-mini'),
  }).default({}),
  anthropic: z.object({
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    model: z.string().default('claude-3-haiku-20240307'),
  }).default({}),
  gemini: z.object({
    apiKey: z.string().optional(),
    model: z.string().default('gemini-1.5-flash'),
  }).default({}),
  ollama: z.object({
    baseUrl: z.string().default('http://localhost:11434'),
    model: z.string().default('llama3.2'),
  }).default({}),
}).default({});

const ConfigSchema = z.object({
  version: z.number().default(1),
  settings: z.object({
    mode: z.enum(['suggest', 'auto']).default('suggest'),
    confirmDestructive: z.boolean().default(true),
    ignoreHidden: z.boolean().default(true),
    ignorePatterns: z.array(z.string()).default([
      '*.tmp',
      '*.crdownload',
      '.DS_Store',
      'Thumbs.db',
      'desktop.ini',
    ]),
  }).default({}),
  ai: AIProviderSchema,
  destinations: z.record(z.string()).default({
    photos: '~/Pictures/Sorted',
    screenshots: '~/Pictures/Screenshots',
    documents: '~/Documents/Sorted',
    work: '~/Documents/Work',
    finance: '~/Documents/Finance',
    code: '~/Projects',
    music: '~/Music/Sorted',
    video: '~/Videos/Sorted',
    archives: '~/Archives',
    trash: '~/.Trash',
  }),
  rules: z.array(z.object({
    name: z.string(),
    priority: z.number().default(50),
    match: z.object({
      extension: z.array(z.string()).optional(),
      filename: z.array(z.string()).optional(),
      type: z.string().optional(),
      hasExif: z.boolean().optional(),
      contentContains: z.array(z.string()).optional(),
      location: z.string().optional(),
      age: z.string().optional(),
      accessed: z.string().optional(),
    }),
    useAi: z.boolean().optional(),
    action: z.object({
      moveTo: z.string().optional(),
      suggestTo: z.string().optional(),
      archiveTo: z.string().optional(),
      delete: z.boolean().optional(),
      confirm: z.boolean().optional(),
    }),
  })).default([]),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface AppPaths {
  configDir: string;
  configFile: string;
  dataDir: string;
  databaseFile: string;
  modelsDir: string;
  cacheDir: string;
  rulesFile: string;
}

export function getAppPaths(): AppPaths {
  const configDir = join(homedir(), '.config', 'sortora');
  const dataDir = join(homedir(), '.local', 'share', 'sortora');

  return {
    configDir,
    configFile: join(configDir, 'config.yaml'),
    rulesFile: join(configDir, 'rules.yaml'),
    dataDir,
    databaseFile: join(dataDir, 'sortora.db'),
    modelsDir: join(dataDir, 'models'),
    cacheDir: join(dataDir, 'cache'),
  };
}

export function ensureDirectories(): void {
  const paths = getAppPaths();

  const dirs = [
    paths.configDir,
    paths.dataDir,
    paths.modelsDir,
    paths.cacheDir,
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export function loadConfig(): Config {
  const paths = getAppPaths();

  if (!existsSync(paths.configFile)) {
    return ConfigSchema.parse({});
  }

  try {
    const content = readFileSync(paths.configFile, 'utf-8');
    const parsed = YAML.parse(content);
    return ConfigSchema.parse(parsed);
  } catch {
    return ConfigSchema.parse({});
  }
}

export function saveConfig(config: Config): void {
  const paths = getAppPaths();
  ensureDirectories();

  const content = YAML.stringify(config);
  writeFileSync(paths.configFile, content, 'utf-8');
}

export function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  if (path.startsWith('$HOME/')) {
    return join(homedir(), path.slice(6));
  }
  return path;
}

export function getDestination(config: Config, key: string): string {
  const dest = config.destinations[key];
  if (!dest) {
    throw new Error(`Unknown destination: ${key}`);
  }
  return expandPath(dest);
}

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});

export type AIProviderType = 'local' | 'openai' | 'anthropic' | 'gemini' | 'ollama';

/**
 * Get the AI provider configuration, with environment variable overrides
 */
export function getAIProviderConfig(config: Config): Config['ai'] {
  const aiConfig = { ...config.ai };

  // Environment variable overrides
  const envProvider = process.env.SORTORA_AI_PROVIDER as AIProviderType | undefined;
  if (envProvider) {
    aiConfig.provider = envProvider;
  }

  // OpenAI
  if (process.env.OPENAI_API_KEY) {
    aiConfig.openai = {
      ...aiConfig.openai,
      apiKey: process.env.OPENAI_API_KEY,
    };
  }
  if (process.env.OPENAI_BASE_URL) {
    aiConfig.openai = {
      ...aiConfig.openai,
      baseUrl: process.env.OPENAI_BASE_URL,
    };
  }
  if (process.env.OPENAI_MODEL) {
    aiConfig.openai = {
      ...aiConfig.openai,
      model: process.env.OPENAI_MODEL,
    };
  }

  // Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    aiConfig.anthropic = {
      ...aiConfig.anthropic,
      apiKey: process.env.ANTHROPIC_API_KEY,
    };
  }
  if (process.env.ANTHROPIC_MODEL) {
    aiConfig.anthropic = {
      ...aiConfig.anthropic,
      model: process.env.ANTHROPIC_MODEL,
    };
  }

  // Gemini
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    aiConfig.gemini = {
      ...aiConfig.gemini,
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    };
  }
  if (process.env.GEMINI_MODEL) {
    aiConfig.gemini = {
      ...aiConfig.gemini,
      model: process.env.GEMINI_MODEL,
    };
  }

  // Ollama
  if (process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL) {
    aiConfig.ollama = {
      ...aiConfig.ollama,
      baseUrl: process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || aiConfig.ollama.baseUrl,
    };
  }
  if (process.env.OLLAMA_MODEL) {
    aiConfig.ollama = {
      ...aiConfig.ollama,
      model: process.env.OLLAMA_MODEL,
    };
  }

  return aiConfig;
}
