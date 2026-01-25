/**
 * Ollama Provider
 * Uses local Ollama server for file classification
 */

import type {
  AIProvider,
  ClassificationRequest,
  ClassificationResult,
  ProviderConfig,
} from './types.js';
import { buildClassificationPrompt, parseClassificationResponse } from './types.js';

export interface OllamaConfig extends ProviderConfig {
  type: 'ollama';
  baseUrl?: string;
  model?: string;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  response?: string;
  message?: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider implements AIProvider {
  readonly name = 'Ollama (Local)';
  readonly type = 'ollama' as const;

  private baseUrl: string;
  private model: string;
  private initialized = false;

  constructor(config: OllamaConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'llama3.2';
  }

  isReady(): boolean {
    return this.initialized;
  }

  async init(): Promise<void> {
    // Check if Ollama server is running
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);

      if (!response.ok) {
        throw new Error('Ollama server is not responding');
      }

      const data = await response.json() as { models?: Array<{ name: string }> };
      const models = data.models || [];

      // Check if the specified model is available
      const modelExists = models.some((m: { name: string }) =>
        m.name === this.model || m.name.startsWith(`${this.model}:`)
      );

      if (!modelExists && models.length > 0) {
        console.warn(`Model "${this.model}" not found. Available models: ${models.map((m: { name: string }) => m.name).join(', ')}`);
      }

      this.initialized = true;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
          throw new Error('Ollama server is not running. Start it with: ollama serve');
        }
      }
      throw error;
    }
  }

  async classifyFile(request: ClassificationRequest): Promise<ClassificationResult> {
    if (!this.isReady()) {
      throw new Error('Ollama provider is not initialized');
    }

    const prompt = buildClassificationPrompt(request);

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a file classification assistant. Respond only with valid JSON, no markdown formatting.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 100,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${error}`);
    }

    const data = await response.json() as OllamaResponse;
    const content = data.message?.content || data.response || '';

    return parseClassificationResponse(content);
  }

  async classifyBatch(requests: ClassificationRequest[]): Promise<ClassificationResult[]> {
    // Process sequentially for Ollama (single model loaded at a time)
    const results: ClassificationResult[] = [];

    for (const request of requests) {
      const result = await this.classifyFile(request);
      results.push(result);
    }

    return results;
  }

  async dispose(): Promise<void> {
    this.initialized = false;
  }
}
