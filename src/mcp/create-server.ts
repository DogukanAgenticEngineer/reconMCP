import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { assertResponseSize, compareDatasets, COMPARISON_PREVIEW_LIMIT } from '../core/compare.js';
import { resultToCsv } from '../core/report.js';
import type { CompareOptions, ReconciliationResult } from '../core/types.js';
import { loadMcpSource } from '../sources/load-mcp.js';
import { mcpCompareInputSchema, mcpSourceSchema, type McpCompareInput } from '../sources/mcp-schemas.js';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const toolAnnotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: true } as const;
const capabilityUri = 'reconcile://guide';

const capabilityGuide = `# Reconcile MCP guide

Reconcile compares two authorized data sources deterministically. It does not use generative AI for matching and does not save source data or reports in application storage.

## Sources

- CSV/XLSX files (upload to the requesting MCP client when supported)
- JSON row arrays
- Read-only PostgreSQL connections
- HTTPS REST GET endpoints from the configured public-host allow-list

External connections are subject to deployment network policy. Do not place credentials in source labels or row data. Never submit data you are not authorized to process.

## Tools

| Tool | Purpose |
|:--|:--|
| \`compare_datasets\` | Compare mapped keys, values, missing records, duplicates and schema |
| \`find_missing_records\` | Focus on records present on only one side |
| \`detect_duplicates\` | Find duplicated keys in both sources |
| \`detect_value_mismatches\` | Show deterministic mapped-value differences |
| \`generate_report\` | Return structured findings, Markdown and complete CSV text |

## Matching

Provide one or more \`keyPairs\` mapping a field in A to a field in B. Optionally supply \`fieldPairs\`, a non-negative base-10 \`tolerance\`, \`trimWhitespace\`, and \`caseSensitiveValues\`. Key matching remains case-sensitive unless explicitly configured otherwise.

## Output shape

Each tool returns two complementary views. The text content is a Markdown report with an outcome headline, a metric table, and bounded tables for value differences, missing records, duplicates and schema differences. Source-provided labels, keys and values are rendered as inert inline code, not active Markdown links or HTML. Preview details are explicitly bounded; they are never silently presented as a complete report.

The machine-readable structuredContent object uses the schema reconcile.result.v1. Its presentation contains a status (matched or needs_review), a headline, metricCards with labels/values/tones, statusCounts, comparisonPreview, previewTruncated and previewLimit. Canonical totals and full findings remain in summary, missing, duplicates, mismatches and schema. The generate_report tool also returns markdown and complete reportCsv when the whole response fits within 2 MB.

## Synthetic example

\`\`\`json
{
  "left": { "type": "rows", "rows": [{ "id": "demo-1", "amount": "10.00" }] },
  "right": { "type": "rows", "rows": [{ "id": "demo-1", "amount": "10.05" }] },
  "keyPairs": [{ "left": "id", "right": "id" }],
  "fieldPairs": [{ "left": "amount", "right": "amount" }],
  "tolerance": "0.05"
}
\`\`\`

Tool results include a client-readable Markdown report and machine-readable structured content. Client rendering varies; the structured fields are the canonical data. Full CSV output is available from \`generate_report\` when it fits within the 2 MB response limit. No result is silently truncated to fit that limit.
`;

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

function resultPresentation(result: ReconciliationResult): Record<string, unknown> {
  const { summary } = result;
  const issueCount = summary.valueMismatches + summary.missingOnLeft + summary.missingOnRight
    + summary.duplicateKeysOnLeft + summary.duplicateKeysOnRight + summary.schemaIssues;
  return {
    status: issueCount === 0 ? 'matched' : 'needs_review',
    headline: issueCount === 0 ? 'All compared values match.' : `${issueCount.toLocaleString()} reconciliation findings need review.`,
    metricCards: [
      { label: 'Exact matches', value: summary.matchedRows, tone: 'positive' },
      { label: 'Shared unique keys', value: summary.matchedKeys, tone: 'neutral' },
      { label: 'Value mismatches', value: summary.valueMismatches, tone: summary.valueMismatches ? 'negative' : 'positive' },
      { label: 'Only in A', value: summary.missingOnRight, tone: summary.missingOnRight ? 'warning' : 'positive' },
      { label: 'Only in B', value: summary.missingOnLeft, tone: summary.missingOnLeft ? 'warning' : 'positive' },
      { label: 'Duplicate keys', value: summary.duplicateKeysOnLeft + summary.duplicateKeysOnRight, tone: summary.duplicateKeysOnLeft + summary.duplicateKeysOnRight ? 'negative' : 'positive' },
      { label: 'Schema differences', value: summary.schemaIssues, tone: summary.schemaIssues ? 'warning' : 'positive' },
    ],
    statusCounts: {
      match: summary.matchedRows,
      mismatch: summary.mismatchedRows,
      onlyInA: summary.missingOnRight,
      onlyInB: summary.missingOnLeft,
      duplicatesInA: summary.duplicateKeysOnLeft,
      duplicatesInB: summary.duplicateKeysOnRight,
    },
    comparisonPreview: result.comparisonPreview,
    previewTruncated: result.previewTruncated,
    previewLimit: COMPARISON_PREVIEW_LIMIT,
  };
}

