import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  dnsLookup: vi.fn(),
  clientConfig: undefined as unknown,
  connectCount: 0,
  endCount: 0,
  connectError: undefined as Error | undefined,
  queries: [] as unknown[],
  streamConfig: undefined as { sql: string; values: unknown[]; options: unknown } | undefined,
  streamRows: [] as unknown[][],
}));

vi.mock('node:dns/promises', () => ({ lookup: state.dnsLookup }));
vi.mock('pg-query-stream', () => ({
  default: class MockQueryStream {
    constructor(sql: string, values: unknown[], options: unknown) {
      state.streamConfig = { sql, values, options };
    }
    destroy(): void {}
  },
}));
vi.mock('pg', () => ({
  Client: class MockClient {
    constructor(config: unknown) {
      state.clientConfig = config;
    }
    connect(): Promise<void> {
      state.connectCount += 1;
      if (state.connectError) return Promise.reject(state.connectError);
      return Promise.resolve();
    }
    query(query: unknown): unknown {
      state.queries.push(query);
      if (typeof query === 'string' && query.startsWith('SELECT * FROM ')) {
        return Promise.resolve({ fields: [{ name: 'id' }, { name: 'amount' }] });
      }
      if (typeof query === 'object' && query !== null) {
        return {
          async *[Symbol.asyncIterator](): AsyncGenerator<unknown[]> {
            for (const row of state.streamRows) yield row;
          },
        };
      }
      return Promise.resolve({ rows: [] });
    }
    end(): Promise<void> {
      state.endCount += 1;
      return Promise.resolve();
    }
  },
}));

import { loadSource } from '../src/sources/load.js';

const originalFetch = globalThis.fetch;
const originalAllowedHosts = process.env.RECONCILE_ALLOWED_HOSTS;
const originalAllowedPorts = process.env.RECONCILE_ALLOWED_POSTGRES_PORTS;
const fetchStub = vi.fn();
const publicDnsAnswer = [{ address: '93.184.216.34', family: 4 }];

beforeEach(() => {
  vi.clearAllMocks();
  state.clientConfig = undefined;
  state.connectCount = 0;
  state.endCount = 0;
  state.connectError = undefined;
  state.queries = [];
  state.streamConfig = undefined;
  state.streamRows = [];
  state.dnsLookup.mockResolvedValue(publicDnsAnswer);
  fetchStub.mockReset();
  globalThis.fetch = fetchStub as unknown as typeof fetch;
  process.env.RECONCILE_ALLOWED_HOSTS = 'api.example.com,db.example.com';
  process.env.RECONCILE_ALLOWED_POSTGRES_PORTS = '5432';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalAllowedHosts === undefined) delete process.env.RECONCILE_ALLOWED_HOSTS;
  else process.env.RECONCILE_ALLOWED_HOSTS = originalAllowedHosts;
  if (originalAllowedPorts === undefined) delete process.env.RECONCILE_ALLOWED_POSTGRES_PORTS;
  else process.env.RECONCILE_ALLOWED_POSTGRES_PORTS = originalAllowedPorts;
});

