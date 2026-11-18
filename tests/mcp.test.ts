import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_COMBINED_BYTES } from '../src/sources/csv.js';
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
      'estimate_operation_carbon', 'compare_datasets', 'find_missing_records',
      'detect_duplicates', 'detect_value_mismatches', 'generate_report',
      'compare_multiple_datasets',
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
    expect(guideText).toContain('estimated operational carbon footprint');
    expect(guideText).toContain('estimate_operation_carbon');

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
      presentation: {
        status: string;
        metricCards: Array<{ label: string; value: number }>;
        comparisonPreview: Array<{ status: string }>;
        charts: {
          statusDistribution: { type: string; labels: string[]; values: number[] };
          findingsByCategory: { type: string; labels: string[]; values: number[] };
          mismatchesByField: { type: string; labels: string[]; values: number[] };
        };
      };
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
    expect(structured.presentation.charts.statusDistribution.type).toBe('pie');
    expect(structured.presentation.charts.statusDistribution.values).toEqual([0, 1, 1, 1]);
    expect(structured.presentation.charts.findingsByCategory.type).toBe('bar');
    expect(structured.presentation.charts.mismatchesByField.labels).toEqual(['amount']);
    expect(structured.presentation.charts.mismatchesByField.values).toEqual([1]);
    expect(structured.mismatches).toHaveLength(1);
    expect((structured as typeof structured & { carbonEstimate: { phase: string; estimatedGramsCO2: number } }).carbonEstimate.phase).toBe('completed');
    expect((structured as typeof structured & { carbonEstimate: { phase: string; estimatedGramsCO2: number } }).carbonEstimate.estimatedGramsCO2).toBeGreaterThanOrEqual(0);

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

    const estimate = await client.callTool({
      name: 'estimate_operation_carbon',
      arguments: { operation: 'generate_report', expectedDurationSeconds: 10 },
    });
    expect(estimate.isError).not.toBe(true);
    const estimateStructured = estimate.structuredContent as {
      schemaVersion: string;
      operation: string;
      carbonEstimate: { phase: string; estimatedGramsCO2: number; durationMs: number };
    };
    expect(estimateStructured.schemaVersion).toBe('reconcile.carbon.v1');
    expect(estimateStructured.operation).toBe('generate_report');
    expect(estimateStructured.carbonEstimate.phase).toBe('planned');
    expect(estimateStructured.carbonEstimate.durationMs).toBe(10_000);
    expect(estimateStructured.carbonEstimate.estimatedGramsCO2).toBeGreaterThan(0);
    expect(JSON.stringify(estimate)).toContain('not metered');

    const multiToolCall = await client.callTool({
      name: 'compare_multiple_datasets',
      arguments: {
        sources: [
          { type: 'rows', rows: [{ id: '1', amount: '10' }], name: 'SourceA' },
          { type: 'rows', rows: [{ id: '1', amount: '10' }], name: 'SourceB' },
          { type: 'rows', rows: [{ id: '1', amount: '12' }], name: 'SourceC' },
        ],
        keyPairs: [{ left: 'id', right: 'id' }],
        fieldPairs: [{ left: 'amount', right: 'amount' }],
      },
    });
    expect(multiToolCall.isError).not.toBe(true);
    const multiStructured = multiToolCall.structuredContent as {
      totalSources: number;
      totalComparisons: number;
      aggregateSummary: { totalMatches: number; totalMismatches: number };
    };
    expect(multiStructured.totalSources).toBe(3);
    expect(multiStructured.totalComparisons).toBe(3);
    expect(multiStructured.aggregateSummary.totalMatches).toBe(1);
    expect(multiStructured.aggregateSummary.totalMismatches).toBe(2);

    const previousHosts = process.env.RECONCILE_ALLOWED_HOSTS;
    process.env.RECONCILE_ALLOWED_HOSTS = '';
    try {
      const failedCall = await client.callTool({
        name: 'compare_datasets',
        arguments: {
          left: { type: 'rows', rows: [{ id: 'demo' }] },
          right: { type: 'rest', url: 'https://api.example.com/data' },
          keyPairs: [{ left: 'id', right: 'id' }],
        },
      });
      expect(failedCall.isError).toBe(true);
      const failedStructured = failedCall.structuredContent as { carbonEstimate: { phase: string; operation: string } };
      expect(failedStructured.carbonEstimate.phase).toBe('completed');
      expect(failedStructured.carbonEstimate.operation).toBe('compare_datasets');
    } finally {
      if (previousHosts === undefined) delete process.env.RECONCILE_ALLOWED_HOSTS;
      else process.env.RECONCILE_ALLOWED_HOSTS = previousHosts;
    }
  });

  it('enforces exact Origin allowlisting and reflects only approved CORS origins', async () => {
    const previous = process.env.MCP_ALLOWED_ORIGINS;
    process.env.MCP_ALLOWED_ORIGINS = 'https://trusted.example';
    try {
      httpServer = createServer((req, res) => { void handleMcpRequest(req, res); });
      httpServer.listen(0, '127.0.0.1');
      await once(httpServer, 'listening');
      const address = httpServer.address() as AddressInfo;
      const url = `http://127.0.0.1:${address.port}/api/mcp`;
      const allowed = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'https://trusted.example' } });
      expect(allowed.status).toBe(204);
      expect(allowed.headers.get('access-control-allow-origin')).toBe('https://trusted.example');
      expect(allowed.headers.get('access-control-allow-origin')).not.toBe('*');

      const denied = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'https://attacker.example' } });
      expect(denied.status).toBe(403);
      expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    } finally {
      if (previous === undefined) delete process.env.MCP_ALLOWED_ORIGINS;
      else process.env.MCP_ALLOWED_ORIGINS = previous;
    }
  });

  it('uses the documented 4.25 MiB request cap instead of the SDK 4 MiB default', async () => {
    httpServer = createServer((req, res) => { void handleMcpRequest(req, res); });
    httpServer.listen(0, '127.0.0.1');
    await once(httpServer, 'listening');
    const address = httpServer.address() as AddressInfo;
    const body = ' '.repeat(4 * 1024 * 1024 + 1);
    expect(Buffer.byteLength(body)).toBeLessThan(MAX_COMBINED_BYTES);
    const response = await fetch(`http://127.0.0.1:${address.port}/api/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body,
    });
    expect(response.status).not.toBe(413);
  });
});
