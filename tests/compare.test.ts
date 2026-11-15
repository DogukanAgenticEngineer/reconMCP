import { describe, expect, it } from 'vitest';
import { compareDatasets } from '../src/core/compare.js';
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

  it('neutralizes spreadsheet formula injection in text cells', () => {
    const malicious: Dataset = { name: 'A', columns: ['id', 'value'], rows: [{ id: '1', value: '=HYPERLINK("https://attacker.invalid")' }] };
    const empty: Dataset = { name: 'B', columns: ['id', 'amount'], rows: [{ id: '1', amount: '1' }] };
    const result = compareDatasets(malicious, empty, { keyPairs: [{ left: 'id', right: 'id' }], fieldPairs: [{ left: 'value', right: 'amount' }] });
    const csv = resultToCsv(result);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain('"=HYPERLINK');
  });
});
