import Tesseract, { type Worker } from 'tesseract.js';
import { join } from 'path';

export interface OCRResult {
  text: string;
  confidence: number;
  words?: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[];
}

export class OCRService {
  private worker: Worker | null = null;
  private modelsDir: string;
  private languages: string[] = ['eng'];
  private initialized = false;

  constructor(modelsDir: string) {
    this.modelsDir = modelsDir;
  }

  async init(languages: string[] = ['eng']): Promise<void> {
    if (this.worker) return;

    this.languages = languages;
    const langString = languages.join('+');

    this.worker = await Tesseract.createWorker(langString, 1, {
      cachePath: join(this.modelsDir, 'tesseract'),
      logger: () => {}, // Silent mode
    });

    this.initialized = true;
  }

  isReady(): boolean {
    return this.initialized && this.worker !== null;
  }

  getLanguages(): string[] {
    return this.languages;
  }

  async recognize(imagePath: string): Promise<OCRResult> {
    if (!this.worker) {
      await this.init();
    }

    const { data } = await this.worker!.recognize(imagePath);

    return {
      text: data.text.trim(),
      confidence: data.confidence / 100,
      words: data.words?.map(word => ({
        text: word.text,
        confidence: word.confidence / 100,
        bbox: word.bbox,
      })),
    };
  }

  async recognizeRegion(
    imagePath: string,
    region: { left: number; top: number; width: number; height: number }
  ): Promise<OCRResult> {
    if (!this.worker) {
      await this.init();
    }

    const { data } = await this.worker!.recognize(imagePath, {
      rectangle: region,
    });

    return {
      text: data.text.trim(),
      confidence: data.confidence / 100,
    };
  }

  async recognizeBatch(imagePaths: string[]): Promise<OCRResult[]> {
    const results: OCRResult[] = [];

    for (const path of imagePaths) {
      try {
        const result = await this.recognize(path);
        results.push(result);
      } catch {
        results.push({ text: '', confidence: 0 });
      }
    }

    return results;
  }

  async setLanguages(languages: string[]): Promise<void> {
    await this.terminate();
    await this.init(languages);
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initialized = false;
    }
  }

  extractKeywords(ocrResult: OCRResult): string[] {
    const text = ocrResult.text.toLowerCase();

    // Split into words and filter
    const words = text
      .split(/\s+/)
      .map(w => w.replace(/[^\w]/g, ''))
      .filter(w => w.length > 3);

    // Deduplicate
    return [...new Set(words)];
  }

  detectDocumentType(ocrResult: OCRResult): string | null {
    const text = ocrResult.text.toLowerCase();

    const patterns: [RegExp, string][] = [
      [/invoice|счёт|счет/i, 'invoice'],
      [/receipt|чек|квитанция/i, 'receipt'],
      [/contract|договор|agreement/i, 'contract'],
      [/resume|cv|резюме/i, 'resume'],
      [/passport|паспорт/i, 'passport'],
      [/license|лицензия|права/i, 'license'],
      [/certificate|сертификат/i, 'certificate'],
      [/statement|выписка/i, 'statement'],
    ];

    for (const [pattern, type] of patterns) {
      if (pattern.test(text)) {
        return type;
      }
    }

    return null;
  }

  static getSupportedLanguages(): { code: string; name: string }[] {
    return [
      { code: 'eng', name: 'English' },
      { code: 'rus', name: 'Russian' },
      { code: 'deu', name: 'German' },
      { code: 'fra', name: 'French' },
      { code: 'spa', name: 'Spanish' },
      { code: 'ita', name: 'Italian' },
      { code: 'por', name: 'Portuguese' },
      { code: 'pol', name: 'Polish' },
      { code: 'nld', name: 'Dutch' },
      { code: 'chi_sim', name: 'Chinese (Simplified)' },
      { code: 'chi_tra', name: 'Chinese (Traditional)' },
      { code: 'jpn', name: 'Japanese' },
      { code: 'kor', name: 'Korean' },
      { code: 'ara', name: 'Arabic' },
    ];
  }
}

export default OCRService;
