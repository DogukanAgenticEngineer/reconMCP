import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_COMBINED_BYTES } from '../src/sources/csv.js';
import { handleReconcileRequest } from '../src/server/reconcile-handler.js';

describe('reconciliation HTTP endpoint', () => {
  let server: ReturnType<typeof createServer> | undefined;
  let baseUrl = '';

  afterEach(async () => {
    if (server?.listening) {
      server.close();
      server.closeAllConnections();
      await once(server, 'close');
    }
    server = undefined;
    baseUrl = '';
  });

  async function startServer(): Promise<void> {
    server = createServer((req, res) => { void handleReconcileRequest(req, res); });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/reconcile`;
  }

  it('compares JSON-row sources and returns uncached structured results', async () => {
    await startServer();
    const body = {
      left: { type: 'rows', rows: [{ id: 'a', amount: 12 }] },
      right: { type: 'rows', rows: [{ id: 'a', amount: 13 }] },
      keyPairs: [{ left: 'id', right: 'id' }],
      fieldPairs: [{ left: 'amount', right: 'amount' }],
    };
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const result = await response.json() as { summary: { valueMismatches: number }; reportCsv: string };
    expect(result.summary.valueMismatches).toBe(1);
    expect(result.reportCsv).toContain('value_mismatch');
  });

  it('previews a CSV multipart upload without saving a file', async () => {
    await startServer();
    const form = new FormData();
    form.append('mode', 'inspect');
    form.append('source', JSON.stringify({ type: 'file', format: 'csv', name: 'synthetic.csv' }));
    form.append('file', new Blob(['id,amount\n1,12.50\n'], { type: 'text/csv' }), 'synthetic.csv');
    const response = await fetch(baseUrl, { method: 'POST', body: form });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const preview = await response.json() as { columns: string[]; rowCount: number };
    expect(preview.columns).toEqual(['id', 'amount']);
    expect(preview.rowCount).toBe(1);
  });

  it('rejects an HTTP body larger than the 4.25 MB policy', async () => {
    await startServer();
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: ' '.repeat(MAX_COMBINED_BYTES + 1),
    });
    expect(response.status).toBe(413);
    expect((await response.json() as { error: string }).error).toContain('4,25 MB');
  });
});
