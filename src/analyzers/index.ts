import { getFileCategory, type FileCategory } from '../utils/mime.js';
import { analyzeImage, type ImageMetadata } from './image.js';
import { analyzeDocument, type DocumentMetadata } from './document.js';
import { analyzeAudio, type AudioMetadata } from './audio.js';
import { analyzeVideo, type VideoMetadata } from './video.js';
import { analyzeCode, type CodeMetadata } from './code.js';
import { analyzeArchive, type ArchiveMetadata } from './archive.js';

export type FileMetadata =
  | ImageMetadata
  | DocumentMetadata
  | AudioMetadata
  | VideoMetadata
  | CodeMetadata
  | ArchiveMetadata
  | Record<string, unknown>;

export interface AnalyzerResult {
  category: FileCategory;
  metadata: FileMetadata;
  textContent?: string;
}

export async function analyzeByType(
  filePath: string,
  filename: string,
  mimeType?: string
): Promise<AnalyzerResult> {
  const category = getFileCategory(filename, mimeType);

  try {
    switch (category) {
      case 'image':
        return {
          category,
          metadata: await analyzeImage(filePath),
        };

      case 'document':
        const docResult = await analyzeDocument(filePath, filename);
        return {
          category,
          metadata: docResult.metadata,
          textContent: docResult.textContent,
        };

      case 'audio':
        return {
          category,
          metadata: await analyzeAudio(filePath),
        };

      case 'video':
        return {
          category,
          metadata: await analyzeVideo(filePath),
        };

      case 'code':
        const codeResult = await analyzeCode(filePath, filename);
        return {
          category,
          metadata: codeResult.metadata,
          textContent: codeResult.textContent,
        };

      case 'archive':
        return {
          category,
          metadata: await analyzeArchive(filePath, filename),
        };

      default:
        return {
          category,
          metadata: {},
        };
    }
  } catch (error) {
    // Return basic result on error
    return {
      category,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

export {
  analyzeImage,
  analyzeDocument,
  analyzeAudio,
  analyzeVideo,
  analyzeCode,
  analyzeArchive,
  type ImageMetadata,
  type DocumentMetadata,
  type AudioMetadata,
  type VideoMetadata,
  type CodeMetadata,
  type ArchiveMetadata,
};
