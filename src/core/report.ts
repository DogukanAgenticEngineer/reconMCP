import type { ReconciliationResult, Scalar } from './types.js';

function neutralizeSpreadsheetFormula(text: string): string {
  const first = text.trimStart().charAt(0);
  return ['=', '+', '-', '@'].includes(first) ? `'${text}` : text;
}

function csvCell(value: Scalar | object): string {
  const text = value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const safeText = typeof value === 'string' ? neutralizeSpreadsheetFormula(text) : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function resultToCsv(result: ReconciliationResult): string {
  const rows: Array<Array<Scalar | object>> = [['category', 'key', 'field', 'left_value', 'right_value']];
  for (const row of result.missing.onlyOnLeft) rows.push(['missing_on_right', row, '', '', '']);
  for (const row of result.missing.onlyOnRight) rows.push(['missing_on_left', row, '', '', '']);
  for (const group of result.duplicates.left) rows.push(['duplicate_on_left', group.key, '', String(group.count), '']);
  for (const group of result.duplicates.right) rows.push(['duplicate_on_right', group.key, '', '', String(group.count)]);
  for (const mismatch of result.mismatches) rows.push(['value_mismatch', mismatch.key, `${mismatch.leftField} ↔ ${mismatch.rightField}`, mismatch.leftValue ?? '', mismatch.rightValue ?? '']);
  for (const field of result.schema.onlyOnLeft) rows.push(['schema_only_on_left', '', field, '', '']);
  for (const field of result.schema.onlyOnRight) rows.push(['schema_only_on_right', '', field, '', '']);
  return rows.map((row) => row.map((cell) => csvCell(cell)).join(',')).join('\r\n');
}
