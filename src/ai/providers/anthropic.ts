/**
 * Anthropic (Claude) Provider
 * Uses Anthropic API for file classification
 */

import type {
  AIProvider,
  ClassificationRequest,
  ClassificationResult,
  ProviderConfig,
} from './types.js';
import { buildClassificationPrompt, parseClassificationResponse } from './types.js';

export interface AnthropicConfig extends ProviderConfig {
  type: 'anthropic';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicProvider implements AIProvider {
  readonly name = 'Claude (Anthropic)';
  readonly type = 'anthropic' as const;

  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private initialized = false;

  constructor(config: AnthropicConfig) {
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.model = config.model || 'claude-3-haiku-20240307';
  }

  isReady(): boolean {
    return this.initialized && !!this.apiKey;
  }

  async init(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    // Validate by checking if key format is correct
    if (!this.apiKey.startsWith('sk-ant-')) {
      throw new Error('Invalid Anthropic API key format');
    }

    this.initialized = true;
  }

  async classifyFile(request: ClassificationRequest): Promise<ClassificationResult> {
    if (!this.isReady()) {
      throw new Error('Anthropic provider is not initialized');
    }

    const prompt = buildClassificationPrompt(request);

    const messages: AnthropicMessage[] = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 100,
        system: 'You are a file classification assistant. Respond only with valid JSON, no markdown formatting.',
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json() as AnthropicResponse;
    const content = data.content[0]?.text || '';

    return parseClassificationResponse(content);
  }

  async classifyBatch(requests: ClassificationRequest[]): Promise<ClassificationResult[]> {
    // Process in parallel with rate limiting
    const results: ClassificationResult[] = [];
    const batchSize = 5;

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(req => this.classifyFile(req))
      );
      results.push(...batchResults);

      // Small delay between batches to avoid rate limits
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  async dispose(): Promise<void> {
    this.initialized = false;
  }
}
