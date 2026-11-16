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

  it('discovers the guide/prompt and returns client-renderable Markdown and structured reconciliation data', async () => {
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

    const resources = await client.listResources();
    expect(resources.resources.some((resource) => resource.uri === 'reconcile://guide')).toBe(true);
    const guide = await client.readResource({ uri: 'reconcile://guide' });
    const guideContent = guide.contents[0];
    const guideText = guideContent && 'text' in guideContent ? guideContent.text : '';
    expect(guideText).toContain('Synthetic example');
    expect(guideText).toContain('structured content');
    expect(guideText).toContain('## Output shape');
    expect(guideText).toContain('presentation');
    expect(guideText).toContain('metricCards');
    expect(guideText).toContain('reportCsv');

    const prompts = await client.listPrompts();
    expect(prompts.prompts.some((prompt) => prompt.name === 'reconcile_workflow')).toBe(true);
    const prompt = await client.getPrompt({ name: 'reconcile_workflow' });
    const promptText = prompt.messages.map((message) => typeof message.content === 'string' ? message.content : message.content.type === 'text' ? message.content.text : '').join('\n');
    expect(promptText).toContain('deterministic comparison');
    expect(promptText).toContain('never expose credentials');

    const input = {
      left: { type: 'rows' as const, rows: [{ id: 'demo-a', amount: '10.00', label: 'North' }, { id: 'demo-b', amount: '20.00', label: 'West' }] },
      right: { type: 'rows' as const, rows: [{ id: 'demo-a', amount: '12.00', label: 'North' }, { id: 'demo-c', amount: '30.00', label: 'East' }] },
      keyPairs: [{ left: 'id', right: 'id' }],
      fieldPairs: [{ left: 'amount', right: 'amount' }, { left: 'label', right: 'label' }],
    };
    const result = await client.callTool({ name: 'compare_datasets', arguments: input });
    expect(result.isError).not.toBe(true);
    const structured = result.structuredContent as {
      schemaVersion: string;
      presentation: { status: string; metricCards: Array<{ label: string; value: number }>; comparisonPreview: Array<{ status: string }> };
      summary: { valueMismatches: number; matchedKeys: number; mismatchedRows: number };
      comparisonPreview: Array<{ status: string }>;
      mismatches: unknown[];
    };
    expect(structured.schemaVersion).toBe('reconcile.result.v1');
    expect(structured.presentation.status).toBe('needs_review');
    expect(structured.presentation.metricCards.some((metric) => metric.label === 'Exact matches')).toBe(true);
    expect(structured.summary.valueMismatches).toBe(1);
    expect(structured.summary.matchedKeys).toBe(1);
    expect(structured.summary.mismatchedRows).toBe(1);
    expect(structured.comparisonPreview[0]?.status).toBe('mismatch');
    expect(structured.presentation.comparisonPreview[0]?.status).toBe('mismatch');
    expect(structured.mismatches).toHaveLength(1);

    const content = result.content as Array<{ type: string; text?: string }>;
    const markdown = content.find((entry) => entry.type === 'text')?.text ?? '';
    expect(markdown).toContain('# Reconciliation result');
    expect(markdown).toContain('| Metric | Result |');
    expect(markdown).toContain('## Value differences');
    expect(markdown).toContain('## Missing records');
    expect(markdown).toContain('## Requested view');

    const report = await client.callTool({ name: 'generate_report', arguments: input });
    expect(report.isError).not.toBe(true);
    const reportStructured = report.structuredContent as { reportCsv: string; markdown: string; presentation: { metricCards: unknown[] } };
    expect(reportStructured.reportCsv).toContain('value_mismatch');
    expect(reportStructured.markdown).toContain('| Metric | Result |');
    expect(reportStructured.presentation.metricCards.length).toBeGreaterThan(3);
  });
});
