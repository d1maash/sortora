/**
 * Google Gemini Provider
 * Uses Google Generative AI API for file classification
 */

import type {
  AIProvider,
  ClassificationRequest,
  ClassificationResult,
  ProviderConfig,
} from './types.js';
import { buildClassificationPrompt, parseClassificationResponse } from './types.js';

export interface GeminiConfig extends ProviderConfig {
  type: 'gemini';
  apiKey?: string;
  model?: string;
}

interface GeminiContent {
  parts: Array<{ text: string }>;
  role: 'user' | 'model';
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export class GeminiProvider implements AIProvider {
  readonly name = 'Gemini (Google)';
  readonly type = 'gemini' as const;

  private apiKey: string;
  private model: string;
  private initialized = false;

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gemini-1.5-flash';
  }

  isReady(): boolean {
    return this.initialized && !!this.apiKey;
  }

  async init(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is required');
    }

    // Validate API key by making a simple request
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API validation failed: ${error}`);
      }

      this.initialized = true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch')) {
        // Network error - assume key is valid
        this.initialized = true;
      } else {
        throw error;
      }
    }
  }

  async classifyFile(request: ClassificationRequest): Promise<ClassificationResult> {
    if (!this.isReady()) {
      throw new Error('Gemini provider is not initialized');
    }

    const prompt = buildClassificationPrompt(request);

    const contents: GeminiContent[] = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 100,
        },
        systemInstruction: {
          parts: [{ text: 'You are a file classification assistant. Respond only with valid JSON, no markdown formatting.' }],
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json() as GeminiResponse;
    const content = data.candidates[0]?.content?.parts[0]?.text || '';

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
