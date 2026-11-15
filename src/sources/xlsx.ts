import ExcelJS from 'exceljs';
import yauzl from 'yauzl';
import type { Entry } from 'yauzl';
import type { Dataset, DataRow, Scalar } from '../core/types.js';
import { assertFileSize, MAX_COLUMNS, MAX_ROWS } from './csv.js';

const MAX_ZIP_ENTRIES = 250;
const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_ENTRY_BYTES = 10 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;

function inspectArchive(buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (openError, zip) => {
      if (openError || !zip) return reject(new Error('XLSX arşivi okunamadı.'));
      let total = 0;
      let entries = 0;
      let finished = false;
      const fail = () => {
        if (finished) return;
        finished = true;
        zip.close();
        reject(new Error('XLSX arşivi güvenli ayrıştırma sınırlarını aşıyor.'));
      };
      zip.on('error', fail);
      zip.on('entry', (entry: Entry) => {
        entries += 1;
        total += entry.uncompressedSize;
        const ratio = entry.compressedSize === 0 ? (entry.uncompressedSize === 0 ? 1 : Infinity) : entry.uncompressedSize / entry.compressedSize;
        if (entries > MAX_ZIP_ENTRIES || total > MAX_UNCOMPRESSED_BYTES || entry.uncompressedSize > MAX_ENTRY_BYTES || ratio > MAX_COMPRESSION_RATIO) {
          fail();
          return;
        }
        zip.readEntry();
      });
      zip.on('end', () => {
        if (finished) return;
        finished = true;
        resolve();
      });
      zip.readEntry();
    });
  });
}

function toScalar(value: unknown): Scalar {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const cell = value as Record<string, unknown>;
    if (typeof cell.text === 'string') return cell.text;
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => (typeof part === 'object' && part !== null && 'text' in part ? String((part as { text: unknown }).text) : '')).join('');
    if ('result' in cell) return toScalar(cell.result);
    if ('formula' in cell || 'sharedFormula' in cell) return null;
    if ('error' in cell) throw new Error('XLSX hücresinde hata değeri var.');
  }
  return String(value).slice(0, 65_536);
}

export async function parseXlsxBuffer(buffer: Buffer, name = 'XLSX'): Promise<Dataset> {
  assertFileSize(buffer.byteLength);
  await inspectArchive(buffer);
  try {
    const workbook = new ExcelJS.Workbook();
    const excelBuffer = Buffer.from(new Uint8Array(buffer).buffer) as unknown as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(excelBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount === 0) throw new Error('XLSX çalışma sayfası bulunamadı.');
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    for (let index = 1; index <= headerRow.cellCount; index += 1) {
      const value = toScalar(headerRow.getCell(index).value);
      headers.push(value === null ? '' : String(value).trim());
    }
    while (headers.length > 0 && headers.at(-1) === '') headers.pop();
    if (headers.length === 0 || headers.length > MAX_COLUMNS || headers.some((header) => header.length === 0 || header.length > 256) || new Set(headers).size !== headers.length) {
      throw new Error('XLSX sütun başlıkları eksik, yinelenmiş veya sınırın üzerinde.');
    }
    const rows: DataRow[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      if (rows.length >= MAX_ROWS) throw new Error('Kaynak 10.000 satır sınırını aşıyor.');
      const record: DataRow = {};
      headers.forEach((header, offset) => {
        record[header] = toScalar(row.getCell(offset + 1).value);
      });
      if (Object.values(record).some((value) => value !== null && String(value).length > 65_536)) throw new Error('XLSX hücre değeri izin verilen uzunluğu aşıyor.');
      rows.push(record);
    });
    return { name: name.slice(0, 128), columns: headers, rows };
  } catch (error) {
    if (error instanceof Error && /10\.000 satır|sütun başlıkları|hücre değeri/.test(error.message)) throw error;
    throw new Error('XLSX dosyası okunamadı veya desteklenmeyen bir çalışma sayfası içeriyor.', { cause: error });
  }
}
