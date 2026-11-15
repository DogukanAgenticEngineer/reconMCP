import { Buffer } from 'node:buffer';
import type { Dataset } from '../core/types.js';
import { MAX_FILE_BYTES, parseCsvBuffer } from './csv.js';
import { loadSource } from './load.js';
import type { McpSource } from './mcp-schemas.js';
import { parseXlsxBuffer } from './xlsx.js';

export async function loadMcpSource(input: McpSource): Promise<Dataset> {
  if (input.type === 'csv') return parseCsvBuffer(Buffer.from(input.content, 'utf8'), input.name || 'CSV');
  if (input.type === 'xlsx') {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.contentBase64) || input.contentBase64.length % 4 !== 0) throw new Error('XLSX base64 içeriği geçersiz.');
    const bytes = Buffer.from(input.contentBase64, 'base64');
    if (bytes.length > MAX_FILE_BYTES || bytes.toString('base64') !== input.contentBase64) throw new Error('XLSX dosyası 4 MB sınırını aşıyor veya base64 biçimi geçersiz.');
    return parseXlsxBuffer(bytes, input.name || 'XLSX');
  }
  return loadSource(input);
}
