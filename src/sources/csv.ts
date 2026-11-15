import { parse } from 'csv-parse/sync';
import type { Dataset, DataRow, Scalar } from '../core/types.js';

export const MAX_ROWS = 10_000;
export const MAX_COLUMNS = 100;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_COMBINED_BYTES = Math.floor(4.25 * 1024 * 1024);

export function assertFileSize(bytes: number): void {
  if (bytes > MAX_FILE_BYTES) throw new Error('Dosya 4 MB sınırını aşıyor.');
}

export function parseCsvBuffer(buffer: Buffer, name = 'CSV'): Dataset {
  assertFileSize(buffer.byteLength);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new Error('CSV dosyası geçerli UTF-8 metni değil.');
  }

  let headerCount = 0;
  let headers: string[] = [];
  let records: Record<string, string>[];
  try {
    records = parse(text, {
      bom: true,
      columns: (values: string[]) => {
        headers = values.map((value) => value.trim());
        headerCount = headers.length;
        if (headerCount === 0 || headerCount > MAX_COLUMNS || headers.some((value) => value.length === 0 || value.length > 256)) {
          throw new Error('Geçersiz sütun başlıkları.');
        }
        if (new Set(headers).size !== headers.length) throw new Error('CSV dosyasında yinelenen sütun başlıkları var.');
        return headers;
      },
      skip_empty_lines: true,
      max_record_size: 65_536,
      relax_quotes: false,
      relax_column_count: false,
    }) as Record<string, string>[];
  } catch (error) {
    if (error instanceof Error && /Geçersiz sütun|yinelenen sütun/.test(error.message)) throw error;
    throw new Error('CSV ayrıştırılamadı veya satır/sütun biçimi tutarsız.', { cause: error });
  }
  if (headerCount === 0) throw new Error('CSV başlık satırı bulunamadı.');
  if (records.length > MAX_ROWS) throw new Error('Kaynak 10.000 satır sınırını aşıyor.');
  const rows: DataRow[] = records.map((record) => Object.fromEntries(headers.map((header) => [header, (record[header] ?? '') as Scalar]))) as DataRow[];
  return { name: name.slice(0, 128), columns: headers, rows };
}
