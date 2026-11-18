import Decimal from 'decimal.js';
import type { CompareOptions, ComparisonPreviewRow, DataRow, Dataset, DuplicateGroup, FieldPair, ReconciliationResult, Scalar } from './types.js';

Decimal.set({ precision: 80, rounding: Decimal.ROUND_HALF_EVEN });

export const COMPARISON_PREVIEW_LIMIT = 50;
const DISPLAY_KEY_LIMIT = 240;

type KeyOptions = Required<Pick<CompareOptions, 'trimWhitespace' | 'caseSensitiveKeys'>>;

function normalized(value: Scalar, trim: boolean, caseSensitive: boolean): string {
  if (value === null) return 'null:';
  let text = String(value).normalize('NFKC');
  if (trim) text = text.trim();
  if (!caseSensitive) text = text.toLocaleLowerCase('en-US');
  return `value:${text}`;
}

function keyOf(row: DataRow, pairs: FieldPair[], side: 'left' | 'right', options: KeyOptions): string {
  return JSON.stringify(pairs.map((pair) => normalized(row[side === 'left' ? pair.left : pair.right] ?? null, options.trimWhitespace, options.caseSensitiveKeys)));
}

function keyDisplay(row: DataRow, pairs: FieldPair[], side: 'left' | 'right'): Record<string, Scalar> {
  return Object.fromEntries(pairs.map((pair) => {
    const column = side === 'left' ? pair.left : pair.right;
    return [column, row[column] ?? null];
  }));
}

function displayKey(key: Record<string, Scalar>): string {
  const text = JSON.stringify(key);
  return text.length > DISPLAY_KEY_LIMIT ? `${text.slice(0, DISPLAY_KEY_LIMIT - 1)}…` : text;
}

