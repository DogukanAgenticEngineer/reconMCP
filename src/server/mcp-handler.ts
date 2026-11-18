import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { MAX_COMBINED_BYTES } from '../sources/csv.js';
import { createMcpServer } from '../mcp/create-server.js';

const TOTAL_LIMIT_MESSAGE = 'Toplam giriş 4,25 MB sınırını aşıyor.';

function normalizedOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && url.origin === value && !url.username && !url.password ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function allowedOrigins(): Set<string> {
  return new Set((process.env.MCP_ALLOWED_ORIGINS ?? '').split(',')
    .map((origin) => normalizedOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin)));
}

function errorResponse(res: ServerResponse, status: number, message: string): void {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify({ error: message }));
}

export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Origin');
  const rawOrigin = req.headers.origin;
  const origin = typeof rawOrigin === 'string' ? normalizedOrigin(rawOrigin) : undefined;
  const originAllowed = rawOrigin === undefined || (origin !== undefined && allowedOrigins().has(origin));
  if (!originAllowed) {
    errorResponse(res, 403, 'Origin bu MCP endpointi için izinli değil.');
    return;
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, MCP-Protocol-Version, Last-Event-ID');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  const declared = req.headers['content-length'];
  if (typeof declared === 'string') {
    if (!/^\d+$/.test(declared)) {
      errorResponse(res, 400, 'İstek gövdesi boyutu geçersiz.');
      return;
    }
    const contentLength = Number(declared);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      errorResponse(res, 400, 'İstek gövdesi boyutu geçersiz.');
      return;
    }
    if (contentLength > MAX_COMBINED_BYTES) {
      errorResponse(res, 413, TOTAL_LIMIT_MESSAGE);
      return;
    }
  }

  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    maxRequestBodySize: MAX_COMBINED_BYTES,
  });
  let cleaned = false;
  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    void server.close().catch(() => undefined);
    void transport.close().catch(() => undefined);
  };
  res.once('finish', cleanup);
  res.once('close', cleanup);
  req.once('aborted', cleanup);
  let onData: ((chunk: Buffer) => void) | undefined;
  try {
    await server.connect(transport);
    let seen = 0;
    let tooLarge = false;
    let notifyOverflow: () => void = () => undefined;
    const overflow = new Promise<void>((resolve) => { notifyOverflow = resolve; });
    const requestTask = transport.handleRequest(req, res).then(
      () => undefined,
      (error: unknown) => { throw error; },
    );
    onData = (chunk: Buffer): void => {
      seen += chunk.byteLength;
      if (seen > MAX_COMBINED_BYTES && !tooLarge) {
        tooLarge = true;
        errorResponse(res, 413, TOTAL_LIMIT_MESSAGE);
        notifyOverflow();
      }
    };
    req.on('data', onData);
    const state = await Promise.race([
      requestTask.then(() => 'complete' as const),
      overflow.then(() => 'overflow' as const),
    ]);
    if (state === 'overflow') {
      void requestTask.catch(() => undefined);
      cleanup();
    }
  } catch {
    errorResponse(res, 500, 'MCP isteği güvenli biçimde işlenemedi.');
  } finally {
    if (onData) req.off('data', onData);
    cleanup();
  }
}
