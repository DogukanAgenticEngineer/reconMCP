import type { ComparisonPreviewRow, ReconciliationResult, Scalar } from '../core/types.js';

export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_COMBINED_BYTES = Math.floor(4.25 * 1024 * 1024);
export const FORM_OVERHEAD_RESERVE = 4096;
export const ACCEPTED_FILES = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const PREVIEW_ROW_LIMIT = 50;

export type Side = 'left' | 'right';
export type SourceFormat = 'csv' | 'xlsx';
export type ResultResponse = ReconciliationResult & { reportCsv: string };

export interface SourceUpload {
  file: File | null;
  columns: string[];
  rowCount: number | null;
  busy: boolean;
  error: string;
  dragging: boolean;
}

export interface FieldPair {
  left: string;
  right: string;
}

export function emptyUpload(): SourceUpload {
  return { file: null, columns: [], rowCount: null, busy: false, error: '', dragging: false };
}

export function fileFormat(name: string): SourceFormat | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  return null;
}

export function normalizedColumnName(name: string): string {
  return name.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '');
}

export function commonFieldPairs(leftColumns: string[], rightColumns: string[]): FieldPair[] {
  const rightByNormalized = new Map<string, string>();
  for (const column of rightColumns) {
    const normalized = normalizedColumnName(column);
    if (normalized && !rightByNormalized.has(normalized)) rightByNormalized.set(normalized, column);
  }
  const usedRight = new Set<string>();
  const pairs: FieldPair[] = [];
  for (const left of leftColumns) {
    const normalized = normalizedColumnName(left);
    const right = rightByNormalized.get(normalized);
    if (!right || usedRight.has(right)) continue;
    usedRight.add(right);
    pairs.push({ left, right });
  }
  return pairs;
}

const PREFERRED_KEYS = [
  'id', 'uuid', 'key', 'recordid', 'invoiceid', 'transactionid', 'accountid', 'customerid', 'reference', 'ref', 'code',
];

export function chooseKeyPair(pairs: FieldPair[]): FieldPair | null {
  for (const preferred of PREFERRED_KEYS) {
    const pair = pairs.find(({ left }) => normalizedColumnName(left) === preferred);
    if (pair) return pair;
  }
  return pairs[0] ?? null;
}

export function filteredPreview(rows: ComparisonPreviewRow[], onlyDifferences: boolean): ComparisonPreviewRow[] {
  return onlyDifferences ? rows.filter((row) => row.status !== 'match') : rows;
}

export function displayScalar(value: Scalar | undefined): string {
  if (value === null || value === undefined) return '—';
  return typeof value === 'string' ? value : String(value);
}

export function shorten(value: string, maximum = 200): string {
  return value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value;
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

export function matchedRate(result: ReconciliationResult): number {
  return result.summary.matchedKeys === 0 ? 0 : (result.summary.matchedRows / result.summary.matchedKeys) * 100;
}
