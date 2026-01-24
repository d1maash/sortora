/**
 * AI Provider Types
 * Defines interfaces for external AI providers (OpenAI, Claude, Gemini, etc.)
 */

import { FILE_CATEGORIES } from '../classifier.js';

export type ProviderType = 'local' | 'openai' | 'anthropic' | 'gemini' | 'ollama';

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface ClassificationRequest {
  filename: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface ClassificationResult {
  category: string;
  confidence: number;
  rawResponse?: string;
}

export interface AIProvider {
  readonly name: string;
  readonly type: ProviderType;

  /**
   * Check if the provider is properly configured and ready to use
   */
  isReady(): boolean;

  /**
   * Initialize the provider (load models, validate API keys, etc.)
   */
  init(): Promise<void>;

  /**
   * Classify a file based on its name, content, and metadata
   */
  classifyFile(request: ClassificationRequest): Promise<ClassificationResult>;

  /**
   * Classify multiple files in batch (for providers that support it)
   */
  classifyBatch?(requests: ClassificationRequest[]): Promise<ClassificationResult[]>;

  /**
   * Clean up resources
   */
  dispose?(): Promise<void>;
}

/**
 * Build the classification prompt for external AI providers
 */
export function buildClassificationPrompt(request: ClassificationRequest): string {
  const categories = FILE_CATEGORIES.join(', ');

  let prompt = `You are a file classification assistant. Classify the following file into one of these categories: ${categories}.

File information:
- Filename: ${request.filename}`;

  if (request.content) {
    const contentPreview = request.content.slice(0, 500);
    prompt += `\n- Content preview: ${contentPreview}`;
  }

  if (request.metadata) {
    const metaStr = Object.entries(request.metadata)
      .filter(([_, v]) => v !== undefined && v !== null)
      .slice(0, 5)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    if (metaStr) {
      prompt += `\n- Metadata: ${metaStr}`;
    }
  }

  prompt += `

Respond with ONLY a JSON object in this exact format (no markdown, no explanation):
{"category": "<category>", "confidence": <0.0-1.0>}

The category must be one of: ${categories}`;

  return prompt;
}

/**
 * Parse the AI response to extract classification result
 */
export function parseClassificationResponse(response: string): ClassificationResult {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[^}]+\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const category = parsed.category?.toLowerCase() || 'unknown or other';
      const confidence = typeof parsed.confidence === 'number'
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.7;

      // Validate category is in our list
      const validCategory = FILE_CATEGORIES.find(
        c => c.toLowerCase() === category.toLowerCase()
      ) || 'unknown or other';

      return {
        category: validCategory,
        confidence,
        rawResponse: response,
      };
    } catch {
      // JSON parsing failed
    }
  }

  // Fallback: try to find a category in the response
  for (const cat of FILE_CATEGORIES) {
    if (response.toLowerCase().includes(cat.toLowerCase())) {
      return {
        category: cat,
        confidence: 0.6,
        rawResponse: response,
      };
    }
  }

  return {
    category: 'unknown or other',
    confidence: 0.3,
    rawResponse: response,
  };
}
