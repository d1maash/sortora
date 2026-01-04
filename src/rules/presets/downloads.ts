import type { ParsedRule } from '../parser.js';

export const downloadsPreset: ParsedRule[] = [
  {
    name: 'Old installers (30+ days)',
    priority: 100,
    enabled: true,
    match: {
      extension: ['dmg', 'pkg', 'exe', 'msi', 'deb', 'rpm'],
      age: '> 30 days',
    },
    action: {
      delete: true,
      confirm: true,
    },
  },
  {
    name: 'Temporary files',
    priority: 100,
    enabled: true,
    match: {
      extension: ['tmp', 'temp', 'bak', 'swp', 'crdownload', 'part'],
    },
    action: {
      delete: true,
    },
  },
  {
    name: 'Screenshots',
    priority: 95,
    enabled: true,
    match: {
      extension: ['png', 'jpg', 'jpeg'],
      filename: ['Screenshot*', 'Screen Shot*', 'Снимок*', 'Capture*'],
    },
    action: {
      moveTo: '{destinations.screenshots}/{year}-{month}/',
    },
  },
  {
    name: 'Downloaded images',
    priority: 80,
    enabled: true,
    match: {
      extension: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    },
    action: {
      suggestTo: '{destinations.photos}/Downloads/',
    },
  },
  {
    name: 'PDF documents',
    priority: 85,
    enabled: true,
    match: {
      extension: ['pdf'],
    },
    action: {
      suggestTo: '{destinations.documents}/{year}/',
    },
  },
  {
    name: 'Office documents',
    priority: 85,
    enabled: true,
    match: {
      extension: ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'odt', 'ods', 'odp'],
    },
    action: {
      suggestTo: '{destinations.documents}/{year}/',
    },
  },
  {
    name: 'Music files',
    priority: 80,
    enabled: true,
    match: {
      extension: ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a'],
    },
    action: {
      moveTo: '{destinations.music}/{audio.artist}/{audio.album}/',
    },
  },
  {
    name: 'Video files',
    priority: 80,
    enabled: true,
    match: {
      extension: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'flv'],
    },
    action: {
      suggestTo: '{destinations.video}/{year}/',
    },
  },
  {
    name: 'Archives',
    priority: 75,
    enabled: true,
    match: {
      extension: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz'],
    },
    action: {
      suggestTo: '{destinations.archives}/',
    },
  },
  {
    name: 'Ebooks',
    priority: 85,
    enabled: true,
    match: {
      extension: ['epub', 'mobi', 'azw3', 'fb2'],
    },
    action: {
      suggestTo: '{destinations.documents}/Books/',
    },
  },
  {
    name: 'Font files',
    priority: 70,
    enabled: true,
    match: {
      extension: ['ttf', 'otf', 'woff', 'woff2'],
    },
    action: {
      suggestTo: '~/Library/Fonts/',
    },
  },
  {
    name: 'Old downloads (90+ days)',
    priority: 50,
    enabled: true,
    match: {
      age: '> 90 days',
      accessed: '> 60 days',
    },
    action: {
      archiveTo: '{destinations.archives}/Old Downloads/',
      confirm: true,
    },
  },
];

export default downloadsPreset;
