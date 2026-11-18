import { describe, expect, it } from 'vitest';
import { compareDatasets, compareMultipleDatasets } from '../src/core/compare.js';
import type { Dataset } from '../src/core/types.js';
import { resultToCsv } from '../src/core/report.js';

const left: Dataset = {
  name: 'left',
  columns: ['id', 'amount', 'left_only'],
  rows: [
    { id: '1', amount: '10.00', left_only: 'x' },
    { id: '1', amount: '10.00', left_only: 'duplicate' },
    { id: '2', amount: '5.00', left_only: 'y' },
  ],
};
const right: Dataset = {
  name: 'right',
  columns: ['code', 'total', 'right_only'],
  rows: [
    { code: '1', total: '10.00', right_only: 'x' },
    { code: '3', total: '8.00', right_only: 'z' },
  ],
};

const options = {
  keyPairs: [{ left: 'id', right: 'code' }],
  fieldPairs: [{ left: 'amount', right: 'total' }],
  tolerance: '0.01',
};

describe('deterministic reconciliation', () => {
  it('reports missing, duplicate and schema differences with mapped keys', () => {
    const result = compareDatasets(left, right, options);
    expect(result.summary.missingOnRight).toBe(1);
    expect(result.summary.missingOnLeft).toBe(1);
    expect(result.duplicates.left).toHaveLength(1);
    expect(result.duplicates.left[0]?.count).toBe(2);
    expect(result.schema.onlyOnLeft).toEqual(['id', 'amount', 'left_only']);
    expect(result.schema.onlyOnRight).toEqual(['code', 'total', 'right_only']);
    expect(result.mismatches).toHaveLength(0);
  });

  it('uses exact decimal tolerance and emits a mismatch outside the threshold', () => {
    const uniqueLeft: Dataset = { name: 'A', columns: ['id', 'amount'], rows: [{ id: 'x', amount: '100000000000000000000.00' }] };
    const uniqueRight: Dataset = { name: 'B', columns: ['key', 'total'], rows: [{ key: 'x', total: '100000000000000000000.02' }] };
    const result = compareDatasets(uniqueLeft, uniqueRight, {
      keyPairs: [{ left: 'id', right: 'key' }],
      fieldPairs: [{ left: 'amount', right: 'total' }],
      tolerance: '0.01',
    });
    expect(result.mismatches).toEqual([expect.objectContaining({ leftValue: '100000000000000000000.00', rightValue: '100000000000000000000.02' })]);
  });

  it('is deterministic for identical inputs', () => {
    const first = compareDatasets(left, right, options);
    const second = compareDatasets(left, right, options);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('supports optional case-insensitive text values and reports unique matched rows', () => {
    const sourceA: Dataset = { name: 'A', columns: ['ID', 'label'], rows: [{ ID: 'x', label: 'North' }] };
    const sourceB: Dataset = { name: 'B', columns: ['id', 'LABEL'], rows: [{ id: 'x', LABEL: 'north' }] };
    const compareOptions = { keyPairs: [{ left: 'ID', right: 'id' }], fieldPairs: [{ left: 'label', right: 'LABEL' }] };
    const strict = compareDatasets(sourceA, sourceB, compareOptions);
    const relaxed = compareDatasets(sourceA, sourceB, { ...compareOptions, caseSensitiveValues: false });

    expect(strict.summary.matchedKeys).toBe(1);
    expect(strict.summary.matchedRows).toBe(0);
    expect(strict.summary.mismatchedRows).toBe(1);
    expect(strict.comparisonPreview[0]?.status).toBe('mismatch');
    expect(relaxed.summary.matchedRows).toBe(1);
    expect(relaxed.summary.valueMismatches).toBe(0);
    expect(relaxed.comparisonPreview[0]?.status).toBe('match');
  });

  it('prioritizes all non-match groups before limiting a large comparison preview', () => {
    const rowsA = Array.from({ length: 56 }, (_, index) => ({ id: String(index), amount: '1' }));
    const rowsB = rowsA.map((row) => ({ ...row }));
    const last = rowsB[55];
    if (!last) throw new Error('Synthetic test row was not created.');
    last.amount = '2';
    const sourceA: Dataset = { name: 'A', columns: ['id', 'amount'], rows: rowsA };
    const sourceB: Dataset = { name: 'B', columns: ['id', 'amount'], rows: rowsB };
    const result = compareDatasets(sourceA, sourceB, { keyPairs: [{ left: 'id', right: 'id' }] });

    expect(result.comparisonPreview).toHaveLength(50);
    expect(result.previewTruncated).toBe(true);
    expect(result.comparisonPreview[0]?.status).toBe('mismatch');
    expect(result.comparisonPreview.filter((row) => row.status !== 'match')).toHaveLength(1);
    expect(result.summary.matchedRows).toBe(55);
  });

  it('neutralizes spreadsheet formula injection in text cells', () => {
    const malicious: Dataset = { name: 'A', columns: ['id', 'value'], rows: [{ id: '1', value: '=HYPERLINK("https://attacker.invalid")' }] };
    const empty: Dataset = { name: 'B', columns: ['id', 'amount'], rows: [{ id: '1', amount: '1' }] };
    const result = compareDatasets(malicious, empty, { keyPairs: [{ left: 'id', right: 'id' }], fieldPairs: [{ left: 'value', right: 'amount' }] });
    const csv = resultToCsv(result);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain('"=HYPERLINK');
  });

  it('keeps hostile Markdown syntax in source labels and result cells inert', () => {
    const hostileName = '![source](https://evil.invalid) <img src=x onerror=alert(1)> **A**';
    const sourceA: Dataset = {
      name: hostileName,
      columns: ['id', '`value`'],
      rows: [{ id: 'x', '`value`': '`bad` | [click](https://evil.invalid)' }],
    };
    const sourceB: Dataset = { name: 'B', columns: ['id', 'value'], rows: [{ id: 'x', value: 'safe' }] };
    const result = compareDatasets(sourceA, sourceB, {
      keyPairs: [{ left: 'id', right: 'id' }],
      fieldPairs: [{ left: '`value`', right: 'value' }],
    });

    expect(result.markdown).toContain(`\`${hostileName}\``);
    expect(result.markdown).toContain('`` `bad` \\| [click](https://evil.invalid) ``');
  });

  it('validates multi-source bounds and calculates pairwise combinations', () => {
    const s1: Dataset = { name: 'S1', columns: ['id', 'val'], rows: [{ id: '1', val: 'a' }] };
    const s2: Dataset = { name: 'S2', columns: ['id', 'val'], rows: [{ id: '1', val: 'a' }] };
    const s3: Dataset = { name: 'S3', columns: ['id', 'val'], rows: [{ id: '1', val: 'b' }] };

    expect(() => compareMultipleDatasets({
      sources: [s1],
      keyPairs: [{ left: 'id', right: 'id' }],
    })).toThrow('Kaynak sayısı 2 ile 10 arasında olmalıdır.');

    const res = compareMultipleDatasets({
      sources: [s1, s2, s3],
      keyPairs: [{ left: 'id', right: 'id' }],
      fieldPairs: [{ left: 'val', right: 'val' }],
    });

    expect(res.totalSources).toBe(3);
    expect(res.totalComparisons).toBe(3); // 3*2/2 = 3
    expect(res.pairwise).toHaveLength(3);
    expect(res.aggregateSummary.totalMatches).toBe(1);
    expect(res.aggregateSummary.totalMismatches).toBe(2);
    expect(res.aggregateSummary.worstPair).not.toBeNull();
  });
});
