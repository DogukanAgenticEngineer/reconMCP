import { Buffer } from 'node:buffer';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, parseCsvBuffer } from '../src/sources/csv.js';
import { parseXlsxBuffer } from '../src/sources/xlsx.js';

describe('memory-only file parsers', () => {
  it('parses UTF-8 CSV with quoted delimiters and Unicode', () => {
    const result = parseCsvBuffer(Buffer.from('id,amount,note\n1,10.25,"şube, merkez"\n', 'utf8'));
    expect(result.columns).toEqual(['id', 'amount', 'note']);
    expect(result.rows[0]).toEqual({ id: '1', amount: '10.25', note: 'şube, merkez' });
  });

  it('rejects duplicate or inconsistent CSV headers and invalid UTF-8', () => {
    expect(() => parseCsvBuffer(Buffer.from('id,id\n1,2\n'))).toThrow(/yinelenen sütun/);
    expect(() => parseCsvBuffer(Buffer.from('id,value\n1\n'))).toThrow(/ayrıştırılamadı/);
    expect(() => parseCsvBuffer(Buffer.from([0xc3, 0x28]))).toThrow(/UTF-8/);
  });

  it('parses the first XLSX worksheet in memory', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('records');
    sheet.addRow(['id', 'amount']);
    sheet.addRow(['1', 12.5]);
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await parseXlsxBuffer(bytes, 'records.xlsx');
    expect(result.name).toBe('records.xlsx');
    expect(result.columns).toEqual(['id', 'amount']);
    expect(result.rows).toEqual([{ id: '1', amount: 12.5 }]);
  });

  it('rejects oversized file input before parsing', async () => {
    expect(() => parseCsvBuffer(Buffer.alloc(MAX_FILE_BYTES + 1))).toThrow(/4 MB/);
    await expect(parseXlsxBuffer(Buffer.alloc(MAX_FILE_BYTES + 1))).rejects.toThrow(/4 MB/);
  });
});
