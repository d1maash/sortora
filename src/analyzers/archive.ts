import { stat } from 'fs/promises';
import { extname } from 'path';

export interface ArchiveMetadata {
  format?: string;
  compressedSize?: number;
  estimatedFiles?: number;
  isMultiPart?: boolean;
  partNumber?: number;
  password?: boolean;
}

const archiveFormats: Record<string, string> = {
  zip: 'ZIP',
  rar: 'RAR',
  '7z': '7-Zip',
  tar: 'TAR',
  gz: 'Gzip',
  bz2: 'Bzip2',
  xz: 'XZ',
  tgz: 'TAR.GZ',
  tbz2: 'TAR.BZ2',
  txz: 'TAR.XZ',
  lz: 'LZ',
  lzma: 'LZMA',
  cab: 'Cabinet',
  iso: 'ISO',
  dmg: 'DMG',
  pkg: 'PKG',
  deb: 'Debian Package',
  rpm: 'RPM Package',
  apk: 'APK',
  jar: 'JAR',
  war: 'WAR',
  ear: 'EAR',
  epub: 'EPUB',
  cbz: 'Comic Book (ZIP)',
  cbr: 'Comic Book (RAR)',
};

export async function analyzeArchive(
  filePath: string,
  filename: string
): Promise<ArchiveMetadata> {
  const metadata: ArchiveMetadata = {};

  try {
    // Get file size
    const fileStats = await stat(filePath);
    metadata.compressedSize = fileStats.size;

    // Detect format from extension
    let ext = extname(filename).toLowerCase().slice(1);

    // Handle compound extensions like .tar.gz
    if (filename.toLowerCase().endsWith('.tar.gz')) {
      ext = 'tgz';
    } else if (filename.toLowerCase().endsWith('.tar.bz2')) {
      ext = 'tbz2';
    } else if (filename.toLowerCase().endsWith('.tar.xz')) {
      ext = 'txz';
    }

    metadata.format = archiveFormats[ext] || ext.toUpperCase();

    // Detect multi-part archives
    const multiPartPatterns = [
      /\.part\d+\./i,
      /\.r\d{2}$/i,
      /\.\d{3}$/,
      /\.z\d{2}$/i,
    ];

    for (const pattern of multiPartPatterns) {
      const match = filename.match(pattern);
      if (match) {
        metadata.isMultiPart = true;
        const numMatch = match[0].match(/\d+/);
        if (numMatch) {
          metadata.partNumber = parseInt(numMatch[0]);
        }
        break;
      }
    }

    // Estimate file count based on size (rough heuristic)
    // Assumes average compressed file is ~100KB
    metadata.estimatedFiles = Math.max(1, Math.floor(fileStats.size / (100 * 1024)));

  } catch {
    // Archive analysis failed
  }

  return metadata;
}

export function getArchiveCategory(
  filename: string,
  metadata: ArchiveMetadata
): 'backup' | 'software' | 'media' | 'documents' | 'other' {
  const lower = filename.toLowerCase();

  // Backup patterns
  const backupPatterns = [
    /backup/i,
    /\d{4}-\d{2}-\d{2}/,
    /\d{8}/,
    /bak/i,
    /old/i,
  ];

  if (backupPatterns.some(p => p.test(filename))) {
    return 'backup';
  }

  // Software patterns
  if (['dmg', 'pkg', 'deb', 'rpm', 'apk', 'exe', 'msi'].some(ext =>
    lower.endsWith(`.${ext}`) || metadata.format?.toLowerCase() === ext
  )) {
    return 'software';
  }

  // Media archive patterns
  if (['cbz', 'cbr', 'epub'].some(ext =>
    lower.endsWith(`.${ext}`) || metadata.format?.toLowerCase() === ext
  )) {
    return 'media';
  }

  // Java/Enterprise patterns
  if (['jar', 'war', 'ear'].some(ext =>
    lower.endsWith(`.${ext}`)
  )) {
    return 'software';
  }

  return 'other';
}

export function isInstallerArchive(filename: string): boolean {
  const installerPatterns = [
    /setup/i,
    /install/i,
    /installer/i,
    /-x64/i,
    /-x86/i,
    /-amd64/i,
    /-arm64/i,
    /portable/i,
  ];

  const installerExtensions = ['.dmg', '.pkg', '.deb', '.rpm', '.msi', '.exe', '.appimage'];

  const lower = filename.toLowerCase();

  if (installerExtensions.some(ext => lower.endsWith(ext))) {
    return true;
  }

  return installerPatterns.some(p => p.test(filename));
}

export function shouldAutoExtract(
  filename: string,
  metadata: ArchiveMetadata
): boolean {
  // Don't auto-extract multi-part archives
  if (metadata.isMultiPart) {
    return false;
  }

  // Don't auto-extract password-protected
  if (metadata.password) {
    return false;
  }

  // Don't auto-extract installers
  if (isInstallerArchive(filename)) {
    return false;
  }

  // Don't auto-extract very large archives
  if (metadata.compressedSize && metadata.compressedSize > 1024 * 1024 * 1024) {
    return false;
  }

  return true;
}
