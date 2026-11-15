import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { MAX_COMBINED_BYTES } from '../sources/csv.js';
import { createMcpServer } from '../mcp/create-server.js';

const TOTAL_LIMIT_MESSAGE = 'Toplam giriş 4,25 MB sınırını aşıyor.';

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, MCP-Protocol-Version, Last-Event-ID');
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
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.once('finish', () => {
    void server.close().catch(() => undefined);
    void transport.close().catch(() => undefined);
  });
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
    req.on('data', (chunk: Buffer) => {
      seen += chunk.byteLength;
      if (seen > MAX_COMBINED_BYTES && !tooLarge) {
        tooLarge = true;
        errorResponse(res, 413, TOTAL_LIMIT_MESSAGE);
        notifyOverflow();
      }
    });
    const state = await Promise.race([
      requestTask.then(() => 'complete' as const),
      overflow.then(() => 'overflow' as const),
    ]);
    if (state === 'overflow') void requestTask.catch(() => undefined);
  } catch {
    errorResponse(res, 500, 'MCP isteği güvenli biçimde işlenemedi.');
  }
}
