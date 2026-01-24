/**
 * Smart Renamer - AI-powered file renaming service
 *
 * Converts unreadable filenames like "IMG_20240315_123456.jpg" into meaningful names
 * like "Отпуск Турция - Март 2024.jpg" using EXIF data, OCR, and AI analysis.
 */

import { basename, extname, dirname, join } from 'path';
import { format } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { analyzeImage, type ImageMetadata } from '../analyzers/image.js';
import { ClassifierService } from './classifier.js';
import { OCRService } from './ocr.js';
import { EmbeddingService } from './embeddings.js';
import { analyzeFilename } from '../utils/filename-analyzer.js';
import { getMimeType, getFileCategory } from '../utils/mime.js';
import { reverseGeocode, type LocationInfo } from '../utils/geocoding.js';

export interface RenameContext {
  // File info
  filePath: string;
  filename: string;
  extension: string;
  mimeType: string | null;
  category: string;

  // Image metadata (from EXIF)
  imageMetadata?: ImageMetadata;

  // Location info (from GPS)
  location?: LocationInfo;

  // OCR text (from image/document)
  ocrText?: string;

  // AI classification
  aiCategory?: string;
  aiConfidence?: number;

  // User hints
  eventName?: string;
  trip?: string;
  people?: string[];
}

export interface RenameSuggestion {
  original: string;
  suggested: string;
  confidence: number;
  reason: string;
  components: {
    event?: string;
    location?: string;
    date?: string;
    sequence?: number;
    description?: string;
  };
}

// Patterns for unreadable filenames that need renaming
const UNREADABLE_PATTERNS = [
  // Camera patterns
  /^IMG_\d{8}_\d+/i,           // IMG_20240315_123456
  /^DSC_?\d+/i,                // DSC_1234 or DSC1234
  /^DSCN?\d+/i,                // DSCN1234
  /^P\d{7,}/i,                 // P1234567
  /^DCIM\d+/i,                 // DCIM1234
  /^Photo_\d+/i,               // Photo_001

  // Phone patterns
  /^IMG-\d{8}-WA\d+/i,         // WhatsApp: IMG-20240315-WA0001
  /^VID-\d{8}-WA\d+/i,         // WhatsApp video
  /^PXL_\d{8}_\d+/i,           // Google Pixel
  /^Screenshot_\d{8}/i,        // Screenshot_20240315
  /^\d{8}_\d{6}/,              // 20240315_123456

  // Download patterns
  /^image\s*\(\d+\)/i,         // image (1)
  /^photo\s*\(\d+\)/i,         // photo (1)
  /^download\s*\(\d+\)/i,      // download (1)
  /^Untitled/i,                // Untitled
  /^[a-f0-9]{24,}/i,           // Long hash-like names

  // Generic
  /^temp/i,
  /^new\s*file/i,
  /^copy\s*of/i,
  /^копия/i,
];

// Month names for formatting
const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// AI categories that suggest specific naming patterns
const CATEGORY_TEMPLATES: Record<string, (ctx: RenameContext) => string | null> = {
  'photo or image': buildPhotoName,
  'screenshot': buildScreenshotName,
  'meme or funny image': buildMemeName,
  'design or artwork': buildDesignName,
  'video': buildVideoName,
  'work document': buildDocumentName,
  'personal document': buildDocumentName,
  'financial document': buildFinancialDocName,
  'invoice or receipt': buildInvoiceName,
};

export class SmartRenamer {
  private modelsDir: string;
  private classifier: ClassifierService | null = null;
  private ocr: OCRService | null = null;
  private embeddings: EmbeddingService | null = null;
  private aiEnabled = false;
  private language: 'ru' | 'en' = 'ru';

  constructor(modelsDir: string, options?: { language?: 'ru' | 'en' }) {
    this.modelsDir = modelsDir;
    this.language = options?.language ?? 'ru';
  }

  async enableAI(): Promise<void> {
    if (this.aiEnabled) return;

    this.classifier = new ClassifierService(this.modelsDir);
    this.embeddings = new EmbeddingService(this.modelsDir);

    await Promise.all([
      this.classifier.init(),
      this.embeddings.init(),
    ]);

    this.aiEnabled = true;
  }

  async enableOCR(languages: string[] = ['eng', 'rus']): Promise<void> {
    if (this.ocr) return;

    this.ocr = new OCRService(this.modelsDir);
    await this.ocr.init(languages);
  }

  isAIEnabled(): boolean {
    return this.aiEnabled;
  }

