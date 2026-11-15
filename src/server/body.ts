import { Buffer } from 'node:buffer';
import type { IncomingMessage } from 'node:http';
import Busboy from 'busboy';
import { MAX_COMBINED_BYTES, MAX_FILE_BYTES } from '../sources/csv.js';

export interface MultipartBody {
  fields: Record<string, string>;
  files: Map<string, Buffer>;
}

const TOTAL_LIMIT_MESSAGE = 'Toplam giriş 4,25 MB sınırını aşıyor.';

function declaredSize(req: IncomingMessage, maximum: number): void {
  const value = req.headers['content-length'];
  if (typeof value !== 'string') return;
  if (!/^\d+$/.test(value)) throw new Error('İstek boyutu geçersiz.');
  const size = Number(value);
  if (!Number.isSafeInteger(size) || size < 0) throw new Error('İstek boyutu geçersiz.');
  if (size > maximum) throw new Error(TOTAL_LIMIT_MESSAGE);
}

export async function readJsonBody(req: IncomingMessage, maximum = MAX_COMBINED_BYTES): Promise<unknown> {
  declaredSize(req, maximum);
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const value of req) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);
    total += chunk.byteLength;
    if (total > maximum) throw new Error(TOTAL_LIMIT_MESSAGE);
    chunks.push(chunk);
  }
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
  catch { throw new Error('İstek gövdesi geçerli UTF-8 metni değil.'); }
  try { return JSON.parse(text) as unknown; }
  catch { throw new Error('İstek gövdesi geçerli JSON değil.'); }
}

export function readMultipartBody(req: IncomingMessage): Promise<MultipartBody> {
  declaredSize(req, MAX_COMBINED_BYTES);
  return new Promise((resolve, reject) => {
    let settled = false;
    const fields: Record<string, string> = {};
    const files = new Map<string, Buffer>();
    const chunksByFile = new Map<string, Buffer[]>();
    const sizes = new Map<string, number>();
    const fail = (message: string): void => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };
    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: { files: 2, fields: 20, parts: 22, fieldSize: 65_536, fileSize: MAX_FILE_BYTES },
      });
    } catch {
      fail('Multipart içerik biçimi geçersiz.');
      return;
    }
    parser.on('field', (name, value, info) => {
      if (info.nameTruncated || info.valueTruncated || Object.hasOwn(fields, name)) {
        fail('Multipart alanı geçersiz veya sınırı aşıyor.');
        return;
      }
      if (!['mode', 'source', 'left', 'right', 'keyPairs', 'fieldPairs', 'tolerance', 'trimWhitespace', 'caseSensitiveKeys', 'caseSensitiveValues'].includes(name)) {
        fail('Multipart alan adı desteklenmiyor.');
        return;
      }
      fields[name] = value;
    });
    parser.on('file', (name, stream) => {
      if (!['file', 'fileLeft', 'fileRight'].includes(name) || chunksByFile.has(name)) {
        stream.resume();
        fail('Dosya alanı geçersiz.');
        return;
      }
      chunksByFile.set(name, []);
      sizes.set(name, 0);
      stream.on('data', (chunk: Buffer) => {
        const size = (sizes.get(name) ?? 0) + chunk.byteLength;
        sizes.set(name, size);
        if (size > MAX_FILE_BYTES) {
          fail('Dosya 4 MB sınırını aşıyor.');
          stream.resume();
          return;
        }
        chunksByFile.get(name)?.push(Buffer.from(chunk));
      });
      stream.on('limit', () => fail('Dosya 4 MB sınırını aşıyor.'));
      stream.on('end', () => {
        if (!settled) files.set(name, Buffer.concat(chunksByFile.get(name) ?? []));
      });
    });
    parser.on('filesLimit', () => fail('İstek en fazla iki dosya içerebilir.'));
    parser.on('fieldsLimit', () => fail('Multipart alan sayısı sınırı aşıyor.'));
    parser.on('partsLimit', () => fail('Multipart parça sayısı sınırı aşıyor.'));
    parser.on('error', () => fail('Multipart içerik ayrıştırılamadı.'));
    parser.on('finish', () => {
      if (settled) return;
      const fieldBytes = Object.entries(fields).reduce((sum, [key, value]) => sum + Buffer.byteLength(key) + Buffer.byteLength(value), 0);
      const fileBytes = [...sizes.values()].reduce((sum, size) => sum + size, 0);
      if (fieldBytes + fileBytes > MAX_COMBINED_BYTES) {
        fail(TOTAL_LIMIT_MESSAGE);
        return;
      }
      settled = true;
      resolve({ fields, files });
    });
    req.pipe(parser);
  });
}
