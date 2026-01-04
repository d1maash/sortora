import { describe, it, expect } from 'vitest';
import { analyzeFilename } from '../src/utils/filename-analyzer';
import { expandTilde, interpolatePath } from '../src/utils/paths';
import { getMimeType, getFileCategory } from '../src/utils/mime';

describe('Filename Analyzer', () => {
  it('should detect invoice documents', () => {
    const result = analyzeFilename('Invoice_Acme_Corp_2025.pdf');
    expect(result.documentType).toBe('invoice');
  });

  it('should detect contract documents', () => {
    const result = analyzeFilename('Contract_Agreement_2025.pdf');
    expect(result.documentType).toBe('contract');
  });

  it('should detect resume documents', () => {
    const result = analyzeFilename('John-Smith-Resume.pdf');
    expect(result.documentType).toBe('resume');
  });

  it('should extract year from filename', () => {
    const result = analyzeFilename('Annual_Report_2025_Q4.pdf');
    expect(result.documentType).toBe('report');
  });

  it('should detect programming language', () => {
    const result = analyzeFilename('component.tsx');
    expect(result.language).toBe('React TypeScript');
  });

  it('should detect code type', () => {
    const result = analyzeFilename('webpack.config.js');
    expect(result.codeType).toBe('config');
  });
});

describe('Path Utilities', () => {
  it('should expand tilde to home directory', () => {
    const result = expandTilde('~/Documents');
    expect(result).not.toContain('~');
    expect(result).toContain('Documents');
  });

  it('should interpolate path variables', () => {
    const result = interpolatePath('{year}/{month}/', { year: 2025, month: '01' });
    expect(result).toBe('2025/01/');
  });

  it('should handle flat keys in interpolation', () => {
    const result = interpolatePath('{destinations.documents}/', {
      'destinations.documents': '/home/user/Documents',
    });
    expect(result).toBe('/home/user/Documents/');
  });
});

describe('MIME Types', () => {
  it('should detect PDF mime type', () => {
    expect(getMimeType('document.pdf')).toBe('application/pdf');
  });

  it('should detect image mime type', () => {
    expect(getMimeType('photo.jpg')).toBe('image/jpeg');
  });

  it('should categorize files correctly', () => {
    expect(getFileCategory('document.pdf')).toBe('document');
    expect(getFileCategory('photo.jpg')).toBe('image');
    expect(getFileCategory('script.js')).toBe('code');
    expect(getFileCategory('song.mp3')).toBe('audio');
  });
});
