import { z } from 'zod';

const hasControlCharacter = (value: string): boolean => Array.from(value).some((character) => character.charCodeAt(0) <= 31);
const columnName = z.string().min(1).max(256).refine((value) => !hasControlCharacter(value), 'Invalid column name');
const scalarSchema = z.union([z.string().max(65_536), z.number().finite(), z.boolean(), z.null()]);
const rowSchema = z.record(columnName, scalarSchema);

export const rowsSourceSchema = z.object({
  type: z.literal('rows'),
  name: z.string().max(128).optional(),
  columns: z.array(columnName).max(100).optional(),
  rows: z.array(rowSchema).max(10_000),
}).strict();

export const fileSourceSchema = z.object({
  type: z.literal('file'),
  format: z.enum(['csv', 'xlsx']),
  name: z.string().max(128).optional(),
}).strict();

export const postgresSourceSchema = z.object({
  type: z.literal('postgres'),
  host: z.string().min(1).max(253),
  port: z.number().int().min(1).max(65_535).default(5432),
  database: z.string().min(1).max(128),
  user: z.string().min(1).max(128),
  password: z.string().max(512),
  ssl: z.literal(true),
  schema: z.string().min(1).max(128).refine((value) => !hasControlCharacter(value)),
  table: z.string().min(1).max(128).refine((value) => !hasControlCharacter(value)),
  columns: z.array(columnName).max(100).optional(),
  name: z.string().max(128).optional(),
}).strict();

const headersSchema = z.record(z.string().max(64), z.string().max(2048))
  .refine((headers) => Object.keys(headers).length <= 12, 'At most 12 headers are permitted')
  .refine((headers) => Object.keys(headers).every((header) => ['accept', 'authorization', 'x-api-key'].includes(header.toLowerCase())), 'Unsupported REST header');

export const restSourceSchema = z.object({
  type: z.literal('rest'),
  url: z.string().url().max(2048),
  headers: headersSchema.optional(),
  name: z.string().max(128).optional(),
}).strict();

export const sourceDefinitionSchema = z.discriminatedUnion('type', [
  rowsSourceSchema,
  fileSourceSchema,
  postgresSourceSchema,
  restSourceSchema,
]);

export const fieldPairSchema = z.object({ left: columnName, right: columnName }).strict();
export const compareOptionsSchema = z.object({
  keyPairs: z.array(fieldPairSchema).min(1).max(10),
  fieldPairs: z.array(fieldPairSchema).max(100).optional(),
  tolerance: z.string().regex(/^\d{1,30}(?:\.\d{1,18})?$/).max(50).optional(),
  trimWhitespace: z.boolean().default(true),
  caseSensitiveKeys: z.boolean().default(true),
}).strict();

export const reconcileRequestSchema = z.object({
  left: sourceDefinitionSchema,
  right: sourceDefinitionSchema,
  keyPairs: compareOptionsSchema.shape.keyPairs,
  fieldPairs: compareOptionsSchema.shape.fieldPairs,
  tolerance: compareOptionsSchema.shape.tolerance,
  trimWhitespace: compareOptionsSchema.shape.trimWhitespace,
  caseSensitiveKeys: compareOptionsSchema.shape.caseSensitiveKeys,
}).strict();

export type SourceDefinition = z.infer<typeof sourceDefinitionSchema>;
export type ReconcileRequest = z.infer<typeof reconcileRequestSchema>;
export type CompareOptionsInput = z.infer<typeof compareOptionsSchema>;