  /**
   * Check if a filename looks unreadable and needs renaming
   */
  isUnreadable(filename: string): boolean {
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

    // Check against unreadable patterns
    if (UNREADABLE_PATTERNS.some(p => p.test(nameWithoutExt))) {
      return true;
    }

    // If name is just numbers or mostly numbers/underscores
    const alphaCount = (nameWithoutExt.match(/[a-zA-Zа-яА-ЯёЁ]/g) || []).length;
    const totalCount = nameWithoutExt.length;
    if (totalCount > 5 && alphaCount / totalCount < 0.3) {
      return true;
    }

    return false;
  }

  /**
   * Generate a smart rename suggestion for a file
   */
  async suggest(
    filePath: string,
    options: {
      useAI?: boolean;
      useOCR?: boolean;
      eventHint?: string;
      tripHint?: string;
      peopleHint?: string[];
    } = {}
  ): Promise<RenameSuggestion> {
    const filename = basename(filePath);
    const ext = extname(filename).toLowerCase();
    const mimeType = getMimeType(filename);
    const category = getFileCategory(filename, mimeType || undefined);

    // Build context for naming
    const context: RenameContext = {
      filePath,
      filename,
      extension: ext,
      mimeType,
      category,
      eventName: options.eventHint,
      trip: options.tripHint,
      people: options.peopleHint,
    };

    // If filename is already readable, return it with low confidence
    if (!this.isUnreadable(filename)) {
      return {
        original: filename,
        suggested: filename,
        confidence: 0.3,
        reason: 'Имя файла уже читаемое',
        components: {},
      };
    }

    // Analyze based on file type
    if (category === 'image' || mimeType?.startsWith('image/')) {
      await this.analyzeImage(context);
    }

    // Use AI classification if enabled
    if (options.useAI && this.aiEnabled && this.classifier) {
      try {
        const result = await this.classifier.classifyFile({
          filename,
          content: context.ocrText,
        });
        context.aiCategory = result.category;
        context.aiConfidence = result.confidence;
      } catch {
        // Classification failed
      }
    }

    // Use OCR if enabled and available
    if (options.useOCR && this.ocr && (category === 'image' || category === 'document')) {
      try {
        const result = await this.ocr.recognize(filePath);
        if (result.text && result.text.length > 10) {
          context.ocrText = result.text;
        }
      } catch {
        // OCR failed
      }
    }

    // Generate name based on context
    return this.generateName(context);
  }

