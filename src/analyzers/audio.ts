import * as musicMetadata from 'music-metadata';

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string[];
  track?: { no: number | null; of: number | null };
  disk?: { no: number | null; of: number | null };
  duration?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
  lossless?: boolean;
  albumArtist?: string;
  composer?: string;
  label?: string;
  bpm?: number;
}

export async function analyzeAudio(filePath: string): Promise<AudioMetadata> {
  const metadata: AudioMetadata = {};

  try {
    const result = await musicMetadata.parseFile(filePath);

    // Common tags
    if (result.common) {
      metadata.title = result.common.title;
      metadata.artist = result.common.artist;
      metadata.album = result.common.album;
      metadata.year = result.common.year;
      metadata.genre = result.common.genre;
      metadata.track = result.common.track;
      metadata.disk = result.common.disk;
      metadata.albumArtist = result.common.albumartist;
      metadata.composer = result.common.composer?.join(', ');
      metadata.label = result.common.label?.join(', ');
      metadata.bpm = result.common.bpm;
    }

    // Format info
    if (result.format) {
      metadata.duration = result.format.duration;
      metadata.bitrate = result.format.bitrate;
      metadata.sampleRate = result.format.sampleRate;
      metadata.channels = result.format.numberOfChannels;
      metadata.codec = result.format.codec;
      metadata.lossless = result.format.lossless;
    }
  } catch {
    // Audio parsing failed
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

export function getAudioPath(metadata: AudioMetadata): string {
  const parts: string[] = [];

  if (metadata.artist) {
    parts.push(sanitizePath(metadata.artist));
  } else {
    parts.push('Unknown Artist');
  }

  if (metadata.album) {
    const albumName = metadata.year
      ? `${metadata.year} - ${metadata.album}`
      : metadata.album;
    parts.push(sanitizePath(albumName));
  } else {
    parts.push('Unknown Album');
  }

  return parts.join('/');
}

function sanitizePath(str: string): string {
  return str
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPodcast(metadata: AudioMetadata, filename: string): boolean {
  const podcastPatterns = [
    /podcast/i,
    /episode/i,
    /ep\d+/i,
    /s\d+e\d+/i,
  ];

  if (podcastPatterns.some(p => p.test(filename))) {
    return true;
  }

  // Long duration with spoken word indicators
  if (metadata.duration && metadata.duration > 20 * 60) {
    const genre = metadata.genre?.join(' ').toLowerCase() || '';
    if (genre.includes('podcast') || genre.includes('speech') || genre.includes('spoken')) {
      return true;
    }
  }

  return false;
}

export function isAudiobook(metadata: AudioMetadata, filename: string): boolean {
  const audiobookPatterns = [
    /audiobook/i,
    /chapter/i,
    /part\s*\d+/i,
  ];

  if (audiobookPatterns.some(p => p.test(filename))) {
    return true;
  }

  const genre = metadata.genre?.join(' ').toLowerCase() || '';
  return genre.includes('audiobook') || genre.includes('speech');
}
