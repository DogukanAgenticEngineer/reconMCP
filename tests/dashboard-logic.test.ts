import { describe, expect, it } from 'vitest';
import type { ComparisonPreviewRow } from '../src/core/types.js';
import { chooseKeyPair, commonFieldPairs, filteredPreview, formatBytes, isValidPairSelection, isValidTolerance } from '../src/ui/dashboard-logic.js';

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

  it('validates unique manual composite key and value-field mappings', () => {
    const left = ['id', 'account', 'amount'];
    const right = ['record_id', 'account_ref', 'total'];
    expect(isValidPairSelection([{ left: 'id', right: 'record_id' }, { left: 'account', right: 'account_ref' }], left, right, 10, 1)).toBe(true);
    expect(isValidPairSelection([{ left: 'id', right: 'record_id' }, { left: 'id', right: 'account_ref' }], left, right, 10, 1)).toBe(false);
    expect(isValidPairSelection([{ left: 'amount', right: 'total' }], left, right, 0)).toBe(false);
    expect(isValidPairSelection([], left, right, 10, 1)).toBe(false);
    expect(isValidPairSelection([], left, right, 100)).toBe(true);
  });

  it('accepts only bounded non-negative base-10 decimal tolerance', () => {
    expect(isValidTolerance('')).toBe(true);
    expect(isValidTolerance('0')).toBe(true);
    expect(isValidTolerance('12.003')).toBe(true);
    expect(isValidTolerance('-0.01')).toBe(false);
    expect(isValidTolerance('1e-8')).toBe(false);
    expect(isValidTolerance(`${'1'.repeat(31)}`)).toBe(false);
    expect(isValidTolerance(`1.${'2'.repeat(19)}`)).toBe(false);
  });

  it('filters matching key groups by difference status and search text', () => {
    const rows: ComparisonPreviewRow[] = [
      { key: '{"id":"demo-1"}', status: 'match', leftRows: 1, rightRows: 1, mismatchFields: 0 },
      { key: '{"id":"demo-2"}', status: 'mismatch', leftRows: 1, rightRows: 1, mismatchFields: 1 },
      { key: '{"id":"demo-3"}', status: 'only_left', leftRows: 1, rightRows: 0, mismatchFields: 0 },
      { key: '{"id":"demo-4"}', status: 'duplicate', leftRows: 2, rightRows: 1, mismatchFields: 0 },
    ];
    expect(filteredPreview(rows, true).map((row) => row.status)).toEqual(['mismatch', 'only_left', 'duplicate']);
    expect(filteredPreview(rows, false)).toEqual(rows);
    expect(filteredPreview(rows, false, 'DEMO-2', 'mismatch')).toEqual([rows[1]]);
    expect(filteredPreview(rows, false, 'not-found')).toEqual([]);
    const searchableValues = new Map([[rows[1]!.key, 'amount 20.00 22.00']]);
    expect(filteredPreview(rows, false, '22.00', 'all', searchableValues)).toEqual([rows[1]]);
  });

  it('formats file/request sizes consistently', () => {
    expect(formatBytes(768)).toBe('768 B');
    expect(formatBytes(1536)).toBe('2 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB');
  });
});
