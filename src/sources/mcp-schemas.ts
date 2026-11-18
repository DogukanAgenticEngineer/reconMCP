import { z } from 'zod';
import { fieldPairSchema, postgresSourceSchema, restSourceSchema, rowsSourceSchema } from './schemas.js';

const MAX_MCP_TEXT_BYTES = 3 * 1024 * 1024;
const MAX_MCP_BASE64_CHARS = 4 * 1024 * 1024;

const csvSourceSchema = z.object({
  type: z.literal('csv'),
  content: z.string().max(MAX_MCP_TEXT_BYTES).refine((value) => new TextEncoder().encode(value).byteLength <= MAX_MCP_TEXT_BYTES),
  name: z.string().max(128).optional(),
}).strict();

const xlsxSourceSchema = z.object({
  type: z.literal('xlsx'),
  contentBase64: z.string().max(MAX_MCP_BASE64_CHARS),
  name: z.string().max(128).optional(),
}).strict();

export const mcpSourceSchema = z.discriminatedUnion('type', [
  rowsSourceSchema,
  csvSourceSchema,
  xlsxSourceSchema,
  postgresSourceSchema,
  restSourceSchema,
]);

export const mcpCompareInputSchema = z.object({
  left: mcpSourceSchema,
  right: mcpSourceSchema,
  keyPairs: z.array(fieldPairSchema).min(1).max(10).optional(),
  fieldPairs: z.array(fieldPairSchema).max(100).optional(),
  tolerance: z.string().regex(/^\d{1,30}(?:\.\d{1,18})?$/).max(50).optional(),
  trimWhitespace: z.boolean().default(true),
  caseSensitiveKeys: z.boolean().default(true),
  caseSensitiveValues: z.boolean().default(true),
}).strict();

export type McpSource = z.infer<typeof mcpSourceSchema>;
export type McpCompareInput = z.infer<typeof mcpCompareInputSchema>;

export const mcpMultiCompareInputSchema = z.object({
  sources: z.array(mcpSourceSchema).min(2).max(10),
  keyPairs: z.array(fieldPairSchema).min(1).max(10).optional(),
  fieldPairs: z.array(fieldPairSchema).max(100).optional(),
  tolerance: z.string().regex(/^\d{1,30}(?:\.\d{1,18})?$/).max(50).optional(),
  trimWhitespace: z.boolean().default(true),
  caseSensitiveKeys: z.boolean().default(true),
  caseSensitiveValues: z.boolean().default(true),
}).strict();

export type McpMultiCompareInput = z.infer<typeof mcpMultiCompareInputSchema>;