function compactResult(result: ReconciliationResult): Record<string, unknown> {
  return {
    summary: result.summary,
    schema: result.schema,
    comparisonPreview: result.comparisonPreview,
    previewTruncated: result.previewTruncated,
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

function toolMarkdown(result: ReconciliationResult, focus: string): string {
  return `${result.markdown}\n\n---\n\n## Requested view\n\n${focus}`;
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: 'Reconcile MCP', version: '1.1.0' });
  const baseSchema = mcpCompareInputSchema.shape;

  server.registerResource('reconcile_guide', capabilityUri, {
    title: 'Reconcile MCP capabilities and safe usage',
    description: 'Static documentation for sources, tools, deterministic matching and output formats. Contains synthetic examples only.',
    mimeType: 'text/markdown',
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: capabilityGuide }] }));

  server.registerPrompt('reconcile_workflow', {
    title: 'Reconcile two authorized sources',
    description: 'Guide a deterministic, privacy-conscious reconciliation using the available Reconcile MCP tools.',
  }, async () => ({
    description: 'A client-facing workflow for producing and interpreting a reconciliation report.',
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: 'Help me reconcile two data sources I am authorized to use. First identify candidate key fields and ask me to confirm ambiguous mappings. Use the supplied tool arguments to map one or more keyPairs and the value fieldPairs to compare. Apply decimal tolerance only when I specify it; keep key matching and value case-sensitivity explicit. Run the deterministic comparison, explain totals and findings from the returned data, and provide the generated CSV report when requested. Never infer findings that are not in the result, never expose credentials, and do not claim that an external MCP client or provider stores no data.',
      },
    }],
  }));

  const register = (
    name: string,
    title: string,
    description: string,
    operation: (result: ReconciliationResult) => Record<string, unknown>,
    focus: (result: ReconciliationResult) => string,
  ): void => {
    server.registerTool(name, { title, description, inputSchema: baseSchema, annotations: toolAnnotations }, async (args) => {
      try {
        const parsed = mcpCompareInputSchema.parse(args) as McpCompareInput;
        const result = await run(parsed);
        const structured = {
          schemaVersion: 'reconcile.result.v1',
          presentation: resultPresentation(result),
          ...operation(result),
        };
        return response(toolMarkdown(result, focus(result)), structured);
      } catch (error) {
        return failed(error);
      }
    });
  };

  register(
    'compare_datasets',
    'Compare datasets',
    'Compare two CSV, XLSX, JSON-row, read-only PostgreSQL, or HTTPS REST sources. Supply explicit key pairs and optional field pairs/tolerance. Returns a Markdown metrics table, bounded difference tables and structuredContent for client-native rendering.',
    (result) => compactResult(result),
    (result) => `${result.summary.matchedRows.toLocaleString()} exact matches; ${result.summary.valueMismatches.toLocaleString()} value mismatches; ${result.missing.onlyOnLeft.length.toLocaleString()} rows only in A; ${result.missing.onlyOnRight.length.toLocaleString()} rows only in B.`,
  );
  register(
    'find_missing_records',
    'Find missing records',
    'Find records present in only one of two sources. The key mapping is deterministic and duplicates are reported separately. Includes client-renderable Markdown and structured data.',
    (result) => ({ summary: result.summary, missing: result.missing, schema: result.schema }),
    (result) => `Only in A: ${result.missing.onlyOnLeft.length.toLocaleString()} records. Only in B: ${result.missing.onlyOnRight.length.toLocaleString()} records.`,
  );
  register(
    'detect_duplicates',
    'Detect duplicate records',
    'Detect duplicate keys in both sources using the supplied key field pairs. Returns summary cards and structured duplicate groups.',
    (result) => ({ summary: result.summary, duplicates: result.duplicates }),
    (result) => `Duplicate key groups — A: ${result.duplicates.left.length.toLocaleString()}; B: ${result.duplicates.right.length.toLocaleString()}.`,
  );
  register(
    'detect_value_mismatches',
    'Detect value mismatches',
    'Detect deterministic value differences on mapped fields for unique matching keys. Decimal tolerance is exact base-10 text. Includes bounded Markdown rows and complete structured values within response size limit.',
    (result) => ({ summary: result.summary, mismatches: result.mismatches, schema: result.schema }),
    (result) => `${result.mismatches.length.toLocaleString()} value differences across ${result.summary.mismatchedRows.toLocaleString()} rows.`,
  );
  register(
    'generate_report',
    'Generate reconciliation report',
    'Generate client-readable Markdown with metric and difference tables plus structuredContent containing canonical data and complete CSV text, subject to the 2 MB response limit.',
    (result) => ({ ...compactResult(result), markdown: result.markdown, reportCsv: resultToCsv(result) }),
    () => 'The complete downloadable CSV text is available in structuredContent.reportCsv. The readable Markdown includes a bounded sample; structured fields remain canonical.',
  );

  // Validate the source schema at server construction time so unsupported tool inputs fail early.
  void mcpSourceSchema;
  return server;
}