function markdownCell(value: unknown, maximum = 140): string {
  if (value === undefined) return '—';
  let text: string;
  try { text = typeof value === 'string' ? value : JSON.stringify(value) ?? String(value); }
  catch { text = String(value); }
  text = text.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (text.length > maximum) text = `${text.slice(0, maximum - 1)}…`;
  if (!text) return '—';
  let longestBacktickRun = 0;
  for (const run of text.matchAll(/`+/g)) longestBacktickRun = Math.max(longestBacktickRun, run[0]?.length ?? 0);
  const delimiter = '`'.repeat(longestBacktickRun + 1);
  const padding = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  const body = text.replaceAll('|', '\\|');
  return `${delimiter}${padding}${body}${padding}${delimiter}`;
}

interface RowGroup {
  first: DataRow;
  count: number;
  duplicates?: DataRow[];
}

type RowIndex = Map<string, RowGroup>;

function groups(dataset: Dataset, pairs: FieldPair[], side: 'left' | 'right', options: KeyOptions): RowIndex {
  const map: RowIndex = new Map();
  for (const row of dataset.rows) {
    const key = keyOf(row, pairs, side, options);
    const found = map.get(key);
    if (found) {
      if (found.count === 1) found.duplicates = [found.first, row];
      else found.duplicates?.push(row);
      found.count += 1;
    } else {
      map.set(key, { first: row, count: 1 });
    }
  }
  return map;
}

function duplicateGroups(index: RowIndex, pairs: FieldPair[], side: 'left' | 'right'): DuplicateGroup[] {
  const results: DuplicateGroup[] = [];
  for (const group of index.values()) {
    if (group.count < 2) continue;
    results.push({
      key: keyDisplay(group.first, pairs, side),
      count: group.count,
      records: group.duplicates ?? [group.first],
    });
  }
  return results;
}

function appendGroupRows(target: DataRow[], group: RowGroup): void {
  if (group.duplicates) target.push(...group.duplicates);
  else target.push(group.first);
}

function numeric(value: Scalar): Decimal | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value).trim();
  if (text.length === 0 || text.length > 48 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
  try {
    const result = new Decimal(text);
    return result.isFinite() ? result : null;
  } catch {
    return null;
  }
}

function valuesEqual(left: Scalar, right: Scalar, tolerance: Decimal, trimWhitespace: boolean, caseSensitiveValues: boolean): boolean {
  const leftNumber = numeric(left);
  const rightNumber = numeric(right);
  if (leftNumber && rightNumber) return leftNumber.minus(rightNumber).abs().lte(tolerance);
  return normalized(left, trimWhitespace, caseSensitiveValues) === normalized(right, trimWhitespace, caseSensitiveValues);
}

function markdown(result: Omit<ReconciliationResult, 'markdown'>): string {
  const { summary, schema } = result;
  const hasIssues = summary.valueMismatches + summary.missingOnLeft + summary.missingOnRight
    + summary.duplicateKeysOnLeft + summary.duplicateKeysOnRight + summary.schemaIssues > 0;
  const lines = [
    '# Reconciliation result',
    '',
    `**${hasIssues ? 'Review differences' : 'All compared values match'}** · ${markdownCell(summary.leftSource, 80)} ↔ ${markdownCell(summary.rightSource, 80)}`,
    '',
    '| Metric | Result |',
    '|:--|--:|',
    `| Rows · A / B | ${summary.leftRows.toLocaleString()} / ${summary.rightRows.toLocaleString()} |`,
    `| Shared unique keys | ${summary.matchedKeys.toLocaleString()} |`,
    `| Exact matches | ${summary.matchedRows.toLocaleString()} |`,
    `| Rows with value differences | ${summary.mismatchedRows.toLocaleString()} |`,
    `| Only in A / B | ${summary.missingOnRight.toLocaleString()} / ${summary.missingOnLeft.toLocaleString()} |`,
    `| Duplicate keys · A / B | ${summary.duplicateKeysOnLeft.toLocaleString()} / ${summary.duplicateKeysOnRight.toLocaleString()} |`,
    `| Value mismatches | ${summary.valueMismatches.toLocaleString()} |`,
    `| Schema differences | ${summary.schemaIssues.toLocaleString()} |`,
  ];

  if (result.mismatches.length > 0) {
    lines.push('', `## Value differences · first ${Math.min(result.mismatches.length, 12)} of ${result.mismatches.length}`, '',
      '| Key | Field A | Value A | Field B | Value B |', '|:--|:--|:--|:--|:--|');
    for (const mismatch of result.mismatches.slice(0, 12)) {
      lines.push(`| ${markdownCell(mismatch.key)} | ${markdownCell(mismatch.leftField, 60)} | ${markdownCell(mismatch.leftValue)} | ${markdownCell(mismatch.rightField, 60)} | ${markdownCell(mismatch.rightValue)} |`);
    }
  }

  const missingA = result.missing.onlyOnLeft.slice(0, 5);
  const missingB = result.missing.onlyOnRight.slice(0, 5);
  if (result.missing.onlyOnLeft.length + result.missing.onlyOnRight.length > 0) {
    lines.push('', '## Missing records', '', '| Source | Record sample |', '|:--|:--|');
    for (const row of missingA) lines.push(`| A only | ${markdownCell(row, 220)} |`);
    for (const row of missingB) lines.push(`| B only | ${markdownCell(row, 220)} |`);
    if (result.missing.onlyOnLeft.length > 5 || result.missing.onlyOnRight.length > 5) lines.push('', 'Additional records are available in the structured result and CSV report.');
  }

  const duplicates = [
    ...result.duplicates.left.slice(0, 5).map((group) => ({ source: 'A', key: group.key, count: group.count })),
    ...result.duplicates.right.slice(0, 5).map((group) => ({ source: 'B', key: group.key, count: group.count })),
  ];
  if (summary.duplicateKeysOnLeft + summary.duplicateKeysOnRight > 0) {
    lines.push('', '## Duplicate keys · sample', '', '| Source | Key | Rows |', '|:--|:--|--:|');
    for (const group of duplicates) lines.push(`| ${group.source} | ${markdownCell(group.key)} | ${group.count} |`);
  }

  if (summary.schemaIssues > 0) {
    lines.push('', '## Schema differences', '', '| A only | B only |', '|:--|:--|');
    const fields = Math.max(schema.onlyOnLeft.length, schema.onlyOnRight.length);
    for (let index = 0; index < fields; index += 1) {
      lines.push(`| ${markdownCell(schema.onlyOnLeft[index])} | ${markdownCell(schema.onlyOnRight[index])} |`);
    }
  }

  if (result.previewTruncated) lines.push('', `> The comparison preview is limited to ${COMPARISON_PREVIEW_LIMIT} key groups. Full difference data is available in the structured result and CSV report.`);
  lines.push('', '> Data is processed in memory for this request and is not written to application storage. Hosting-provider infrastructure logs may be outside the application’s control.');
  return lines.join('\n');
}

function ensureColumns(dataset: Dataset, pairs: FieldPair[], side: 'left' | 'right', label: string): void {
  const names = new Set(dataset.columns);
  const missing = pairs.map((pair) => pair[side]).filter((column) => !names.has(column));
  if (missing.length > 0) throw new Error(`${label} kaynağında eşlenen alan bulunamadı.`);
}

export function compareDatasets(left: Dataset, right: Dataset, input: CompareOptions): ReconciliationResult {
  if (left.rows.length > 10_000 || right.rows.length > 10_000 || left.columns.length > 100 || right.columns.length > 100) {
    throw new Error('Kaynak, izin verilen satır veya sütun sınırını aşıyor.');
  }
  const options = {
    trimWhitespace: input.trimWhitespace ?? true,
    caseSensitiveKeys: input.caseSensitiveKeys ?? true,
    caseSensitiveValues: input.caseSensitiveValues ?? true,
  };
  ensureColumns(left, input.keyPairs, 'left', 'Sol');
  ensureColumns(right, input.keyPairs, 'right', 'Sağ');

  const leftKeys = new Set(input.keyPairs.map((pair) => pair.left));
  const rightKeys = new Set(input.keyPairs.map((pair) => pair.right));
  const fieldPairs = input.fieldPairs ?? left.columns
    .filter((column) => right.columns.includes(column) && !leftKeys.has(column) && !rightKeys.has(column))
    .map((column) => ({ left: column, right: column }));
  ensureColumns(left, fieldPairs, 'left', 'Sol');
  ensureColumns(right, fieldPairs, 'right', 'Sağ');

  const leftIndex = groups(left, input.keyPairs, 'left', options);
  const rightIndex = groups(right, input.keyPairs, 'right', options);
  const leftDuplicates = duplicateGroups(leftIndex, input.keyPairs, 'left');
  const rightDuplicates = duplicateGroups(rightIndex, input.keyPairs, 'right');
  const onlyOnLeft: DataRow[] = [];
  const onlyOnRight: DataRow[] = [];
  for (const [key, group] of leftIndex) if (!rightIndex.has(key)) appendGroupRows(onlyOnLeft, group);
  for (const [key, group] of rightIndex) if (!leftIndex.has(key)) appendGroupRows(onlyOnRight, group);

  const tolerance = new Decimal(input.tolerance ?? '0');
  const mismatches: ReconciliationResult['mismatches'] = [];
  const mismatchesByKey = new Map<string, number>();
  let matchedKeys = 0;
  let matchedRows = 0;
  let mismatchedRows = 0;
  for (const [key, leftGroup] of leftIndex) {
    const rightGroup = rightIndex.get(key);
    if (!rightGroup || leftGroup.count !== 1 || rightGroup.count !== 1) continue;
    const leftRow = leftGroup.first;
    const rightRow = rightGroup.first;
    matchedKeys += 1;
    let rowMismatches = 0;
    for (const pair of fieldPairs) {
      const leftValue = leftRow[pair.left] ?? null;
      const rightValue = rightRow[pair.right] ?? null;
      if (valuesEqual(leftValue, rightValue, tolerance, options.trimWhitespace, options.caseSensitiveValues)) continue;
      mismatches.push({ key: keyDisplay(leftRow, input.keyPairs, 'left'), leftField: pair.left, rightField: pair.right, leftValue, rightValue });
      rowMismatches += 1;
    }
    if (rowMismatches === 0) matchedRows += 1;
    else {
      mismatchedRows += 1;
      mismatchesByKey.set(key, rowMismatches);
    }
  }

  // Keep only the bounded preview in memory; non-matches retain priority over matches.
  const issuePreview: ComparisonPreviewRow[] = [];
  const matchPreview: ComparisonPreviewRow[] = [];
  let previewGroupCount = 0;
  const addBoundedPreview = (row: ComparisonPreviewRow): void => {
    previewGroupCount += 1;
    const target = row.status === 'match' ? matchPreview : issuePreview;
    if (target.length < COMPARISON_PREVIEW_LIMIT) target.push(row);
  };
  for (const [key, leftGroup] of leftIndex) {
    const rightGroup = rightIndex.get(key);
    const display = displayKey(keyDisplay(leftGroup.first, input.keyPairs, 'left'));
    if (!rightGroup) {
      addBoundedPreview({ key: display, status: leftGroup.count > 1 ? 'duplicate' : 'only_left', leftRows: leftGroup.count, rightRows: 0, mismatchFields: 0 });
    } else if (leftGroup.count > 1 || rightGroup.count > 1) {
      addBoundedPreview({ key: display, status: 'duplicate', leftRows: leftGroup.count, rightRows: rightGroup.count, mismatchFields: 0 });
    } else {
      const mismatchFields = mismatchesByKey.get(key) ?? 0;
      addBoundedPreview({ key: display, status: mismatchFields > 0 ? 'mismatch' : 'match', leftRows: 1, rightRows: 1, mismatchFields });
    }
  }
  for (const [key, rightGroup] of rightIndex) {
    if (leftIndex.has(key)) continue;
    addBoundedPreview({
      key: displayKey(keyDisplay(rightGroup.first, input.keyPairs, 'right')),
      status: rightGroup.count > 1 ? 'duplicate' : 'only_right',
      leftRows: 0,
      rightRows: rightGroup.count,
      mismatchFields: 0,
    });
  }
  const comparisonPreview = [...issuePreview, ...matchPreview].slice(0, COMPARISON_PREVIEW_LIMIT);
  const leftColumnSet = new Set(left.columns);
  const rightColumnSet = new Set(right.columns);
  const schema = {
    leftColumns: left.columns,
    rightColumns: right.columns,
    onlyOnLeft: left.columns.filter((column) => !rightColumnSet.has(column)),
    onlyOnRight: right.columns.filter((column) => !leftColumnSet.has(column)),
  };
  const partial = {
    summary: {
      leftSource: left.name,
      rightSource: right.name,
      leftRows: left.rows.length,
      rightRows: right.rows.length,
      matchedKeys,
      matchedRows,
      mismatchedRows,
      missingOnLeft: onlyOnRight.length,
      missingOnRight: onlyOnLeft.length,
      duplicateKeysOnLeft: leftDuplicates.length,
      duplicateKeysOnRight: rightDuplicates.length,
      valueMismatches: mismatches.length,
      schemaIssues: schema.onlyOnLeft.length + schema.onlyOnRight.length,
    },
    schema,
    missing: { onlyOnLeft, onlyOnRight },
    duplicates: { left: leftDuplicates, right: rightDuplicates },
    mismatches,
    comparisonPreview,
    previewTruncated: previewGroupCount > COMPARISON_PREVIEW_LIMIT,
  };
  return { ...partial, markdown: markdown(partial) };
}

export function assertResponseSize(value: unknown, maximumBytes = 2 * 1024 * 1024): void {
  const size = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (size > maximumBytes) throw new Error('Sonuç 2 MB API yanıt sınırını aşıyor. Eşleme alanlarını daraltıp yeniden deneyin; veri kırpılmadı.');
}

export function scalarToCsv(value: Scalar): string {
  const text = value === null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
