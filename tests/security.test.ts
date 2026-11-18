import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_COMBINED_BYTES, MAX_FILE_BYTES } from '../src/sources/csv.js';
import { exactHostname, resolveAllowedPublicHost } from '../src/sources/network.js';
import { restSourceSchema, rowsSourceSchema } from '../src/sources/schemas.js';

const root = process.cwd();

const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');

describe('source security boundaries', () => {
  it('enforces the agreed Vercel payload budget and per-file cap', () => {
    expect(MAX_FILE_BYTES).toBe(4 * 1024 * 1024);
    expect(MAX_COMBINED_BYTES).toBe(Math.floor(4.25 * 1024 * 1024));
  });

  it('requires HTTPS, no URL credentials, and the standard REST port', () => {
    expect(exactHostname(new URL('https://api.example.com/data'))).toBe('api.example.com');
    expect(() => exactHostname(new URL('http://api.example.com/data'))).toThrow(/HTTPS/);
    expect(() => exactHostname(new URL('https://user:secret@api.example.com/data'))).toThrow(/HTTPS/);
    expect(() => exactHostname(new URL('https://api.example.com:8443/data'))).toThrow(/HTTPS/);
  });

  it('rejects private IPs and targets absent from the explicit host allow-list', async () => {
    const before = process.env.RECONCILE_ALLOWED_HOSTS;
    process.env.RECONCILE_ALLOWED_HOSTS = '';
    try {
      await expect(resolveAllowedPublicHost('127.0.0.1')).rejects.toThrow(/izin listesinde/);
      await expect(resolveAllowedPublicHost('localhost')).rejects.toThrow(/izin listesinde/);
      await expect(resolveAllowedPublicHost('api.example.com')).rejects.toThrow(/izin listesinde/);
    } finally {
      if (before === undefined) delete process.env.RECONCILE_ALLOWED_HOSTS;
      else process.env.RECONCILE_ALLOWED_HOSTS = before;
    }
  });

  it('rejects unsupported REST headers and object-valued dataset cells', () => {
    expect(() => restSourceSchema.parse({ type: 'rest', url: 'https://api.example.com', headers: { cookie: 'session' } })).toThrow();
    expect(() => rowsSourceSchema.parse({ type: 'rows', rows: [{ id: { nested: true } }] })).toThrow();
  });

  it('keeps runtime free of body/credential logging, durable storage, telemetry and third-party AI clients', () => {
    const runtimeFiles = [
      'api/mcp.ts', 'api/reconcile.ts', 'src/server/mcp-handler.ts',
      'src/server/reconcile-handler.ts', 'src/sources/load.ts', 'src/sources/load-mcp.ts',
      'src/mcp/create-server.ts', 'src/mcp/carbon.ts', 'src/ui/App.tsx', 'src/ui/SourceCard.tsx',
      'src/ui/ResultsPanel.tsx', 'src/ui/AnalyticsReport.tsx', 'src/ui/ReconciliationSettings.tsx', 'src/ui/McpConnectDialog.tsx',
      'src/ui/main.tsx', 'src/core/report.ts', 'src/components/ui/alert.tsx',
      'src/components/ui/data-table.tsx', 'src/components/ui/progress.tsx', 'src/components/ui/spinner.tsx',
    ];
    for (const file of runtimeFiles) {
      const source = read(file);
      expect(source, file).not.toMatch(/console\.(?:log|info|warn|error)\s*\(/);
      expect(source, file).not.toMatch(/\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream)\s*\(/);
      expect(source, file).not.toMatch(/\b(?:localStorage|sessionStorage|indexedDB)\b/);
      expect(source, file).not.toMatch(/\b(?:gtag|posthog|mixpanel|segment\.track|Sentry\.init)\b/i);
    }
    const html = read('index.html');
    expect(html).not.toMatch(/analytics|tracking|telemetry/i);

    const app = read('src/ui/App.tsx');
    const connect = read('src/ui/McpConnectDialog.tsx');
    expect(app).toContain("'RUN'");
    expect(app).toContain('<Switch');
    expect(app).toContain('/reconcile-agent-icon.png');
    expect(app).toContain('<Breadcrumb items=');
    expect(connect).toContain('CONNECT MCP');
    expect(connect).toContain('Client-ready result');
    expect(connect).toContain('reconcile.result.v1');
    expect(connect).toContain('<Alert');
    expect(app).toContain('/api/mcp');
    expect(connect).toContain('{endpoint}');
    expect(read('index.html')).toContain('reconcile-agent-icon.png');
    expect(read('app.config.ts')).toContain('.png');
    expect(read('src/ui/ResultsPanel.tsx')).toContain('<Tabs');
    expect(read('src/ui/ResultsPanel.tsx')).toContain('AnalyticsReport');
    expect(read('src/ui/AnalyticsReport.tsx')).toContain("type: 'scatter3d'");
    expect(read('src/ui/AnalyticsReport.tsx')).toContain("type: 'surface'");
    expect(read('src/ui/AnalyticsReport.tsx')).toContain('cumulativePercent');
    expect(read('index.html')).toContain('cdn.plot.ly/plotly-');
    expect(read('src/ui/SourceCard.tsx')).toMatch(/onDrop=/);
    expect(read('src/ui/SourceCard.tsx')).toContain('<Alert');
    expect(read('src/ui/ReconciliationSettings.tsx')).toContain('Numeric tolerance');
    const table = read('src/components/ui/data-table.tsx');
    expect(table).toContain('getSortedRowModel');
    expect(table).toContain('getPaginationRowModel');
    expect(read('src/components/ui/progress.tsx')).toContain('@base-ui/react/progress');
    expect(read('src/components/ui/spinner.tsx')).toContain('LoaderCircle');
    expect(read('src/components/ui/alert.tsx')).toContain('role="alert"');

    const server = read('src/mcp/create-server.ts');
    expect(server).toContain('registerResource');
    expect(server).toContain('registerPrompt');
    expect(server).toContain('## Output shape');
    expect(server).toContain('statusCounts');
    expect(server).toContain('structuredContent');
    expect(server).toContain('estimate_operation_carbon');
    expect(server).toContain('carbonEstimate');
    const mcpHandler = read('src/server/mcp-handler.ts');
    expect(mcpHandler).toContain('MCP_ALLOWED_ORIGINS');
    expect(mcpHandler).not.toContain("setHeader('Access-Control-Allow-Origin', '*')");

    const styles = read('src/ui/styles.css');
    const runStyle = styles.match(/\.run-button \{[^}]+\}/)?.[0] ?? '';
    const glowStyle = styles.match(/\.run-button:hover:not\(:disabled\) \{[^}]+\}/)?.[0] ?? '';
    expect(runStyle).toMatch(/border:\s*3px solid transparent/);
    expect(runStyle).toMatch(/linear-gradient/);
    expect(glowStyle).toMatch(/box-shadow:[^;]*rgb/);
    expect(styles).toContain('prefers-reduced-motion: reduce');

    const manifest = JSON.parse(read('package.json')) as { dependencies: Record<string, unknown> };
    expect(JSON.stringify(Object.keys(manifest.dependencies))).not.toMatch(/openai|anthropic|gemini|cohere|@radix-ui\/themes/i);
  });
});
