import { Buffer } from 'node:buffer';
import { Client } from 'pg';
import type { QueryResult } from 'pg';
import QueryStream from 'pg-query-stream';
import type { Dataset, DataRow, Scalar } from '../core/types.js';
import { parseCsvBuffer, MAX_COLUMNS, MAX_ROWS } from './csv.js';
import { resolveAllowedPublicHost, exactHostname, createPinnedAgent } from './network.js';
import { fileSourceSchema, rowsSourceSchema, postgresSourceSchema, restSourceSchema } from './schemas.js';
import { parseXlsxBuffer } from './xlsx.js';

const MAX_REST_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_VALUE_LENGTH = 65_536;
const hasControlCharacter = (value: string): boolean => Array.from(value).some((character) => character.charCodeAt(0) <= 31);

function scalar(value: unknown): Scalar {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    if (Buffer.byteLength(value, 'utf8') > MAX_VALUE_LENGTH) throw new Error('Kaynak hücre değeri izin verilen uzunluğu aşıyor.');
    return value;
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const json = JSON.stringify(value);
    if (json === undefined || Buffer.byteLength(json, 'utf8') > MAX_VALUE_LENGTH) throw new Error('Kaynak hücre değeri izin verilen uzunluğu aşıyor.');
    return json;
  }
  const text = String(value);
  if (Buffer.byteLength(text, 'utf8') > MAX_VALUE_LENGTH) throw new Error('Kaynak hücre değeri izin verilen uzunluğu aşıyor.');
  return text;
}

function fromRows(input: unknown, fallbackName: string): Dataset {
  const source = rowsSourceSchema.parse(input);
  const names = source.columns ?? [...new Set(source.rows.flatMap((row) => Object.keys(row)))];
  if (names.length === 0 && source.rows.length > 0) throw new Error('Kaynakta sütun bulunamadı.');
  if (names.length > MAX_COLUMNS || new Set(names).size !== names.length) throw new Error('Kaynak 100 sütun sınırını aşıyor veya sütun adları yineleniyor.');
  if (source.rows.length > MAX_ROWS) throw new Error('Kaynak 10.000 satır sınırını aşıyor.');
  let sourceBytes = 0;
  const rows: DataRow[] = source.rows.map((row) => {
    if (Object.keys(row).length > MAX_COLUMNS) throw new Error('Kaynak 100 sütun sınırını aşıyor.');
    return Object.fromEntries(names.map((column) => {
      const value = scalar(row[column]);
      sourceBytes += Buffer.byteLength(value === null ? '' : String(value), 'utf8');
      if (sourceBytes > MAX_SOURCE_BYTES) throw new Error('Kaynak verisi 4 MB sınırını aşıyor.');
      return [column, value];
    })) as DataRow;
  });
  return { name: source.name || fallbackName, columns: names, rows };
}

async function readRest(sourceInput: unknown): Promise<Dataset> {
  const source = restSourceSchema.parse(sourceInput);
  let url: URL;
  try { url = new URL(source.url); } catch { throw new Error('REST URL geçersiz.'); }
  const hostname = exactHostname(url);
  const pinned = await resolveAllowedPublicHost(hostname);
  const agent = createPinnedAgent(hostname, pinned);
  try {
    const response = await fetch(url.href, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(6_000),
      headers: { accept: 'application/json, text/csv;q=0.9', ...(source.headers ?? {}) },
      dispatcher: agent,
    } as RequestInit & { dispatcher: typeof agent });
    if (response.status >= 300 && response.status < 400) throw new Error('REST yeniden yönlendirmeleri kapalıdır.');
    if (!response.ok) throw new Error('REST kaynağından başarılı yanıt alınamadı.');
    const length = Number(response.headers.get('content-length') ?? '0');
    if (Number.isFinite(length) && length > MAX_REST_BYTES) throw new Error('REST yanıtı 2 MB sınırını aşıyor.');
    if (!response.body) throw new Error('REST yanıtı boş.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REST_BYTES) {
        await reader.cancel();
        throw new Error('REST yanıtı 2 MB sınırını aşıyor.');
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (contentType === 'text/csv' || contentType === 'application/csv') return parseCsvBuffer(body, source.name || hostname);
    if (!contentType.includes('json')) throw new Error('REST yanıtı yalnız JSON veya CSV olabilir.');
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
    catch { throw new Error('REST JSON yanıtı geçerli değil.'); }
    let records: unknown = parsed;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const envelope = parsed as Record<string, unknown>;
      records = Array.isArray(envelope.records) ? envelope.records : envelope.data;
    }
    if (!Array.isArray(records) || records.length > MAX_ROWS || records.some((row) => typeof row !== 'object' || row === null || Array.isArray(row))) {
      throw new Error('REST yanıtı en fazla 10.000 kayıtlık JSON nesne dizisi olmalıdır.');
    }
    return fromRows({ type: 'rows', name: source.name || hostname, rows: records }, source.name || hostname);
  } catch (error) {
    if (error instanceof Error && /REST|izin|HTTPS|IP|DNS|kaynak/.test(error.message)) throw error;
    throw new Error('REST kaynağı güvenli biçimde okunamadı.', { cause: error });
  } finally {
    await agent.close().catch(() => undefined);
  }
}