  /**
   * Generate suggestions for multiple files (batch mode)
   */
  async suggestBatch(
    files: string[],
    options: {
      useAI?: boolean;
      useOCR?: boolean;
      eventHint?: string;
      tripHint?: string;
      groupByDate?: boolean;
      groupByLocation?: boolean;
    } = {}
  ): Promise<RenameSuggestion[]> {
    const suggestions: RenameSuggestion[] = [];

    // First pass: analyze all files
    const contexts: RenameContext[] = [];
    for (const filePath of files) {
      const filename = basename(filePath);
      const ext = extname(filename).toLowerCase();
      const mimeType = getMimeType(filename);
      const category = getFileCategory(filename, mimeType || undefined);

      const context: RenameContext = {
        filePath,
        filename,
        extension: ext,
        mimeType,
        category,
        eventName: options.eventHint,
        trip: options.tripHint,
      };

      if (category === 'image' || mimeType?.startsWith('image/')) {
        await this.analyzeImage(context);
      }

      contexts.push(context);
    }

    // Group files if requested
    if (options.groupByDate || options.groupByLocation) {
      this.groupContexts(contexts, options);
    }

    // Generate names with sequence numbers for groups
    const dateGroups = new Map<string, number>();
    const locationGroups = new Map<string, number>();

    for (const context of contexts) {
      // Track sequence numbers
      const dateKey = context.imageMetadata?.dateTaken?.toISOString().slice(0, 10) || 'unknown';
      const locationKey = context.location?.city || context.location?.country || 'unknown';

      const dateSeq = (dateGroups.get(dateKey) || 0) + 1;
      dateGroups.set(dateKey, dateSeq);

      const locationSeq = (locationGroups.get(locationKey) || 0) + 1;
      locationGroups.set(locationKey, locationSeq);

      // Add sequence info to context
      const sequence = options.groupByLocation ? locationSeq : dateSeq;

      const suggestion = this.generateName(context, sequence > 1 ? sequence : undefined);
      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /**
   * Analyze image and extract metadata
   */
  private async analyzeImage(context: RenameContext): Promise<void> {
    try {
      const metadata = await analyzeImage(context.filePath);
      context.imageMetadata = metadata;

      // Get location from GPS if available
      if (metadata.gps) {
        try {
          const location = await reverseGeocode(
            metadata.gps.latitude,
            metadata.gps.longitude
          );
          context.location = location;
        } catch {
          // Geocoding failed
        }
      }
    } catch {
      // Image analysis failed
    }
  }

  /**
   * Group contexts by date or location for consistent naming
   */
  private groupContexts(
    contexts: RenameContext[],
    options: { groupByDate?: boolean; groupByLocation?: boolean }
  ): void {
    // Find common event/trip for files on same date or location
    const dateMap = new Map<string, RenameContext[]>();
    const locationMap = new Map<string, RenameContext[]>();

    for (const ctx of contexts) {
      if (options.groupByDate && ctx.imageMetadata?.dateTaken) {
        const dateKey = ctx.imageMetadata.dateTaken.toISOString().slice(0, 10);
        const group = dateMap.get(dateKey) || [];
        group.push(ctx);
        dateMap.set(dateKey, group);
      }

      if (options.groupByLocation && ctx.location?.city) {
        const locationKey = ctx.location.city;
        const group = locationMap.get(locationKey) || [];
        group.push(ctx);
        locationMap.set(locationKey, group);
      }
    }

    // If a group has multiple files with same location, set trip hint
    for (const [location, group] of locationMap) {
      if (group.length >= 3 && !group[0].trip) {
        for (const ctx of group) {
          ctx.trip = location;
        }
      }
    }
  }

  /**
   * Generate a smart name based on context
   */
  private generateName(context: RenameContext, sequence?: number): RenameSuggestion {
    const components: RenameSuggestion['components'] = {};
    const parts: string[] = [];
    let confidence = 0.5;
    const reasons: string[] = [];

    // 1. Event or trip name (highest priority)
    if (context.eventName) {
      parts.push(context.eventName);
      components.event = context.eventName;
      confidence += 0.2;
      reasons.push('событие задано пользователем');
    } else if (context.trip) {
      parts.push(context.trip);
      components.event = context.trip;
      confidence += 0.15;
      reasons.push('поездка определена по геолокации');
    }

    // 2. Location (if no event/trip)
    if (!parts.length && context.location) {
      const locationStr = formatLocation(context.location, this.language);
      if (locationStr) {
        parts.push(locationStr);
        components.location = locationStr;
        confidence += 0.15;
        reasons.push('место определено по GPS');
      }
    }

    // 3. Date
    if (context.imageMetadata?.dateTaken) {
      const dateStr = formatDateSmart(context.imageMetadata.dateTaken, this.language);
      components.date = dateStr;
      confidence += 0.1;
      reasons.push('дата из EXIF');

      // Add date to name if no event specified
      if (!context.eventName) {
        parts.push(dateStr);
      }
    }

    // 4. AI-based description
    if (context.aiCategory && context.aiConfidence && context.aiConfidence > 0.7) {
      const template = CATEGORY_TEMPLATES[context.aiCategory];
      if (template) {
        const aiName = template(context);
        if (aiName && !parts.includes(aiName)) {
          components.description = aiName;
          confidence += 0.1;
          reasons.push(`AI: ${context.aiCategory}`);
        }
      }
    }

    // 5. OCR-based keywords
    if (context.ocrText && !components.description) {
      const keywords = extractKeywords(context.ocrText);
      if (keywords.length > 0) {
        components.description = keywords.slice(0, 2).join(' ');
        confidence += 0.05;
        reasons.push('ключевые слова из OCR');
      }
    }

    // 6. Sequence number
    if (sequence && sequence > 1) {
      components.sequence = sequence;
    }

    // Build final name
    let suggested: string;

    if (parts.length === 0) {
      // Fallback: use date or keep original with cleanup
      if (components.date) {
        suggested = components.date;
      } else {
        // Clean up original name
        suggested = cleanupFilename(context.filename, context.extension);
        confidence = 0.3;
        reasons.push('очистка оригинального имени');
      }
    } else {
      suggested = parts.join(' - ');
    }

    // Add description if available and not already included
    if (components.description && !suggested.includes(components.description)) {
      suggested += ` - ${components.description}`;
    }

    // Add sequence number
    if (components.sequence) {
      suggested += ` (${components.sequence})`;
    }

    // Ensure extension
    if (context.extension && !suggested.toLowerCase().endsWith(context.extension)) {
      suggested += context.extension;
    }

    // Sanitize
    suggested = sanitizeFilename(suggested);

    return {
      original: context.filename,
      suggested,
      confidence: Math.min(confidence, 1),
      reason: reasons.join(', ') || 'базовое переименование',
      components,
    };
  }

  setLanguage(lang: 'ru' | 'en'): void {
    this.language = lang;
  }
}

// ═══════════════════════════════════════════════════════════════
// Template functions for different file types
// ═══════════════════════════════════════════════════════════════

function buildPhotoName(ctx: RenameContext): string | null {
  const parts: string[] = [];

  if (ctx.location) {
    parts.push(ctx.location.city || ctx.location.country || '');
  }

  if (ctx.imageMetadata?.dateTaken) {
    const month = MONTH_NAMES_RU[ctx.imageMetadata.dateTaken.getMonth()];
    const year = ctx.imageMetadata.dateTaken.getFullYear();
    parts.push(`${month} ${year}`);
  }

  return parts.filter(Boolean).join(' - ') || null;
}

function buildScreenshotName(ctx: RenameContext): string | null {
  const prefix = 'Снимок экрана';

  if (ctx.imageMetadata?.dateTaken) {
    return `${prefix} ${format(ctx.imageMetadata.dateTaken, 'yyyy-MM-dd HH-mm')}`;
  }

  return prefix;
}

function buildMemeName(_ctx: RenameContext): string | null {
  return 'Мем';
}

function buildDesignName(ctx: RenameContext): string | null {
  if (ctx.ocrText) {
    const keywords = extractKeywords(ctx.ocrText);
    if (keywords.length > 0) {
      return `Дизайн - ${keywords[0]}`;
    }
  }
  return 'Дизайн';
}

function buildVideoName(ctx: RenameContext): string | null {
  const parts: string[] = ['Видео'];

  if (ctx.location) {
    parts.push(ctx.location.city || ctx.location.country || '');
  }

  if (ctx.imageMetadata?.dateTaken) {
    parts.push(format(ctx.imageMetadata.dateTaken, 'MMMM yyyy'));
  }

  return parts.filter(Boolean).join(' - ');
}

function buildDocumentName(ctx: RenameContext): string | null {
  const analysis = analyzeFilename(ctx.filename);

  if (analysis.documentType && analysis.entity) {
    return `${analysis.documentType} - ${analysis.entity}`;
  }

  return null;
}

function buildFinancialDocName(ctx: RenameContext): string | null {
  const analysis = analyzeFilename(ctx.filename);

  if (analysis.entity && analysis.year) {
    return `Финансы ${analysis.entity} ${analysis.year}`;
  }

  return null;
}

function buildInvoiceName(ctx: RenameContext): string | null {
  const analysis = analyzeFilename(ctx.filename);

  if (analysis.entity) {
    const date = analysis.year ? ` ${analysis.year}` : '';
    return `Счёт ${analysis.entity}${date}`;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════════════════

function formatLocation(location: LocationInfo, lang: 'ru' | 'en'): string {
  const parts: string[] = [];

  if (location.city) {
    parts.push(location.city);
  } else if (location.region) {
    parts.push(location.region);
  }

  if (location.country && parts.length === 0) {
    parts.push(location.country);
  }

  return parts.join(', ');
}

function formatDateSmart(date: Date, lang: 'ru' | 'en'): string {
  const monthNames = lang === 'ru' ? MONTH_NAMES_RU : MONTH_NAMES_EN;
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  return `${month} ${year}`;
}

function extractKeywords(text: string): string[] {
  // Remove common words and extract meaningful keywords
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'и', 'в', 'на', 'с', 'по', 'из', 'за', 'от', 'до', 'это', 'как',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\sа-яёА-ЯЁ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .slice(0, 10);

  // Count word frequency
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  // Return most frequent words
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}

function cleanupFilename(filename: string, ext: string): string {
  // Remove extension first
  let name = filename.replace(new RegExp(`\\${ext}$`, 'i'), '');

  // Remove common prefixes
  name = name.replace(/^(IMG|DSC|PXL|Photo|Screenshot|VID)[-_]?/i, '');

  // Replace underscores and dashes with spaces
  name = name.replace(/[_-]+/g, ' ');

  // Remove long number sequences
  name = name.replace(/\d{6,}/g, '');

  // Clean up spaces
  name = name.replace(/\s+/g, ' ').trim();

  // If nothing left, use generic name
  if (!name || name.length < 3) {
    name = 'Файл';
  }

  return name;
}

function sanitizeFilename(filename: string): string {
  // Remove invalid characters
  let sanitized = filename.replace(/[<>:"/\\|?*]/g, '');

  // Replace multiple spaces with single space
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Trim
  sanitized = sanitized.trim();

  // Limit length (preserving extension)
  const ext = extname(sanitized);
  const base = basename(sanitized, ext);
  if (base.length > 100) {
    sanitized = base.slice(0, 100).trim() + ext;
  }

  return sanitized;
}

export default SmartRenamer;
