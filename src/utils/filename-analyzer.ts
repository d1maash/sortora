/**
 * Smart filename analyzer for creating meaningful folder structures
 */

export interface FilenameAnalysis {
  // Detected document type
  documentType?: string;
  // Extracted entity (company name, person name, project name)
  entity?: string;
  // Extracted date components
  year?: number;
  month?: number;
  // Keywords found in filename
  keywords: string[];
  // Suggested folder path
  suggestedFolder: string;
  // For code files
  language?: string;
  codeType?: 'component' | 'config' | 'util' | 'test' | 'style' | 'doc' | 'data' | 'script';
}

// Document type patterns (Russian and English)
const documentPatterns: Record<string, RegExp[]> = {
  contract: [
    /договор/i, /контракт/i, /соглашени/i,
    /contract/i, /agreement/i,
  ],
  invoice: [
    /счёт/i, /счет/i, /инвойс/i, /оплат/i,
    /invoice/i, /bill/i, /payment/i,
  ],
  receipt: [
    /чек/i, /квитанци/i, /receipt/i,
  ],
  resume: [
    /резюме/i, /cv/i, /resume/i, /curriculum/i,
  ],
  report: [
    /отчёт/i, /отчет/i, /report/i, /анализ/i, /analysis/i,
  ],
  presentation: [
    /презентаци/i, /presentation/i, /слайд/i, /slide/i,
  ],
  letter: [
    /письмо/i, /letter/i, /заявлени/i, /application/i,
  ],
  certificate: [
    /сертификат/i, /certificate/i, /диплом/i, /diploma/i, /лицензи/i, /license/i,
  ],
  manual: [
    /инструкци/i, /руководств/i, /manual/i, /guide/i, /tutorial/i,
  ],
  proposal: [
    /предложени/i, /proposal/i, /коммерческ/i, /commercial/i,
  ],
  act: [
    /акт/i, /act/i, /протокол/i, /protocol/i,
  ],
  order: [
    /заказ/i, /order/i, /приказ/i,
  ],
  screenshot: [
    /снимок/i, /screenshot/i, /screen shot/i, /capture/i, /скриншот/i,
  ],
  photo: [
    /фото/i, /photo/i, /img_/i, /dsc_/i, /image/i,
  ],
};

// Patterns to extract entity names (company, person, project)
const entityPatterns = [
  // "ИП Name" - extract just the name after ИП (1-3 words)
  /(?:ип|ооо|оао|зао|пао)\s+[«"]?([А-ЯЁа-яёA-Za-z]+(?:\s+[А-ЯЁа-яёA-Za-z]+){0,2})[»"]?/i,
  // "Company Name Inc/LLC/Ltd"
  /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\s+(?:Inc|LLC|Ltd|Corp|GmbH|AG)/i,
  // "Name-Name-Type" pattern (like Dinmukhanbet-Aizharykov-Resume) - extract first 2 parts
  /^([A-Z][a-z]+[-_][A-Z][a-z]+)[-_](?:resume|cv|договор|контракт|contract)/i,
  // Name with underscore separator for invoices/docs
  /(?:invoice|счет|счёт|contract|договор)[-_]([A-Za-zА-Яа-яЁё]+(?:[-_][A-Za-zА-Яа-яЁё]+)?)/i,
  // Project names in brackets
  /\[([^\]]+)\]/,
  /\(([^)]+)\)/,
];

// Programming language by extension
const languageByExtension: Record<string, string> = {
  js: 'JavaScript',
  jsx: 'React',
  ts: 'TypeScript',
  tsx: 'React TypeScript',
  py: 'Python',
  rb: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  scala: 'Scala',
  cpp: 'C++',
  c: 'C',
  cs: 'C#',
  php: 'PHP',
  swift: 'Swift',
  vue: 'Vue',
  svelte: 'Svelte',
  sql: 'SQL',
  sh: 'Shell',
  bash: 'Bash',
  ps1: 'PowerShell',
};

