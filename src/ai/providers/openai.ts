/**
 * OpenAI Provider
 * Uses OpenAI API for file classification
 */

import type {
  AIProvider,
  ClassificationRequest,
  ClassificationResult,
  ProviderConfig,
} from './types.js';
import { buildClassificationPrompt, parseClassificationResponse } from './types.js';

export interface OpenAIConfig extends ProviderConfig {
  type: 'openai';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider implements AIProvider {
  readonly name = 'OpenAI';
  readonly type = 'openai' as const;

  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private initialized = false;

  constructor(config: OpenAIConfig) {
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-4o-mini';
  }

  isReady(): boolean {
    return this.initialized && !!this.apiKey;
  }

  async init(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    // Validate API key by making a simple request
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API validation failed: ${error}`);
      }

      this.initialized = true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch')) {
        // Network error - assume key is valid, will fail on actual request
        this.initialized = true;
      } else {
        throw error;
      }
    }
  }

  async classifyFile(request: ClassificationRequest): Promise<ClassificationResult> {
    if (!this.isReady()) {
      throw new Error('OpenAI provider is not initialized');
    }

    const prompt = buildClassificationPrompt(request);

    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: 'You are a file classification assistant. Respond only with valid JSON.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.1,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json() as OpenAIResponse;
    const content = data.choices[0]?.message?.content || '';

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
