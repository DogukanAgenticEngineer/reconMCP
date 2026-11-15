import type { IncomingMessage, ServerResponse } from 'node:http';
import { compareDatasets, assertResponseSize } from '../core/compare.js';
import { resultToCsv } from '../core/report.js';
import type { CompareOptions } from '../core/types.js';
import { loadSource } from '../sources/load.js';
import { compareOptionsSchema, reconcileRequestSchema, sourceDefinitionSchema } from '../sources/schemas.js';
import { readJsonBody, readMultipartBody } from './body.js';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function json(res: ServerResponse, status: number, body: unknown): void {
  const encoded = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(encoded);
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const safePrefixes = [
    'Dosya ', 'Toplam giriş ', 'Kaynak ', 'CSV ', 'XLSX ', 'REST ', 'Bu bağlantı ',
    'Bağlantı hedefi ', 'Bağlantı hedefinin ', 'Özel ağ ', 'Harici REST ', 'PostgreSQL ',
    'İstek ', 'Multipart ', 'Dosya alanı ', 'Multipart alanı ', 'Multipart içerik ',
    'Sonuç ', 'Geçersiz ', 'Kaynakta ', 'XLSX arşivi ', 'REST yanıtı ',
  ];
  return safePrefixes.some((prefix) => message.startsWith(prefix)) ? message : 'İstek işlenemedi. Girdi biçimini ve bağlantı izinlerini kontrol edin.';
}

function parseField(fields: Record<string, string>, key: string): unknown {
  const raw = fields[key];
  if (raw === undefined) throw new Error('İstek alanı eksik.');
  try { return JSON.parse(raw) as unknown; }
  catch { throw new Error('İstek alanı geçerli JSON değil.'); }
}

async function inspect(sourceInput: unknown, file: Buffer | undefined): Promise<unknown> {
  const source = sourceDefinitionSchema.parse(sourceInput);
  const dataset = await loadSource(source, file);
  const response = { name: dataset.name, columns: dataset.columns, rowCount: dataset.rows.length };
  assertResponseSize(response, MAX_RESPONSE_BYTES);
  return response;
}

async function compare(input: unknown, files: Map<string, Buffer>): Promise<unknown> {
  const request = reconcileRequestSchema.parse(input);
  const leftFile = files.get('fileLeft');
  const rightFile = files.get('fileRight');
  const [left, right] = await Promise.all([
    loadSource(request.left, leftFile),
    loadSource(request.right, rightFile),
  ]);
  const options = compareOptionsSchema.parse({
    keyPairs: request.keyPairs,
    ...(request.fieldPairs ? { fieldPairs: request.fieldPairs } : {}),
    ...(request.tolerance ? { tolerance: request.tolerance } : {}),
    trimWhitespace: request.trimWhitespace,
    caseSensitiveKeys: request.caseSensitiveKeys,
    caseSensitiveValues: request.caseSensitiveValues,
  }) as CompareOptions;
  const result = compareDatasets(left, right, options);
  const response = { ...result, reportCsv: resultToCsv(result) };
  assertResponseSize(response, MAX_RESPONSE_BYTES);
  return response;
}

export async function handleReconcileRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    json(res, 405, { error: 'Yalnız POST desteklenir.' });
    return;
  }
  const started = Date.now();
  try {
    const contentType = req.headers['content-type']?.split(';')[0]?.trim().toLowerCase() ?? '';
    let payload: unknown;
    let files = new Map<string, Buffer>();
    if (contentType === 'multipart/form-data') {
      const multipart = await readMultipartBody(req);
      files = multipart.files;
      const mode = multipart.fields.mode;
      if (mode === 'inspect') {
        const source = parseField(multipart.fields, 'source');
        const result = await inspect(source, files.get('file'));
        json(res, 200, result);
        return;
      }
      if (mode !== 'compare') throw new Error('İstek modu desteklenmiyor.');
      payload = {
        left: parseField(multipart.fields, 'left'),
        right: parseField(multipart.fields, 'right'),
        keyPairs: parseField(multipart.fields, 'keyPairs'),
        ...(multipart.fields.fieldPairs ? { fieldPairs: parseField(multipart.fields, 'fieldPairs') } : {}),
        ...(multipart.fields.tolerance ? { tolerance: multipart.fields.tolerance } : {}),
        trimWhitespace: multipart.fields.trimWhitespace !== 'false',
        caseSensitiveKeys: multipart.fields.caseSensitiveKeys !== 'false',
        caseSensitiveValues: multipart.fields.caseSensitiveValues !== 'false',
      };
    } else if (contentType === 'application/json') {
      payload = await readJsonBody(req);
      const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
      if (record.mode === 'inspect') {
        const result = await inspect(record.source, undefined);
        json(res, 200, result);
        return;
      }
    } else {
      json(res, 415, { error: 'Content-Type application/json veya multipart/form-data olmalı.' });
      return;
    }
    if (Date.now() - started > 14_000) throw new Error('İşlem 15 saniye sınırını aşıyor.');
    const result = await compare(payload, files);
    if (Date.now() - started > 14_000) throw new Error('İşlem 15 saniye sınırını aşıyor.');
    json(res, 200, result);
  } catch (error) {
    const status = error instanceof Error && /sınırını aşıyor|izin verilen/.test(error.message) ? 413 : 400;
    json(res, status, { error: safeMessage(error) });
  }
}