// Code file type patterns
const codeTypePatterns: Record<string, RegExp[]> = {
  component: [
    /component/i, /\.component\./i, /^[A-Z][a-z]+\./, // PascalCase = component
    /\.vue$/, /\.svelte$/, /\.jsx$/, /\.tsx$/,
  ],
  config: [
    /config/i, /\.config\./i, /settings/i, /\.rc$/i,
    /webpack/, /vite/, /rollup/, /babel/, /eslint/, /prettier/,
    /tsconfig/, /package\.json/, /docker-compose/, /dockerfile/i,
    /\.env/, /\.yaml$/, /\.yml$/, /\.toml$/,
  ],
  util: [
    /util/i, /helper/i, /lib/i, /common/i, /shared/i,
  ],
  test: [
    /\.test\./i, /\.spec\./i, /_test\./i, /test_/i,
    /\.test$/i, /\.spec$/i,
  ],
  style: [
    /\.css$/, /\.scss$/, /\.sass$/, /\.less$/, /\.styl$/,
    /style/i, /theme/i,
  ],
  doc: [
    /readme/i, /changelog/i, /license/i, /contributing/i,
    /\.md$/, /\.rst$/, /\.txt$/,
  ],
  data: [
    /schema/i, /migration/i, /seed/i, /fixture/i,
    /\.sql$/, /\.json$/, /data/i,
  ],
  script: [
    /script/i, /\.sh$/, /\.bash$/, /\.ps1$/, /\.bat$/,
    /build/i, /deploy/i, /install/i,
  ],
};

// Date patterns
const datePatterns = [
  // 2025-01-15 or 2025_01_15
  /\b(20\d{2})[-_]?(0[1-9]|1[0-2])[-_]?(0[1-9]|[12]\d|3[01])\b/,
  // 15.01.2025 or 15-01-2025
  /\b(0[1-9]|[12]\d|3[01])[-\.](0[1-9]|1[0-2])[-\.](20\d{2})\b/,
  // Just year
  /\b(20\d{2})\b/,
  // Month-Year like "январь 2025" or "January 2025"
  /\b(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр|january|february|march|april|may|june|july|august|september|october|november|december)[а-я]*\s*(20\d{2})\b/i,
];

/**
 * Analyze a filename and extract meaningful information
 */
