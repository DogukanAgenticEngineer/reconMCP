import type { ComparisonPreviewRow, ComparisonStatus, ReconciliationResult, Scalar } from '../core/types.js';
import { canonicalColumnName, inferFieldPairs } from '../core/matching.js';

export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_COMBINED_BYTES = Math.floor(4.25 * 1024 * 1024);
export const MAX_SOURCES = 10;
export const MIN_SOURCES = 2;
const FIELD_PART_OVERHEAD = 512;
const FILE_PART_OVERHEAD = 1024;
const FINAL_BOUNDARY_OVERHEAD = 512;
export const ACCEPTED_FILES = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const PREVIEW_ROW_LIMIT = 50;
export const MAX_KEY_PAIRS = 10;
export const MAX_FIELD_PAIRS = 100;

export type Side = 'left' | 'right';
export type SourceFormat = 'csv' | 'xlsx';
export type ResultResponse = ReconciliationResult & { reportCsv: string };
export type Pair = { left: string; right: string };
export type PreviewStatusFilter = 'all' | ComparisonStatus;

export interface SourceUpload {
  file: File | null;
  columns: string[];
  rowCount: number | null;
  busy: boolean;
  error: string;
  dragging: boolean;
}

/** Array of SourceUpload for multi-source mode (2–10 sources). */
export type MultiSourceUpload = SourceUpload[];

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

export function commonFieldPairs(leftColumns: string[], rightColumns: string[]): Pair[] {
  return inferFieldPairs(leftColumns, rightColumns);
}

const PREFERRED_KEYS = [
  'id', 'uuid', 'key', 'recordid', 'invoiceid', 'transactionid', 'accountid', 'customerid', 'reference', 'ref', 'code',
];

export function chooseKeyPair(pairs: Pair[]): Pair | null {
  for (const preferred of PREFERRED_KEYS) {
    const pair = pairs.find(({ left }) => canonicalColumnName(left) === preferred);
    if (pair) return pair;
  }
  return pairs[0] ?? null;
}

export function isValidPairSelection(pairs: Pair[], leftColumns: string[], rightColumns: string[], maximum: number, minimum = 0): boolean {
  if (pairs.length < minimum || pairs.length > maximum) return false;
  const usedLeft = new Set<string>();
  const usedRight = new Set<string>();
  return pairs.every(({ left, right }) => {
    if (!leftColumns.includes(left) || !rightColumns.includes(right) || usedLeft.has(left) || usedRight.has(right)) return false;
    usedLeft.add(left);
    usedRight.add(right);
    return true;
  });
}

export function isValidTolerance(value: string): boolean {
  if (value === '') return true;
  return value.length <= 50 && /^\d{1,30}(?:\.\d{1,18})?$/.test(value);
}

export function estimateMultipartRequestBytes(
  fields: Array<{ name: string; value: string }>,
  files: Array<{ name: string; filename: string; size: number }>,
): number {
  const encoder = new TextEncoder();
  const fieldBytes = fields.reduce((total, field) => total + encoder.encode(field.name).byteLength + encoder.encode(field.value).byteLength + FIELD_PART_OVERHEAD, 0);
  const fileBytes = files.reduce((total, file) => total + Math.max(0, file.size) + encoder.encode(file.name).byteLength + (encoder.encode(file.filename).byteLength * 3) + FILE_PART_OVERHEAD, 0);
  return fieldBytes + fileBytes + FINAL_BOUNDARY_OVERHEAD;
}

/**
 * Estimate the multipart request size for multi-source (2–10 files) mode.
 * Each source sends a `fileSource_<n>` file part and a sources JSON field.
 */
export function estimateMultiSourceRequestBytes(
  sources: Array<{ name: string; size: number }>,
  extraFields: Array<{ name: string; value: string }> = [],
): number {
  const fileFields = sources.map((s, i) => ({ name: `fileSource_${i}`, filename: s.name, size: s.size }));
  const baseFields: Array<{ name: string; value: string }> = [
    { name: 'mode', value: 'multi-compare' },
    ...extraFields,
  ];
  return estimateMultipartRequestBytes(baseFields, fileFields);
}

export function filteredPreview(
  rows: ComparisonPreviewRow[],
  onlyDifferences: boolean,
  query = '',
  status: PreviewStatusFilter = 'all',
  searchTextByKey: ReadonlyMap<string, string> = new Map(),
): ComparisonPreviewRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('en-US');
  return rows.filter((row) => {
    if (onlyDifferences && row.status === 'match') return false;
    if (status !== 'all' && row.status !== status) return false;
    const searchableText = `${row.key} ${searchTextByKey.get(row.key) ?? ''}`;
    return !normalizedQuery || searchableText.toLocaleLowerCase('en-US').includes(normalizedQuery);
  });
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
