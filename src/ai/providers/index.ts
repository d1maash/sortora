/**
 * AI Provider Factory and Manager
 * Creates and manages AI providers based on configuration
 */

export type { AIProvider, ProviderConfig, ProviderType, ClassificationRequest, ClassificationResult } from './types.js';
export { buildClassificationPrompt, parseClassificationResponse } from './types.js';

export { OpenAIProvider, type OpenAIConfig } from './openai.js';
export { AnthropicProvider, type AnthropicConfig } from './anthropic.js';
export { GeminiProvider, type GeminiConfig } from './gemini.js';
export { OllamaProvider, type OllamaConfig } from './ollama.js';
export { LocalProvider, type LocalConfig } from './local.js';

import type { AIProvider, ProviderType } from './types.js';
import { OpenAIProvider, type OpenAIConfig } from './openai.js';
import { AnthropicProvider, type AnthropicConfig } from './anthropic.js';
import { GeminiProvider, type GeminiConfig } from './gemini.js';
import { OllamaProvider, type OllamaConfig } from './ollama.js';
import { LocalProvider, type LocalConfig } from './local.js';

export interface ProviderManagerConfig {
  provider: ProviderType;
  openai?: Omit<OpenAIConfig, 'type'>;
  anthropic?: Omit<AnthropicConfig, 'type'>;
  gemini?: Omit<GeminiConfig, 'type'>;
  ollama?: Omit<OllamaConfig, 'type'>;
  local?: Omit<LocalConfig, 'type'>;
}

/**
 * Create an AI provider based on configuration
 */
export function createProvider(config: ProviderManagerConfig): AIProvider {
  switch (config.provider) {
    case 'openai':
      if (!config.openai?.apiKey) {
        throw new Error('OpenAI API key is required. Set OPENAI_API_KEY or configure in settings.');
      }
      return new OpenAIProvider({
        type: 'openai',
        apiKey: config.openai.apiKey,
        baseUrl: config.openai.baseUrl,
        model: config.openai.model,
      });

    case 'anthropic':
      if (!config.anthropic?.apiKey) {
        throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY or configure in settings.');
      }
      return new AnthropicProvider({
        type: 'anthropic',
        apiKey: config.anthropic.apiKey,
        baseUrl: config.anthropic.baseUrl,
        model: config.anthropic.model,
      });

    case 'gemini':
      if (!config.gemini?.apiKey) {
        throw new Error('Gemini API key is required. Set GEMINI_API_KEY or configure in settings.');
      }
      return new GeminiProvider({
        type: 'gemini',
        apiKey: config.gemini.apiKey,
        model: config.gemini.model,
      });

    case 'ollama':
      return new OllamaProvider({
        type: 'ollama',
        baseUrl: config.ollama?.baseUrl,
        model: config.ollama?.model,
      });

    case 'local':
      if (!config.local?.modelsDir) {
        throw new Error('Models directory is required for local provider.');
      }
      return new LocalProvider({
        type: 'local',
        modelsDir: config.local.modelsDir,
      });

    default:
      throw new Error(`Unknown provider type: ${config.provider}`);
  }
}

/**
 * Get provider configuration from environment variables
 */
export function getProviderConfigFromEnv(modelsDir: string): ProviderManagerConfig {
  const provider = (process.env.SORTORA_AI_PROVIDER as ProviderType) || 'local';

  return {
    provider,
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: process.env.OPENAI_BASE_URL,
      model: process.env.OPENAI_MODEL,
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      baseUrl: process.env.ANTHROPIC_BASE_URL,
      model: process.env.ANTHROPIC_MODEL,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
      model: process.env.GEMINI_MODEL,
    },
    ollama: {
      baseUrl: process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL,
      model: process.env.OLLAMA_MODEL,
    },
    local: {
      modelsDir,
    },
  };
}

/**
 * List all available provider types with descriptions
 */
export function listProviders(): Array<{ type: ProviderType; name: string; description: string }> {
  return [
    {
      type: 'local',
      name: 'Local (MobileBERT)',
      description: 'Offline classification using local MobileBERT model (~25 MB)',
    },
    {
      type: 'openai',
      name: 'OpenAI',
      description: 'Use OpenAI GPT models (requires API key)',
    },
    {
      type: 'anthropic',
      name: 'Claude (Anthropic)',
      description: 'Use Anthropic Claude models (requires API key)',
    },
    {
      type: 'gemini',
      name: 'Gemini (Google)',
      description: 'Use Google Gemini models (requires API key)',
    },
    {
      type: 'ollama',
      name: 'Ollama (Local LLM)',
      description: 'Use local LLM via Ollama server',
    },
  ];
}

/**
 * Provider Manager class for managing provider lifecycle
 */
export class ProviderManager {
  private provider: AIProvider | null = null;
  private config: ProviderManagerConfig;

  constructor(config: ProviderManagerConfig) {
    this.config = config;
  }

  getProviderType(): ProviderType {
    return this.config.provider;
  }

  async init(): Promise<AIProvider> {
    if (this.provider && this.provider.isReady()) {
      return this.provider;
    }

    this.provider = createProvider(this.config);
    await this.provider.init();
    return this.provider;
  }

  getProvider(): AIProvider | null {
    return this.provider;
  }

  isReady(): boolean {
    return this.provider !== null && this.provider.isReady();
  }

  async dispose(): Promise<void> {
    if (this.provider?.dispose) {
      await this.provider.dispose();
    }
    this.provider = null;
  }
}