export function analyzeFilename(filename: string): FilenameAnalysis {
  const analysis: FilenameAnalysis = {
    keywords: [],
    suggestedFolder: 'Other',
  };

  // Remove extension for analysis
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  const extension = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : '';

  // Check if it's a code file first
  if (extension && languageByExtension[extension]) {
    analysis.language = languageByExtension[extension];

    // Detect code type
    for (const [codeType, patterns] of Object.entries(codeTypePatterns)) {
      if (patterns.some(p => p.test(filename))) {
        analysis.codeType = codeType as FilenameAnalysis['codeType'];
        break;
      }
    }

    // Build code folder path
    analysis.suggestedFolder = buildCodeFolderPath(analysis, filename);
    return analysis;
  }

  // Detect document type
  for (const [docType, patterns] of Object.entries(documentPatterns)) {
    if (patterns.some(p => p.test(nameWithoutExt))) {
      analysis.documentType = docType;
      break;
    }
  }

  // Extract entity (company/person/project name)
  for (const pattern of entityPatterns) {
    const match = nameWithoutExt.match(pattern);
    if (match && match[1]) {
      // Clean up the entity name
      let entity = match[1].trim();
      // Remove common suffixes
      entity = entity.replace(/[-_](resume|cv|договор|контракт|contract|invoice|счет|счёт)$/i, '');
      // Capitalize properly
      entity = entity.split(/[-_\s]+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

      if (entity.length > 2 && entity.length < 50) {
        analysis.entity = entity;
        break;
      }
    }
  }

  // Extract date
  for (const pattern of datePatterns) {
    const match = nameWithoutExt.match(pattern);
    if (match) {
      // Different patterns have year in different positions
      if (match[3] && /^20\d{2}$/.test(match[3])) {
        // DD-MM-YYYY format
        analysis.year = parseInt(match[3]);
        analysis.month = parseInt(match[2]);
      } else if (match[1] && /^20\d{2}$/.test(match[1])) {
        // YYYY-MM-DD or just YYYY
        analysis.year = parseInt(match[1]);
        if (match[2]) {
          analysis.month = parseInt(match[2]);
        }
      } else if (match[2] && /^20\d{2}$/.test(match[2])) {
        // Month-name YYYY format
        analysis.year = parseInt(match[2]);
      }
      break;
    }
  }

  // Extract keywords from filename
  const words = nameWithoutExt
    .replace(/[_\-\.]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !/^(the|and|для|или|копия|copy|final|new|old|draft)$/i.test(w))
    .slice(0, 5);

  analysis.keywords = words;

  // Build suggested folder path
  analysis.suggestedFolder = buildFolderPath(analysis);

  return analysis;
}

/**
 * Build a folder path for code files
 */
function buildCodeFolderPath(analysis: FilenameAnalysis, _filename: string): string {
  const parts: string[] = ['Code'];

  // Group by language or framework
  if (analysis.language) {
    // Special handling for frameworks
    if (analysis.language.includes('React')) {
      parts.push('React');
    } else if (analysis.language === 'Vue') {
      parts.push('Vue');
    } else if (analysis.language === 'Svelte') {
      parts.push('Svelte');
    } else {
      parts.push(analysis.language);
    }
  }

  // Add code type subfolder
  if (analysis.codeType) {
    const typeToFolder: Record<string, string> = {
      component: 'Components',
      config: 'Config',
      util: 'Utils',
      test: 'Tests',
      style: 'Styles',
      doc: 'Docs',
      data: 'Data',
      script: 'Scripts',
    };
    parts.push(typeToFolder[analysis.codeType] || 'Src');
  }

  return parts.join('/');
}

/**
 * Build a folder path based on analysis
 */
function buildFolderPath(analysis: FilenameAnalysis): string {
  const parts: string[] = [];

  // Base folder by document type
  const typeToFolder: Record<string, string> = {
    contract: 'Contracts',
    invoice: 'Finance/Invoices',
    receipt: 'Finance/Receipts',
    resume: 'Documents/Resumes',
    report: 'Documents/Reports',
    presentation: 'Documents/Presentations',
    letter: 'Documents/Letters',
    certificate: 'Documents/Certificates',
    manual: 'Documents/Manuals',
    proposal: 'Documents/Proposals',
    act: 'Documents/Acts',
    order: 'Documents/Orders',
    screenshot: 'Screenshots',
    photo: 'Photos',
  };

  if (analysis.documentType) {
    parts.push(typeToFolder[analysis.documentType] || 'Documents');
  } else {
    parts.push('Documents');
  }

  // Add entity subfolder if found
  if (analysis.entity) {
    parts.push(sanitizeFolderName(analysis.entity));
  }

  // Add year subfolder for some document types
  if (analysis.year && ['contract', 'invoice', 'receipt', 'report', 'act'].includes(analysis.documentType || '')) {
    parts.push(analysis.year.toString());
  }

  // For screenshots, use year-month
  if (analysis.documentType === 'screenshot' && analysis.year) {
    const month = analysis.month?.toString().padStart(2, '0') || '01';
    parts.push(`${analysis.year}-${month}`);
  }

  return parts.join('/');
}

/**
 * Sanitize a string to be used as folder name
 */
function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
}

/**
 * Get a smart folder suggestion based on multiple files
 * Groups similar files together
 */
export function suggestGroupFolder(filenames: string[]): string | null {
  if (filenames.length < 2) return null;

  const analyses = filenames.map(f => analyzeFilename(f));

  // Check if all files have the same document type
  const types = [...new Set(analyses.map(a => a.documentType).filter(Boolean))];
  if (types.length === 1) {
    // Check if they share an entity
    const entities = [...new Set(analyses.map(a => a.entity).filter(Boolean))];
    if (entities.length === 1) {
      return `${types[0]}/${entities[0]}`;
    }
  }

  return null;
}

export default analyzeFilename;
