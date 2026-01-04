import { stat } from 'fs/promises';

export interface VideoMetadata {
  duration?: number;
  width?: number;
  height?: number;
  codec?: string;
  fps?: number;
  bitrate?: number;
  hasAudio?: boolean;
  isHDR?: boolean;
  year?: number;
  title?: string;
}

export async function analyzeVideo(filePath: string): Promise<VideoMetadata> {
  const metadata: VideoMetadata = {};

  try {
    // Basic file analysis
    const fileStats = await stat(filePath);

    // Note: For real implementation, would use ffprobe to get detailed metadata
    void fileStats.size; // File size available for future bitrate estimation

    // Try to extract year from filename
    const yearMatch = filePath.match(/[(\[.]?(19|20)\d{2}[)\].]?/);
    if (yearMatch) {
      metadata.year = parseInt(yearMatch[0].replace(/[^\d]/g, ''));
    }

    // Detect resolution from filename
    const resolutionPatterns: Record<string, { width: number; height: number }> = {
      '4k': { width: 3840, height: 2160 },
      '2160p': { width: 3840, height: 2160 },
      '1080p': { width: 1920, height: 1080 },
      '720p': { width: 1280, height: 720 },
      '480p': { width: 854, height: 480 },
    };

    const lowerPath = filePath.toLowerCase();
    for (const [pattern, resolution] of Object.entries(resolutionPatterns)) {
      if (lowerPath.includes(pattern)) {
        metadata.width = resolution.width;
        metadata.height = resolution.height;
        break;
      }
    }

    // Check for HDR indicators
    if (lowerPath.includes('hdr') || lowerPath.includes('dolby vision') || lowerPath.includes('dv')) {
      metadata.isHDR = true;
    }

    // Common codecs in filenames
    const codecs = ['h264', 'h265', 'hevc', 'x264', 'x265', 'av1', 'vp9'];
    for (const codec of codecs) {
      if (lowerPath.includes(codec)) {
        metadata.codec = codec.toUpperCase();
        break;
      }
    }

  } catch {
    // Video analysis failed
  }

  return metadata;
}

export function formatDuration(seconds?: number): string {
  if (!seconds) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function getVideoCategory(
  filename: string,
  metadata: VideoMetadata
): 'movie' | 'tv' | 'personal' | 'tutorial' | 'other' {
  const lower = filename.toLowerCase();

  // TV show patterns
  const tvPatterns = [
    /s\d{1,2}e\d{1,2}/i,
    /\d{1,2}x\d{1,2}/i,
    /season\s*\d+/i,
    /episode\s*\d+/i,
  ];

  if (tvPatterns.some(p => p.test(filename))) {
    return 'tv';
  }

  // Movie patterns
  if (metadata.year && (metadata.width || 0) >= 1280) {
    const movieIndicators = ['1080p', '720p', '4k', 'bluray', 'brrip', 'webrip'];
    if (movieIndicators.some(i => lower.includes(i))) {
      return 'movie';
    }
  }

  // Tutorial patterns
  const tutorialPatterns = [
    /tutorial/i,
    /lesson/i,
    /course/i,
    /lecture/i,
    /how\s*to/i,
  ];

  if (tutorialPatterns.some(p => p.test(filename))) {
    return 'tutorial';
  }

  // Personal video patterns
  const personalPatterns = [
    /^vid/i,
    /^mov/i,
    /^img_/i,
    /^dsc/i,
    /\d{8}_\d{6}/,
  ];

  if (personalPatterns.some(p => p.test(filename))) {
    return 'personal';
  }

  return 'other';
}

export function extractShowInfo(
  filename: string
): { show?: string; season?: number; episode?: number } | null {
  // S01E01 pattern
  const pattern1 = /^(.+?)[\s._-]+s(\d{1,2})e(\d{1,2})/i;
  const match1 = filename.match(pattern1);
  if (match1) {
    return {
      show: match1[1].replace(/[._-]/g, ' ').trim(),
      season: parseInt(match1[2]),
      episode: parseInt(match1[3]),
    };
  }

  // 1x01 pattern
  const pattern2 = /^(.+?)[\s._-]+(\d{1,2})x(\d{1,2})/i;
  const match2 = filename.match(pattern2);
  if (match2) {
    return {
      show: match2[1].replace(/[._-]/g, ' ').trim(),
      season: parseInt(match2[2]),
      episode: parseInt(match2[3]),
    };
  }

  return null;
}