describe('external source security and reads', () => {
  it('fetches only an allow-listed HTTPS REST host through the pinned public dispatcher', async () => {
    fetchStub.mockResolvedValue(new Response(JSON.stringify([{ id: 'A-1', amount: '19.95' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const result = await loadSource({
      type: 'rest',
      url: 'https://api.example.com/records',
      headers: { authorization: 'Bearer synthetic-only' },
    });

    expect(state.dnsLookup).toHaveBeenCalledWith('api.example.com', { all: true, verbatim: true });
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [requestedUrl, requestInit] = fetchStub.mock.calls[0] as [string, RequestInit & { dispatcher?: unknown }];
    expect(requestedUrl).toBe('https://api.example.com/records');
    expect(requestInit).toMatchObject({ method: 'GET', redirect: 'manual' });
    expect((requestInit.headers as Record<string, string>).authorization).toBe('Bearer synthetic-only');
    expect(requestInit.dispatcher).toBeDefined();
    expect(result.rows).toEqual([{ id: 'A-1', amount: '19.95' }]);
  });

  it('rejects non-HTTPS or non-allow-listed REST targets before any outbound request', async () => {
    await expect(loadSource({ type: 'rest', url: 'http://api.example.com/records' })).rejects.toThrow(/HTTPS/);
    await expect(loadSource({ type: 'rest', url: 'https://other.example.com/records' })).rejects.toThrow(/izin listesinde/);
    expect(state.dnsLookup).not.toHaveBeenCalled();
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('rejects DNS answers containing a private address to prevent rebinding and never follows redirects', async () => {
    state.dnsLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);
    await expect(loadSource({ type: 'rest', url: 'https://api.example.com/records' })).rejects.toThrow(/public IP/);
    expect(fetchStub).not.toHaveBeenCalled();

    state.dnsLookup.mockResolvedValue(publicDnsAnswer);
    fetchStub.mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'https://127.0.0.1/internal' },
    }));
    await expect(loadSource({ type: 'rest', url: 'https://api.example.com/records' })).rejects.toThrow(/yönlendirme/);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(fetchStub.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
  });

  it('uses PostgreSQL TLS, begins a read-only transaction, quotes identifiers and binds the row limit', async () => {
    state.streamRows = [['A-1', false, '100.25', false]];
    const result = await loadSource({
      type: 'postgres',
      host: 'db.example.com',
      port: 5432,
      database: 'synthetic',
      user: 'readonly',
      password: 'synthetic-only',
      ssl: true,
      schema: 'public',
      table: 'pay"; DROP TABLE users;--',
    });

    const connection = state.clientConfig as { host: string; ssl: { rejectUnauthorized: boolean; servername: string } };
    expect(connection.host).toBe('93.184.216.34');
    expect(connection.ssl).toEqual({ rejectUnauthorized: true, servername: 'db.example.com' });
    expect(state.queries).toContain('BEGIN READ ONLY');
    const stream = state.streamConfig;
    expect(stream?.sql).toContain('FROM "public"."pay""; DROP TABLE users;--" LIMIT $1');
    expect(stream?.sql).toMatch(/LIMIT \$1$/);
    expect(stream?.sql).not.toContain('pay"; DROP TABLE users;--"');
    expect(stream?.values).toEqual([10_001]);
    expect(stream?.options).toMatchObject({ rowMode: 'array', batchSize: 1, highWaterMark: 1 });
    expect(state.queries).toContain('ROLLBACK');
    expect(state.endCount).toBe(1);
    expect(result.rows).toEqual([{ id: 'A-1', amount: '100.25' }]);
  });

  it('rejects unapproved PostgreSQL ports and strict-schema arbitrary SQL before connection', async () => {
    const source = {
      type: 'postgres', host: 'db.example.com', port: 5433, database: 'synthetic',
      user: 'readonly', password: 'synthetic-only', ssl: true, schema: 'public', table: 'records',
    };
    await expect(loadSource(source)).rejects.toThrow(/portu.*izin listesinde/i);
    expect(state.connectCount).toBe(0);

    await expect(loadSource({ ...source, port: 5432, query: 'DROP TABLE records' })).rejects.toThrow();
    expect(state.connectCount).toBe(0);
  });

  it('masks PostgreSQL connection errors rather than returning password or driver detail', async () => {
    state.connectError = new Error('synthetic-only password rejected');
    try {
      await loadSource({
        type: 'postgres', host: 'db.example.com', port: 5432, database: 'synthetic',
        user: 'readonly', password: 'synthetic-only', ssl: true, schema: 'public', table: 'records',
      });
      throw new Error('Expected connection failure.');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/salt okunur modda güvenli biçimde okunamadı/);
      expect((error as Error).message).not.toContain('synthetic-only');
      expect((error as Error).message).not.toContain('password rejected');
    }
  });
});
