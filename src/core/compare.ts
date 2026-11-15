import Decimal from 'decimal.js';
import type { CompareOptions, DataRow, Dataset, DuplicateGroup, FieldPair, ReconciliationResult, Scalar } from './types.js';

Decimal.set({ precision: 80, rounding: Decimal.ROUND_HALF_EVEN });

function normalized(value: Scalar, trim: boolean, caseSensitive: boolean): string {
  if (value === null) return 'null:';
  let text = String(value).normalize('NFKC');
  if (trim) text = text.trim();
  if (!caseSensitive) text = text.toLocaleLowerCase('en-US');
  return `value:${text}`;
}

function keyOf(row: DataRow, pairs: FieldPair[], side: 'left' | 'right', options: Required<Pick<CompareOptions, 'trimWhitespace' | 'caseSensitiveKeys'>>): string {
  return JSON.stringify(pairs.map((pair) => normalized(row[side === 'left' ? pair.left : pair.right] ?? null, options.trimWhitespace, options.caseSensitiveKeys)));
}

function keyDisplay(row: DataRow, pairs: FieldPair[], side: 'left' | 'right'): Record<string, Scalar> {
  return Object.fromEntries(pairs.map((pair) => {
    const column = side === 'left' ? pair.left : pair.right;
    return [column, row[column] ?? null];
  }));
}

function groups(dataset: Dataset, pairs: FieldPair[], side: 'left' | 'right', options: Required<Pick<CompareOptions, 'trimWhitespace' | 'caseSensitiveKeys'>>): Map<string, DataRow[]> {
  const map = new Map<string, DataRow[]>();
  for (const row of dataset.rows) {
    const key = keyOf(row, pairs, side, options);
    const found = map.get(key);
    if (found) found.push(row);
    else map.set(key, [row]);
  }
  return map;
}

function duplicateGroups(index: Map<string, DataRow[]>, pairs: FieldPair[], side: 'left' | 'right'): DuplicateGroup[] {
  const results: DuplicateGroup[] = [];
  for (const rows of index.values()) {
    if (rows.length < 2) continue;
    const first = rows[0];
    if (!first) continue;
    results.push({ key: keyDisplay(first, pairs, side), count: rows.length, records: rows });
  }
  return results;
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

function valuesEqual(left: Scalar, right: Scalar, tolerance: Decimal, trimWhitespace: boolean): boolean {
  const leftNumber = numeric(left);
  const rightNumber = numeric(right);
  if (leftNumber && rightNumber) return leftNumber.minus(rightNumber).abs().lte(tolerance);
  return normalized(left, trimWhitespace, true) === normalized(right, trimWhitespace, true);
}

function markdown(result: Omit<ReconciliationResult, 'markdown'>): string {
  const { summary, schema } = result;
  const lines = [
    '# Mutabakat özeti',
    '',
    `- Kaynaklar: ${summary.leftSource} ↔ ${summary.rightSource}`,
    `- Satırlar: ${summary.leftRows} ↔ ${summary.rightRows}`,
    `- Yalnız sol kaynakta: ${summary.missingOnRight}`,
    `- Yalnız sağ kaynakta: ${summary.missingOnLeft}`,
    `- Yinelenen anahtarlar: ${summary.duplicateKeysOnLeft} (sol), ${summary.duplicateKeysOnRight} (sağ)`,
    `- Değer uyuşmazlıkları: ${summary.valueMismatches}`,
    `- Şema tutarsızlıkları: ${summary.schemaIssues}`,
    '',
    `Sol kaynakta olup sağda olmayan alanlar: ${schema.onlyOnLeft.join(', ') || 'yok'}`,
    `Sağ kaynakta olup solda olmayan alanlar: ${schema.onlyOnRight.join(', ') || 'yok'}`,
    '',
    'Veri yalnızca bu isteğin belleğinde işlendi; uygulama veritabanına veya kalıcı dosya alanına yazılmadı. Altyapı sağlayıcı günlükleri bu uygulamanın denetimi dışındadır.',
  ];
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
  for (const [key, rows] of leftIndex) if (!rightIndex.has(key)) onlyOnLeft.push(...rows);
  for (const [key, rows] of rightIndex) if (!leftIndex.has(key)) onlyOnRight.push(...rows);

  const tolerance = new Decimal(input.tolerance ?? '0');
  const mismatches: ReconciliationResult['mismatches'] = [];
  for (const [key, leftRows] of leftIndex) {
    const rightRows = rightIndex.get(key);
    if (!rightRows || leftRows.length !== 1 || rightRows.length !== 1) continue;
    const leftRow = leftRows[0];
    const rightRow = rightRows[0];
    if (!leftRow || !rightRow) continue;
    for (const pair of fieldPairs) {
      const leftValue = leftRow[pair.left] ?? null;
      const rightValue = rightRow[pair.right] ?? null;
      if (valuesEqual(leftValue, rightValue, tolerance, options.trimWhitespace)) continue;
      mismatches.push({ key: keyDisplay(leftRow, input.keyPairs, 'left'), leftField: pair.left, rightField: pair.right, leftValue, rightValue });
    }
  }

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
