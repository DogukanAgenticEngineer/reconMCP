import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, describe, expect, it } from 'vitest';
import { handleMcpRequest } from '../src/server/mcp-handler.js';

describe('MCP Streamable HTTP protocol', () => {
  let httpServer: ReturnType<typeof createServer> | undefined;
  let client: Client | undefined;

  afterEach(async () => {
    await client?.close().catch(() => undefined);
    client = undefined;
    if (httpServer?.listening) {
      httpServer.close();
      await once(httpServer, 'close');
    }
    httpServer = undefined;
  });

  it('initializes, lists tools and returns structured deterministic comparison data', async () => {
    httpServer = createServer((req, res) => { void handleMcpRequest(req, res); });
    httpServer.listen(0, '127.0.0.1');
    await once(httpServer, 'listening');
    const address = httpServer.address() as AddressInfo;
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/api/mcp`));
    client = new Client({ name: 'reconcile-test', version: '1.0.0' });
    await client.connect(transport);

    const listing = await client.listTools();
    expect(listing.tools.map((tool) => tool.name)).toEqual([
      'compare_datasets', 'find_missing_records', 'detect_duplicates',
      'detect_value_mismatches', 'generate_report',
    ]);
    const result = await client.callTool({
      name: 'compare_datasets',
      arguments: {
        left: { type: 'rows', rows: [{ id: 'a', amount: 10 }] },
        right: { type: 'rows', rows: [{ id: 'a', amount: 12 }] },
        keyPairs: [{ left: 'id', right: 'id' }],
        fieldPairs: [{ left: 'amount', right: 'amount' }],
      },
    });
    expect(result.isError).not.toBe(true);
    const structured = result.structuredContent as { summary: { valueMismatches: number; matchedKeys: number; mismatchedRows: number }; comparisonPreview: Array<{ status: string }>; mismatches: unknown[] };
    expect(structured.summary.valueMismatches).toBe(1);
    expect(structured.summary.matchedKeys).toBe(1);
    expect(structured.summary.mismatchedRows).toBe(1);
    expect(structured.comparisonPreview[0]?.status).toBe('mismatch');
    expect(structured.mismatches).toHaveLength(1);
    const content = result.content as Array<{ type: string; text?: string }>;
    expect(content.some((entry) => entry.type === 'text' && entry.text?.includes('Mutabakat'))).toBe(true);
  });
});
