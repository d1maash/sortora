import type { ParsedRule } from '../parser.js';

export const desktopPreset: ParsedRule[] = [
  {
    name: 'Desktop screenshots',
    priority: 100,
    enabled: true,
    match: {
      extension: ['png', 'jpg'],
      filename: ['Screenshot*', 'Screen Shot*', 'Снимок*'],
    },
    action: {
      moveTo: '{destinations.screenshots}/{year}-{month}/',
    },
  },
  {
    name: 'Desktop temporary files',
    priority: 100,
    enabled: true,
    match: {
      extension: ['tmp', 'temp', 'bak'],
    },
    action: {
      delete: true,
    },
  },
  {
    name: 'Desktop documents',
    priority: 85,
    enabled: true,
    match: {
      extension: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'txt'],
      age: '> 7 days',
    },
    action: {
      suggestTo: '{destinations.documents}/{year}/',
    },
  },
  {
    name: 'Desktop images',
    priority: 80,
    enabled: true,
    match: {
      extension: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      age: '> 7 days',
    },
    action: {
      suggestTo: '{destinations.photos}/Desktop/',
    },
  },
  {
    name: 'Desktop archives',
    priority: 75,
    enabled: true,
    match: {
      extension: ['zip', 'rar', '7z'],
      age: '> 14 days',
    },
    action: {
      suggestTo: '{destinations.archives}/',
    },
  },
  {
    name: 'Old desktop files',
    priority: 50,
    enabled: true,
    match: {
      age: '> 30 days',
      accessed: '> 14 days',
    },
    action: {
      archiveTo: '{destinations.archives}/Old Desktop/',
      confirm: true,
    },
  },
];

export default desktopPreset;
