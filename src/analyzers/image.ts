import sharp from 'sharp';
import { readFile } from 'fs/promises';
import exifReader from 'exif-reader';

export interface ImageMetadata {
  width?: number;
  height?: number;
  format?: string;
  hasAlpha?: boolean;
  isAnimated?: boolean;
  colorSpace?: string;
  density?: number;

  // EXIF data
  dateTaken?: Date;
  camera?: string;
  lens?: string;
  iso?: number;
  aperture?: string;
  shutterSpeed?: string;
  focalLength?: string;
  gps?: {
    latitude: number;
    longitude: number;
  };
  orientation?: number;
}

export async function analyzeImage(filePath: string): Promise<ImageMetadata> {
  const metadata: ImageMetadata = {};

  try {
    const image = sharp(filePath);
    const info = await image.metadata();

    metadata.width = info.width;
    metadata.height = info.height;
    metadata.format = info.format;
    metadata.hasAlpha = info.hasAlpha;
    metadata.isAnimated = (info.pages ?? 1) > 1;
    metadata.colorSpace = info.space;
    metadata.density = info.density;
    metadata.orientation = info.orientation;

    // Parse EXIF data if present
    if (info.exif) {
      try {
        const exif = exifReader(info.exif);

        if (exif.Photo) {
          if (exif.Photo.DateTimeOriginal) {
            metadata.dateTaken = exif.Photo.DateTimeOriginal;
          }
          if (exif.Photo.ISOSpeedRatings) {
            metadata.iso = Array.isArray(exif.Photo.ISOSpeedRatings)
              ? exif.Photo.ISOSpeedRatings[0]
              : exif.Photo.ISOSpeedRatings;
          }
          if (exif.Photo.FNumber) {
            metadata.aperture = `f/${exif.Photo.FNumber}`;
          }
          if (exif.Photo.ExposureTime) {
            const time = exif.Photo.ExposureTime;
            if (time < 1) {
              metadata.shutterSpeed = `1/${Math.round(1 / time)}`;
            } else {
              metadata.shutterSpeed = `${time}s`;
            }
          }
          if (exif.Photo.FocalLength) {
            metadata.focalLength = `${exif.Photo.FocalLength}mm`;
          }
          if (exif.Photo.LensModel) {
            metadata.lens = exif.Photo.LensModel;
          }
        }

        if (exif.Image) {
          const make = exif.Image.Make || '';
          const model = exif.Image.Model || '';
          if (make || model) {
            metadata.camera = `${make} ${model}`.trim();
          }
        }

        if (exif.GPSInfo) {
          const lat = exif.GPSInfo.GPSLatitude;
          const lon = exif.GPSInfo.GPSLongitude;
          const latRef = exif.GPSInfo.GPSLatitudeRef;
          const lonRef = exif.GPSInfo.GPSLongitudeRef;

          if (lat && lon) {
            const latitude = convertGPSCoord(lat) * (latRef === 'S' ? -1 : 1);
            const longitude = convertGPSCoord(lon) * (lonRef === 'W' ? -1 : 1);

            if (!isNaN(latitude) && !isNaN(longitude)) {
              metadata.gps = { latitude, longitude };
            }
          }
        }
      } catch {
        // EXIF parsing failed, continue without it
      }
    }
  } catch {
    // Image analysis failed, return empty metadata
  }

  return metadata;
}

function convertGPSCoord(coord: number[]): number {
  if (!coord || coord.length < 3) return NaN;
  const [degrees, minutes, seconds] = coord;
  return degrees + minutes / 60 + seconds / 3600;
}

export function isScreenshot(filename: string, metadata: ImageMetadata): boolean {
  const screenshotPatterns = [
    /^screenshot/i,
    /^screen shot/i,
    /^capture/i,
    /^снимок/i,
    /^скриншот/i,
    /^bildschirmfoto/i,
    /^captura/i,
  ];

  if (screenshotPatterns.some(p => p.test(filename))) {
    return true;
  }

  // No EXIF and standard screen dimensions can indicate screenshot
  if (!metadata.dateTaken && !metadata.camera) {
    const screenSizes = [
      [1920, 1080], [2560, 1440], [3840, 2160],
      [1440, 900], [2880, 1800], [1680, 1050],
      [1280, 720], [1366, 768], [1536, 864],
    ];

    const { width, height } = metadata;
    if (width && height) {
      return screenSizes.some(([w, h]) =>
        (width === w && height === h) || (width === h && height === w)
      );
    }
  }

  return false;
}

export function getImageYear(metadata: ImageMetadata): number | null {
  if (metadata.dateTaken) {
    return metadata.dateTaken.getFullYear();
  }
  return null;
}

export function getImageMonth(metadata: ImageMetadata): number | null {
  if (metadata.dateTaken) {
    return metadata.dateTaken.getMonth() + 1;
  }
  return null;
}
