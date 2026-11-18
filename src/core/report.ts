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
  const lines = ['"category","key","field","left_value","right_value"'];
  const append = (category: string, key: Scalar | object, field: Scalar, left: Scalar, right: Scalar): void => {
    lines.push([category, key, field, left, right].map(csvCell).join(','));
  };

  for (const row of result.missing.onlyOnLeft) append('missing_on_right', row, '', '', '');
  for (const row of result.missing.onlyOnRight) append('missing_on_left', row, '', '', '');
  for (const group of result.duplicates.left) append('duplicate_on_left', group.key, '', String(group.count), '');
  for (const group of result.duplicates.right) append('duplicate_on_right', group.key, '', '', String(group.count));
  for (const mismatch of result.mismatches) {
    append('value_mismatch', mismatch.key, `${mismatch.leftField} ↔ ${mismatch.rightField}`, mismatch.leftValue, mismatch.rightValue);
  }
  for (const field of result.schema.onlyOnLeft) append('schema_only_on_left', '', field, '', '');
  for (const field of result.schema.onlyOnRight) append('schema_only_on_right', '', field, '', '');
  return lines.join('\r\n');
}
