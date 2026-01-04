import type { ParsedRule } from '../parser.js';

export const photosPreset: ParsedRule[] = [
  {
    name: 'Photos with EXIF',
    priority: 100,
    enabled: true,
    match: {
      extension: ['jpg', 'jpeg', 'heic', 'heif'],
      hasExif: true,
    },
    action: {
      moveTo: '{destinations.photos}/{exif.year}/{exif.month}/',
    },
  },
  {
    name: 'RAW photos',
    priority: 95,
    enabled: true,
    match: {
      extension: ['raw', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'orf', 'rw2'],
      hasExif: true,
    },
    action: {
      moveTo: '{destinations.photos}/RAW/{exif.year}/{exif.month}/',
    },
  },
  {
    name: 'Screenshots',
    priority: 90,
    enabled: true,
    match: {
      extension: ['png', 'jpg'],
      filename: ['Screenshot*', 'Screen Shot*', 'IMG_*'],
    },
    action: {
      moveTo: '{destinations.screenshots}/{year}-{month}/',
    },
  },
  {
    name: 'Phone photos (DCIM)',
    priority: 85,
    enabled: true,
    match: {
      extension: ['jpg', 'jpeg', 'heic'],
      filename: ['IMG_*', 'DSC*', 'DCIM*', 'PXL_*'],
    },
    action: {
      moveTo: '{destinations.photos}/{year}/{month}/',
    },
  },
  {
    name: 'Edited photos',
    priority: 80,
    enabled: true,
    match: {
      extension: ['jpg', 'jpeg', 'png', 'tiff'],
      filename: ['*-edited*', '*_edit*', '*-final*'],
    },
    action: {
      moveTo: '{destinations.photos}/Edited/{year}/',
    },
  },
  {
    name: 'Photos without EXIF',
    priority: 70,
    enabled: true,
    match: {
      extension: ['jpg', 'jpeg', 'png'],
      hasExif: false,
    },
    action: {
      suggestTo: '{destinations.photos}/Unsorted/',
    },
  },
  {
    name: 'GIF animations',
    priority: 75,
    enabled: true,
    match: {
      extension: ['gif'],
    },
    action: {
      moveTo: '{destinations.photos}/GIFs/',
    },
  },
  {
    name: 'Vector graphics',
    priority: 75,
    enabled: true,
    match: {
      extension: ['svg', 'ai', 'eps'],
    },
    action: {
      moveTo: '{destinations.photos}/Vector/',
    },
  },
  {
    name: 'Design files',
    priority: 80,
    enabled: true,
    match: {
      extension: ['psd', 'xcf', 'sketch', 'fig', 'xd'],
    },
    action: {
      suggestTo: '{destinations.photos}/Design/',
    },
  },
];

export default photosPreset;
