import mimeTypes from 'mime-types';

export type FileCategory =
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'code'
  | 'archive'
  | 'executable'
  | 'data'
  | 'other';

const categoryMappings: Record<string, FileCategory> = {
  // Images
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'image/bmp': 'image',
  'image/tiff': 'image',
  'image/heic': 'image',
  'image/heif': 'image',
  'image/x-icon': 'image',
  'image/vnd.adobe.photoshop': 'image',

  // Documents
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'application/vnd.ms-powerpoint': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  'application/rtf': 'document',
  'text/plain': 'document',
  'text/markdown': 'document',
  'application/vnd.oasis.opendocument.text': 'document',
  'application/vnd.oasis.opendocument.spreadsheet': 'document',
  'application/epub+zip': 'document',

  // Audio
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/flac': 'audio',
  'audio/aac': 'audio',
  'audio/x-m4a': 'audio',
  'audio/midi': 'audio',

  // Video
  'video/mp4': 'video',
  'video/mpeg': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video',
  'video/x-matroska': 'video',
  'video/webm': 'video',
  'video/x-flv': 'video',
  'video/3gpp': 'video',

  // Code
  'text/javascript': 'code',
  'application/javascript': 'code',
  'text/typescript': 'code',
  'text/x-python': 'code',
  'text/x-java': 'code',
  'text/x-c': 'code',
  'text/x-c++': 'code',
  'text/x-go': 'code',
  'text/x-rust': 'code',
  'text/html': 'code',
  'text/css': 'code',
  'application/json': 'code',
  'application/xml': 'code',
  'text/xml': 'code',
  'application/x-yaml': 'code',
  'text/yaml': 'code',
  'text/x-shellscript': 'code',

  // Archives
  'application/zip': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/x-tar': 'archive',
  'application/gzip': 'archive',
  'application/x-bzip2': 'archive',
  'application/x-xz': 'archive',

  // Executables
  'application/x-executable': 'executable',
  'application/x-mach-binary': 'executable',
  'application/x-msdownload': 'executable',
  'application/vnd.apple.installer+xml': 'executable',
  'application/x-apple-diskimage': 'executable',

  // Data
  'application/x-sqlite3': 'data',
  'application/vnd.sqlite3': 'data',
  'text/csv': 'data',
  'application/x-ndjson': 'data',
};

const extensionMappings: Record<string, FileCategory> = {
  // Code extensions not always detected by mime-types
  ts: 'code',
  tsx: 'code',
  jsx: 'code',
  vue: 'code',
  svelte: 'code',
  py: 'code',
  rb: 'code',
  go: 'code',
  rs: 'code',
  java: 'code',
  kt: 'code',
  scala: 'code',
  php: 'code',
  swift: 'code',
  c: 'code',
  cpp: 'code',
  h: 'code',
  hpp: 'code',
  cs: 'code',
  fs: 'code',
  lua: 'code',
  r: 'code',
  sql: 'code',
  sh: 'code',
  bash: 'code',
  zsh: 'code',
  ps1: 'code',
  bat: 'code',
  yml: 'code',
  yaml: 'code',
  toml: 'code',
  ini: 'code',
  env: 'code',
  dockerfile: 'code',
  makefile: 'code',
  cmake: 'code',

  // Image extensions
  heic: 'image',
  heif: 'image',
  raw: 'image',
  cr2: 'image',
  nef: 'image',
  arw: 'image',
  dng: 'image',
  psd: 'image',
  ai: 'image',
  sketch: 'image',
  fig: 'image',
  xd: 'image',

  // Document extensions
  md: 'document',
  rst: 'document',
  tex: 'document',
  pages: 'document',
  numbers: 'document',
  keynote: 'document',

  // Data extensions
  db: 'data',
  sqlite: 'data',
  sqlite3: 'data',
  parquet: 'data',
  arrow: 'data',
  feather: 'data',

  // Archive extensions
  tgz: 'archive',
  tbz2: 'archive',
  txz: 'archive',

  // Executable extensions
  dmg: 'executable',
  pkg: 'executable',
  app: 'executable',
  exe: 'executable',
  msi: 'executable',
  deb: 'executable',
  rpm: 'executable',
  appimage: 'executable',
};

export function getMimeType(filename: string): string | null {
  const mime = mimeTypes.lookup(filename);
  return mime || null;
}

export function getExtensionFromMime(mimeType: string): string | null {
  const ext = mimeTypes.extension(mimeType);
  return ext || null;
}

export function getFileCategory(filename: string, mimeType?: string): FileCategory {
  // Try by MIME type first
  if (mimeType && categoryMappings[mimeType]) {
    return categoryMappings[mimeType];
  }

  // Try by extension
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext && extensionMappings[ext]) {
    return extensionMappings[ext];
  }

  // Try to get MIME type from filename
  const detectedMime = getMimeType(filename);
  if (detectedMime && categoryMappings[detectedMime]) {
    return categoryMappings[detectedMime];
  }

  // Check MIME type prefix
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('text/')) return 'document';
  }

  return 'other';
}

export function isImage(filename: string): boolean {
  return getFileCategory(filename) === 'image';
}

export function isDocument(filename: string): boolean {
  return getFileCategory(filename) === 'document';
}

export function isAudio(filename: string): boolean {
  return getFileCategory(filename) === 'audio';
}

export function isVideo(filename: string): boolean {
  return getFileCategory(filename) === 'video';
}

export function isCode(filename: string): boolean {
  return getFileCategory(filename) === 'code';
}

export function isArchive(filename: string): boolean {
  return getFileCategory(filename) === 'archive';
}

export function isExecutable(filename: string): boolean {
  return getFileCategory(filename) === 'executable';
}

export function getCategoryIcon(category: FileCategory): string {
  const icons: Record<FileCategory, string> = {
    image: '🖼️',
    document: '📄',
    audio: '🎵',
    video: '🎬',
    code: '💻',
    archive: '📦',
    executable: '⚙️',
    data: '🗃️',
    other: '❓',
  };
  return icons[category];
}
