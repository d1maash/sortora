import type { ParsedRule } from '../parser.js';

export const documentsPreset: ParsedRule[] = [
  {
    name: 'Invoices and receipts',
    priority: 100,
    enabled: true,
    match: {
      extension: ['pdf'],
      filename: ['*invoice*', '*receipt*', '*счёт*', '*счет*', '*чек*'],
    },
    action: {
      moveTo: '{destinations.finance}/Invoices/{year}/',
    },
  },
  {
    name: 'Bank statements',
    priority: 100,
    enabled: true,
    match: {
      extension: ['pdf'],
      filename: ['*statement*', '*выписка*', '*bank*'],
    },
    action: {
      moveTo: '{destinations.finance}/Statements/{year}/',
    },
  },
  {
    name: 'Contracts',
    priority: 95,
    enabled: true,
    match: {
      extension: ['pdf', 'docx'],
      filename: ['*contract*', '*agreement*', '*договор*', '*NDA*'],
    },
    action: {
      moveTo: '{destinations.work}/Contracts/{year}/',
    },
  },
  {
    name: 'Tax documents',
    priority: 95,
    enabled: true,
    match: {
      extension: ['pdf'],
      filename: ['*tax*', '*налог*', '*W-2*', '*1099*'],
    },
    action: {
      moveTo: '{destinations.finance}/Tax/{year}/',
    },
  },
  {
    name: 'Resumes and CVs',
    priority: 90,
    enabled: true,
    match: {
      extension: ['pdf', 'docx'],
      filename: ['*resume*', '*CV*', '*резюме*'],
    },
    action: {
      moveTo: '{destinations.documents}/Career/',
    },
  },
  {
    name: 'Reports',
    priority: 85,
    enabled: true,
    match: {
      extension: ['pdf', 'docx', 'xlsx'],
      filename: ['*report*', '*отчёт*', '*отчет*'],
    },
    action: {
      suggestTo: '{destinations.work}/Reports/{year}/',
    },
  },
  {
    name: 'Presentations',
    priority: 85,
    enabled: true,
    match: {
      extension: ['pptx', 'ppt', 'key', 'odp'],
    },
    action: {
      suggestTo: '{destinations.documents}/Presentations/{year}/',
    },
  },
  {
    name: 'Spreadsheets',
    priority: 80,
    enabled: true,
    match: {
      extension: ['xlsx', 'xls', 'csv', 'ods', 'numbers'],
    },
    action: {
      suggestTo: '{destinations.documents}/Spreadsheets/{year}/',
    },
  },
  {
    name: 'Text documents',
    priority: 75,
    enabled: true,
    match: {
      extension: ['docx', 'doc', 'odt', 'rtf'],
    },
    action: {
      suggestTo: '{destinations.documents}/{year}/',
    },
  },
  {
    name: 'Markdown and text',
    priority: 70,
    enabled: true,
    match: {
      extension: ['md', 'txt', 'rst'],
    },
    action: {
      suggestTo: '{destinations.documents}/Notes/',
    },
  },
  {
    name: 'Ebooks',
    priority: 85,
    enabled: true,
    match: {
      extension: ['epub', 'mobi', 'azw3', 'fb2', 'djvu'],
    },
    action: {
      moveTo: '{destinations.documents}/Books/',
    },
  },
  {
    name: 'Manuals and guides',
    priority: 80,
    enabled: true,
    match: {
      extension: ['pdf'],
      filename: ['*manual*', '*guide*', '*руководство*', '*инструкция*'],
    },
    action: {
      moveTo: '{destinations.documents}/Manuals/',
    },
  },
];

export default documentsPreset;