function quoteIdentifier(identifier: string): string {
  if (identifier.length === 0 || identifier.length > 128 || hasControlCharacter(identifier)) throw new Error('PostgreSQL tanımlayıcısı geçersiz.');
  return `"${identifier.replaceAll('"', '""')}"`;
}

function assertAllowedPostgresPort(port: number): void {
  const allowed = new Set((process.env.RECONCILE_ALLOWED_POSTGRES_PORTS ?? '5432')
    .split(',').map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value >= 1 && value <= 65_535));
  if (!allowed.has(port)) throw new Error('PostgreSQL portu sunucu izin listesinde değil.');
}

async function readPostgres(sourceInput: unknown): Promise<Dataset> {
  const source = postgresSourceSchema.parse(sourceInput);
  assertAllowedPostgresPort(source.port);
  const pinned = await resolveAllowedPublicHost(source.host);
  const client = new Client({
    host: pinned.address,
    port: source.port,
    user: source.user,
    password: source.password,
    database: source.database,
    ssl: { rejectUnauthorized: true, servername: source.host },
    connectionTimeoutMillis: 5_000,
    statement_timeout: 7_000,
    query_timeout: 8_000,
    application_name: 'reconcile-mcp-read-only',
  });
  let rowStream: QueryStream | undefined;
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const table = `${quoteIdentifier(source.schema)}.${quoteIdentifier(source.table)}`;
    const metadata = await client.query(`SELECT * FROM ${table} LIMIT 0`) as QueryResult<Record<string, unknown>>;
    const availableColumns = metadata.fields.map((field) => field.name);
    if (availableColumns.length > MAX_COLUMNS || new Set(availableColumns).size !== availableColumns.length) {
      throw new Error('PostgreSQL kaynağı 100 sütun sınırını aşıyor veya yinelenen sütun adı içeriyor.');
    }
    const columns = source.columns?.length ? source.columns : availableColumns;
    if (columns.length === 0 || columns.length > MAX_COLUMNS || new Set(columns).size !== columns.length || columns.some((column) => !availableColumns.includes(column))) {
      throw new Error('PostgreSQL sütunları geçersiz veya 100 sütun sınırını aşıyor.');
    }
    const projection = columns.flatMap((column, index) => {
      const quoted = quoteIdentifier(column);
      const valueAlias = quoteIdentifier(`__reconcile_value_${index}`);
      const sizeAlias = quoteIdentifier(`__reconcile_oversize_${index}`);
      return [`${quoted}::text AS ${valueAlias}`, `COALESCE(octet_length(${quoted}::text) > ${MAX_VALUE_LENGTH}, false) AS ${sizeAlias}`];
    }).join(', ');
    const query = `SELECT ${projection} FROM ${table} LIMIT $1`;
    rowStream = new QueryStream(query, [MAX_ROWS + 1], { batchSize: 1, highWaterMark: 1, rowMode: 'array' });
    const streamedRows = client.query(rowStream) as unknown as AsyncIterable<unknown[]>;
    const rows: DataRow[] = [];
    let sourceBytes = 0;
    for await (const streamed of streamedRows) {
      if (rows.length >= MAX_ROWS) throw new Error('PostgreSQL kaynağı 10.000 satır sınırını aşıyor.');
      if (!Array.isArray(streamed) || streamed.length !== columns.length * 2) throw new Error('PostgreSQL satır biçimi doğrulanamadı.');
      const row: DataRow = {};
      for (let index = 0; index < columns.length; index += 1) {
        const column = columns[index];
        if (column === undefined) continue;
        if (streamed[index * 2 + 1] === true) throw new Error('PostgreSQL hücre değeri 64 KB sınırını aşıyor.');
        const value = scalar(streamed[index * 2]);
        sourceBytes += Buffer.byteLength(value === null ? '' : String(value), 'utf8');
        if (sourceBytes > MAX_SOURCE_BYTES) throw new Error('PostgreSQL kaynak verisi 4 MB sınırını aşıyor.');
        row[column] = value;
      }
      rows.push(row);
    }
    return { name: source.name || `${source.schema}.${source.table}`, columns, rows };
  } catch (error) {
    rowStream?.destroy();
    if (error instanceof Error && error.message.startsWith('PostgreSQL ')) throw error;
    throw new Error('PostgreSQL kaynağı salt okunur modda güvenli biçimde okunamadı. Bağlantı, tablo, TLS ve sunucu izin listesini doğrulayın.', { cause: error });
  } finally {
    rowStream?.destroy();
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}

export async function loadSource(sourceInput: unknown, file?: Buffer): Promise<Dataset> {
  if (typeof sourceInput === 'object' && sourceInput !== null && 'type' in sourceInput) {
    const type = (sourceInput as { type: string }).type;
    if (type === 'rows') return fromRows(sourceInput, 'Veri kaynağı');
    if (type === 'file') {
      const source = fileSourceSchema.parse(sourceInput);
      if (!file) throw new Error('Dosya içeriği eksik.');
      return source.format === 'csv'
        ? parseCsvBuffer(file, source.name || 'CSV dosyası')
        : await parseXlsxBuffer(file, source.name || 'XLSX dosyası');
    }
    if (type === 'rest') return readRest(sourceInput);
    if (type === 'postgres') return readPostgres(sourceInput);
  }
  throw new Error('Veri kaynağı türü desteklenmiyor.');
}
