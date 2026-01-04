import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import xxhash from 'xxhash-wasm';

let xxhashInstance: Awaited<ReturnType<typeof xxhash>> | null = null;

async function getXXHash() {
  if (!xxhashInstance) {
    xxhashInstance = await xxhash();
  }
  return xxhashInstance;
}

export async function hashFile(filePath: string): Promise<string> {
  const { h64 } = await getXXHash();
  const hasher = h64();

  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);

    stream.on('data', (chunk: Buffer) => {
      hasher.update(chunk);
    });

    stream.on('end', () => {
      resolve(hasher.digest().toString(16).padStart(16, '0'));
    });

    stream.on('error', reject);
  });
}

export async function hashFileQuick(filePath: string, sampleSize = 65536): Promise<string> {
  const { h64 } = await getXXHash();
  const hasher = h64();

  const fileStats = await stat(filePath);
  const fileSize = fileStats.size;

  // For small files, hash the entire file
  if (fileSize <= sampleSize * 3) {
    return hashFile(filePath);
  }

  // Sample beginning, middle, and end
  const samples: { start: number; size: number }[] = [
    { start: 0, size: sampleSize },
    { start: Math.floor(fileSize / 2) - sampleSize / 2, size: sampleSize },
    { start: fileSize - sampleSize, size: sampleSize },
  ];

  // Include file size in hash for better uniqueness
  hasher.update(Buffer.from(fileSize.toString()));

  for (const sample of samples) {
    const chunk = await readChunk(filePath, sample.start, sample.size);
    hasher.update(chunk);
  }

  return hasher.digest().toString(16).padStart(16, '0');
}

async function readChunk(filePath: string, start: number, size: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath, { start, end: start + size - 1 });

    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    stream.on('error', reject);
  });
}

export async function hashString(str: string): Promise<string> {
  const { h64 } = await getXXHash();
  const hasher = h64();
  hasher.update(Buffer.from(str));
  return hasher.digest().toString(16).padStart(16, '0');
}

export async function hashBuffer(buffer: Buffer): Promise<string> {
  const { h64 } = await getXXHash();
  const hasher = h64();
  hasher.update(buffer);
  return hasher.digest().toString(16).padStart(16, '0');
}

export function areHashesEqual(hash1: string, hash2: string): boolean {
  return hash1.toLowerCase() === hash2.toLowerCase();
}
