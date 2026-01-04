import { readFile } from 'fs/promises';
import { extname } from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export interface DocumentMetadata {
  pageCount?: number;
  wordCount?: number;
  author?: string;
  title?: string;
  subject?: string;
  creator?: string;
  creationDate?: Date;
  modificationDate?: Date;
  keywords?: string[];
  language?: string;
}

export interface DocumentAnalysisResult {
  metadata: DocumentMetadata;
  textContent?: string;
}

export async function analyzeDocument(
  filePath: string,
  filename: string
): Promise<DocumentAnalysisResult> {
  const ext = extname(filename).toLowerCase().slice(1);

  switch (ext) {
    case 'pdf':
      return analyzePdf(filePath);
    case 'docx':
    case 'doc':
      return analyzeDocx(filePath);
    case 'txt':
    case 'md':
    case 'markdown':
    case 'rst':
      return analyzeTextFile(filePath);
    default:
      return { metadata: {} };
  }
}

async function analyzePdf(filePath: string): Promise<DocumentAnalysisResult> {
  const metadata: DocumentMetadata = {};
  let textContent = '';

  try {
    const buffer = await readFile(filePath);
    const data = await pdfParse(buffer);

    metadata.pageCount = data.numpages;
    textContent = data.text;

    if (textContent) {
      metadata.wordCount = countWords(textContent);
    }

    if (data.info) {
      metadata.author = data.info.Author;
      metadata.title = data.info.Title;
      metadata.subject = data.info.Subject;
      metadata.creator = data.info.Creator;

      if (data.info.CreationDate) {
        metadata.creationDate = parsePdfDate(data.info.CreationDate);
      }
      if (data.info.ModDate) {
        metadata.modificationDate = parsePdfDate(data.info.ModDate);
      }
      if (data.info.Keywords) {
        metadata.keywords = data.info.Keywords.split(/[,;]/).map((k: string) => k.trim());
      }
    }
  } catch {
    // PDF parsing failed
  }

  return { metadata, textContent };
}

async function analyzeDocx(filePath: string): Promise<DocumentAnalysisResult> {
  const metadata: DocumentMetadata = {};
  let textContent = '';

  try {
    const buffer = await readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });

    textContent = result.value;
    if (textContent) {
      metadata.wordCount = countWords(textContent);
    }
  } catch {
    // DOCX parsing failed
  }

  return { metadata, textContent };
}

async function analyzeTextFile(filePath: string): Promise<DocumentAnalysisResult> {
  const metadata: DocumentMetadata = {};
  let textContent = '';

  try {
    textContent = await readFile(filePath, 'utf-8');
    metadata.wordCount = countWords(textContent);
    metadata.language = detectLanguage(textContent);
  } catch {
    // Text file reading failed
  }

  return { metadata, textContent };
}

function parsePdfDate(dateStr: string): Date | undefined {
  // PDF date format: D:YYYYMMDDHHmmSS
  if (dateStr.startsWith('D:')) {
    dateStr = dateStr.slice(2);
  }

  const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (match) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  }

  return undefined;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

function detectLanguage(text: string): string | undefined {
  // Simple language detection based on character frequency
  const sample = text.slice(0, 1000).toLowerCase();

  // Check for Cyrillic characters
  const cyrillicCount = (sample.match(/[а-яё]/g) || []).length;
  const latinCount = (sample.match(/[a-z]/g) || []).length;

  if (cyrillicCount > latinCount * 0.5) {
    return 'ru';
  }

  // Check for common English words
  const englishWords = ['the', 'and', 'is', 'are', 'was', 'were', 'been', 'have', 'has', 'with'];
  const englishCount = englishWords.filter(w => sample.includes(w)).length;

  if (englishCount >= 3) {
    return 'en';
  }

  return undefined;
}

export function isFinancialDocument(
  filename: string,
  textContent?: string
): boolean {
  const financialPatterns = [
    /invoice/i,
    /receipt/i,
    /statement/i,
    /счёт/i,
    /счет/i,
    /чек/i,
    /выписка/i,
    /rechnung/i,
    /factura/i,
  ];

  if (financialPatterns.some(p => p.test(filename))) {
    return true;
  }

  if (textContent) {
    const financialKeywords = [
      'total', 'amount', 'payment', 'invoice', 'receipt',
      'итого', 'сумма', 'оплата', 'счёт',
    ];
    const lowerContent = textContent.toLowerCase();
    return financialKeywords.filter(k => lowerContent.includes(k)).length >= 2;
  }

  return false;
}

export function isContract(textContent?: string): boolean {
  if (!textContent) return false;

  const contractKeywords = [
    'agreement', 'contract', 'party', 'parties', 'hereby',
    'terms and conditions', 'effective date', 'signature',
    'договор', 'соглашение', 'сторона', 'стороны', 'условия',
  ];

  const lowerContent = textContent.toLowerCase();
  return contractKeywords.filter(k => lowerContent.includes(k)).length >= 3;
}
