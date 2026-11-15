import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_COMBINED_BYTES, MAX_FILE_BYTES } from '../src/sources/csv.js';
import { exactHostname, resolveAllowedPublicHost } from '../src/sources/network.js';
import { restSourceSchema, rowsSourceSchema } from '../src/sources/schemas.js';

const root = process.cwd();

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

  it('runtime paths contain no body/credential logging, durable storage, telemetry, or third-party AI clients', () => {
    const runtimeFiles = [
      'api/mcp.ts', 'api/reconcile.ts', 'src/server/mcp-handler.ts',
      'src/server/reconcile-handler.ts', 'src/sources/load.ts', 'src/sources/load-mcp.ts',
      'src/mcp/create-server.ts', 'src/ui/App.tsx', 'src/ui/SourceCard.tsx', 'src/ui/ResultsPanel.tsx', 'src/ui/main.tsx', 'src/core/report.ts',
    ];
    for (const file of runtimeFiles) {
      const source = readFileSync(resolve(root, file), 'utf8');
      expect(source, file).not.toMatch(/console\.(?:log|info|warn|error)\s*\(/);
      expect(source, file).not.toMatch(/\b(?:writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream)\s*\(/);
      expect(source, file).not.toMatch(/\b(?:localStorage|sessionStorage|indexedDB)\b/);
      expect(source, file).not.toMatch(/\b(?:gtag|posthog|mixpanel|segment\.track|Sentry\.init)\b/i);
    }
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    expect(html).not.toMatch(/analytics|tracking|telemetry/i);
    const app = readFileSync(resolve(root, 'src/ui/App.tsx'), 'utf8');
    expect(app.match(/<Button\b/g) ?? []).toHaveLength(2);
    expect(app).toContain("'CONNECT MCP'");
    expect(app).toContain("'RUN'");
    expect(readFileSync(resolve(root, 'src/ui/ResultsPanel.tsx'), 'utf8')).toMatch(/<Tabs\.Root/);
    expect(app).toMatch(/<Switch\b/);
    expect(readFileSync(resolve(root, 'src/ui/SourceCard.tsx'), 'utf8')).toMatch(/onDrop=/);
    const styles = readFileSync(resolve(root, 'src/ui/styles.css'), 'utf8');
    const runStyle = styles.match(/\.run-button\.rt-Button\s*\{[^}]+\}/)?.[0] ?? '';
    const glowStyle = styles.match(/\.run-button\.rt-Button:hover[^{]+\{[^}]+\}/)?.[0] ?? '';
    expect(runStyle).toMatch(/border:\s*3px solid transparent/);
    expect(runStyle).toMatch(/linear-gradient/);
    expect(glowStyle).toMatch(/box-shadow:[^;]*rgba/);
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { dependencies: Record<string, unknown> };
    expect(JSON.stringify(Object.keys(manifest.dependencies))).not.toMatch(/openai|anthropic|gemini|cohere/i);
  });
});
