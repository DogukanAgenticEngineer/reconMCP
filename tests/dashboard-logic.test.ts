import { describe, expect, it } from 'vitest';
import type { ComparisonPreviewRow } from '../src/core/types.js';
import { chooseKeyPair, commonFieldPairs, filteredPreview, formatBytes } from '../src/ui/dashboard-logic.js';

describe('dashboard field mapping and filters', () => {
  it('pairs headers despite case and punctuation differences', () => {
    const pairs = commonFieldPairs(['Product name', 'Transaction ID', 'Amount'], ['transaction_id', 'amount', 'product name']);
    expect(pairs).toEqual([
      { left: 'Product name', right: 'product name' },
      { left: 'Transaction ID', right: 'transaction_id' },
      { left: 'Amount', right: 'amount' },
    ]);
  });

  it('prefers a stable identity header over the first common field', () => {
    const pairs = commonFieldPairs(['Name', 'Invoice ID', 'Amount'], ['name', 'invoice_id', 'amount']);
    expect(chooseKeyPair(pairs)).toEqual({ left: 'Invoice ID', right: 'invoice_id' });
    expect(chooseKeyPair(commonFieldPairs(['Name'], ['name']))).toEqual({ left: 'Name', right: 'name' });
    expect(chooseKeyPair([])).toBeNull();
  });

  it('filters exact matches while retaining every difference status', () => {
    const rows: ComparisonPreviewRow[] = [
      { key: '{"id":"1"}', status: 'match', leftRows: 1, rightRows: 1, mismatchFields: 0 },
      { key: '{"id":"2"}', status: 'mismatch', leftRows: 1, rightRows: 1, mismatchFields: 1 },
      { key: '{"id":"3"}', status: 'only_left', leftRows: 1, rightRows: 0, mismatchFields: 0 },
    ];
    expect(filteredPreview(rows, true).map((row) => row.status)).toEqual(['mismatch', 'only_left']);
    expect(filteredPreview(rows, false)).toEqual(rows);
  });

  it('formats file/request sizes consistently', () => {
    expect(formatBytes(768)).toBe('768 B');
    expect(formatBytes(1536)).toBe('2 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB');
  });
});
