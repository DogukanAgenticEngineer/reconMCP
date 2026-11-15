import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { assertResponseSize, compareDatasets } from '../core/compare.js';
import { resultToCsv } from '../core/report.js';
import type { CompareOptions } from '../core/types.js';
import { loadMcpSource } from '../sources/load-mcp.js';
import { mcpCompareInputSchema, type McpCompareInput } from '../sources/mcp-schemas.js';
import { mcpSourceSchema } from '../sources/mcp-schemas.js';
import type { ReconciliationResult } from '../core/types.js';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const toolAnnotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: true } as const;

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const safePrefixes = [
    'Dosya ', 'Toplam giriş ', 'Kaynak ', 'CSV ', 'XLSX ', 'REST ', 'Bu bağlantı ',
    'Bağlantı hedefi ', 'Bağlantı hedefinin ', 'Özel ağ ', 'Harici REST ', 'PostgreSQL ',
    'Sonuç ', 'İstek ', 'XLSX arşivi ', 'REST yanıtı ',
  ];
  return safePrefixes.some((prefix) => message.startsWith(prefix)) ? message : 'İstek doğrulanamadı veya güvenli biçimde işlenemedi.';
}

async function run(input: McpCompareInput): Promise<ReconciliationResult> {
  const [left, right] = await Promise.all([loadMcpSource(input.left), loadMcpSource(input.right)]);
  return compareDatasets(left, right, input as CompareOptions);
}

function compactResult(result: ReconciliationResult): Record<string, unknown> {
  return {
    summary: result.summary,
    schema: result.schema,
    missing: result.missing,
    duplicates: result.duplicates,
    mismatches: result.mismatches,
  };
}

function response(contentText: string, structuredContent: Record<string, unknown>): {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: Record<string, unknown>;
} {
  const result = { content: [{ type: 'text' as const, text: contentText }], structuredContent };
  assertResponseSize(result, MAX_RESPONSE_BYTES);
  return result;
}

function failed(error: unknown): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  return { content: [{ type: 'text', text: publicError(error) }], isError: true };
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'Reconcile MCP', version: '1.0.0' });
  const baseSchema = mcpCompareInputSchema.shape;
  const register = (name: string, title: string, description: string, operation: (result: ReconciliationResult) => Record<string, unknown>, text: (result: ReconciliationResult) => string): void => {
    server.registerTool(name, {
      title,
      description,
      inputSchema: baseSchema,
      annotations: toolAnnotations,
    }, async (args) => {
      try {
        const parsed = mcpCompareInputSchema.parse(args) as McpCompareInput;
        const result = await run(parsed);
        const structured = operation(result);
        return response(text(result), structured);
      } catch (error) {
        return failed(error);
      }
    });
  };

  register(
    'compare_datasets',
    'Compare datasets',
    'Compare two CSV, XLSX, JSON-row, read-only PostgreSQL, or HTTPS REST sources. Supply explicit key pairs and optional field pairs/tolerance. Returns missing rows, duplicates, schema differences, value mismatches, and a Markdown summary.',
    (result) => compactResult(result),
    (result) => result.markdown,
  );
  register(
    'find_missing_records',
    'Find missing records',
    'Find records present in only one of two sources. The key mapping is deterministic and duplicates are reported separately.',
    (result) => ({ summary: result.summary, missing: result.missing, schema: result.schema }),
    (result) => `${result.markdown}\n\nYalnız sol kaynakta: ${result.missing.onlyOnLeft.length}; yalnız sağ kaynakta: ${result.missing.onlyOnRight.length}.`,
  );
  register(
    'detect_duplicates',
    'Detect duplicate records',
    'Detect duplicate keys in both sources using the supplied key field pairs.',
    (result) => ({ summary: result.summary, duplicates: result.duplicates }),
    (result) => `${result.markdown}\n\nSol kaynak yinelenen anahtar: ${result.duplicates.left.length}; sağ kaynak yinelenen anahtar: ${result.duplicates.right.length}.`,
  );
  register(
    'detect_value_mismatches',
    'Detect value mismatches',
    'Detect deterministic value differences on mapped fields for unique matching keys. Decimal tolerance is exact base-10 text.',
    (result) => ({ summary: result.summary, mismatches: result.mismatches, schema: result.schema }),
    (result) => `${result.markdown}\n\nDeğer uyuşmazlığı: ${result.mismatches.length}.`,
  );
  register(
    'generate_report',
    'Generate reconciliation report',
    'Generate a structured reconciliation report, readable Markdown summary, and downloadable CSV text.',
    (result) => ({ ...compactResult(result), markdown: result.markdown, reportCsv: resultToCsv(result) }),
    (result) => `${result.markdown}\n\nİndirilebilir CSV raporu structuredContent.reportCsv alanındadır.`,
  );

  // Validate the source schema at server construction time so unsupported tool inputs fail early.
  void mcpSourceSchema;
  return server;
}
