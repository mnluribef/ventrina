// tests/helpers/d1-memory.ts
// In-Memory SQLite adapter for Cloudflare D1 using Node 22 built-in node:sqlite
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
    D1Database,
    D1PreparedStatement,
    D1Response,
    D1Result,
    KVNamespace,
    R2Bucket,
} from '@cloudflare/workers-types';
import { vi } from 'vitest';
import type { Env, PagesContext } from '../../functions/types';

export function createMemoryD1(): D1Database {
    const sqlite = new DatabaseSync(':memory:');
    const schemaPath = path.resolve(process.cwd(), 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    sqlite.exec(schemaSql);

    function createStmt(sql: string, boundArgs: unknown[] = []): D1PreparedStatement {
        const stmt = {
            bind(...args: unknown[]): D1PreparedStatement {
                return createStmt(sql, args);
            },
            async first<T = unknown>(colName?: string): Promise<T | null> {
                const prepared = sqlite.prepare(sql);
                const row = prepared.get(...(boundArgs as any[])) as Record<string, unknown> | undefined;
                if (!row) return null;
                if (colName) return (row[colName] as T) ?? null;
                return row as T;
            },
            async all<T = unknown>(): Promise<D1Result<T>> {
                const prepared = sqlite.prepare(sql);
                const results = prepared.all(...(boundArgs as any[])) as T[];
                return {
                    results,
                    success: true,
                    meta: { changes: 0, duration: 0, last_row_id: 0, rows_read: results.length, rows_written: 0 },
                } as unknown as D1Result<T>;
            },
            async run(): Promise<D1Response> {
                const prepared = sqlite.prepare(sql);
                const info = prepared.run(...(boundArgs as any[]));
                return {
                    success: true,
                    meta: {
                        changes: info.changes,
                        last_row_id: Number(info.lastInsertRowid),
                        duration: 0,
                        rows_read: 0,
                        rows_written: info.changes,
                    },
                } as unknown as D1Response;
            },
        };
        return stmt as unknown as D1PreparedStatement;
    }

    const d1 = {
        prepare(sql: string): D1PreparedStatement {
            return createStmt(sql);
        },
        async batch(stmts: D1PreparedStatement[]): Promise<D1Response[]> {
            const results: D1Response[] = [];
            for (const s of stmts) {
                // If statement has .first or .all or .run, execute it
                results.push(await s.run());
            }
            return results;
        },
        async exec(sql: string): Promise<{ count: number; duration: number }> {
            sqlite.exec(sql);
            return { count: 1, duration: 0 };
        },
        async dump(): Promise<ArrayBuffer> {
            return new ArrayBuffer(0);
        },
    };

    return d1 as unknown as D1Database;
}

export function createMemoryKV(): KVNamespace {
    const store = new Map<string, string>();

    const kv = {
        async get(key: string, type?: string): Promise<any> {
            const val = store.get(key);
            if (val === undefined) return null;
            if (type === 'json') {
                try {
                    return JSON.parse(val);
                } catch {
                    return null;
                }
            }
            return val;
        },
        async put(key: string, value: string | ArrayBuffer | ArrayBufferView, _opts?: any): Promise<void> {
            const str = typeof value === 'string' ? value : Buffer.from(value as any).toString('utf8');
            store.set(key, str);
        },
        async delete(key: string): Promise<void> {
            store.delete(key);
        },
        async list(opts?: { prefix?: string; limit?: number }): Promise<any> {
            let keys = Array.from(store.keys());
            if (opts?.prefix) {
                keys = keys.filter((k) => k.startsWith(opts.prefix!));
            }
            return {
                keys: keys.map((name) => ({ name })),
                list_complete: true,
            };
        },
    };

    return kv as unknown as KVNamespace;
}

export function createMemoryR2(): R2Bucket {
    const files = new Map<string, { body: Uint8Array; httpMetadata?: any }>();

    const r2 = {
        async put(key: string, value: any, opts?: any): Promise<any> {
            const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
            files.set(key, { body: bytes, httpMetadata: opts?.httpMetadata });
            return { key, size: bytes.length };
        },
        async get(key: string): Promise<any> {
            const file = files.get(key);
            if (!file) return null;
            return {
                key,
                size: file.body.length,
                async arrayBuffer() {
                    return file.body.buffer;
                },
                async text() {
                    return new TextDecoder().decode(file.body);
                },
            };
        },
        async delete(key: string): Promise<void> {
            files.delete(key);
        },
        async list(opts?: { limit?: number; prefix?: string }): Promise<any> {
            let objects = Array.from(files.entries()).map(([key, f]) => ({ key, size: f.body.length }));
            if (opts?.prefix) {
                objects = objects.filter((o) => o.key.startsWith(opts.prefix!));
            }
            if (opts?.limit) {
                objects = objects.slice(0, opts.limit);
            }
            return { objects, truncated: false };
        },
    };

    return r2 as unknown as R2Bucket;
}

export function createTestContext(opts: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    db: D1Database;
    kv?: KVNamespace;
    r2?: R2Bucket;
    envOverrides?: Partial<Env>;
}): PagesContext<Env> {
    const { url, method = 'GET', headers = {}, body, db, kv, r2, envOverrides = {} } = opts;

    const requestHeaders = new Headers(headers);
    let requestBody: any;

    if (body !== undefined) {
        if (typeof body === 'object') {
            requestBody = JSON.stringify(body);
            if (!requestHeaders.has('Content-Type')) {
                requestHeaders.set('Content-Type', 'application/json');
            }
        } else {
            requestBody = String(body);
        }
    }

    const request = new Request(url, {
        method,
        headers: requestHeaders,
        body: ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : requestBody,
    });

    const env: Env = {
        DB: db,
        KV: kv,
        STORAGE: r2,
        ENVIRONMENT: 'test',
        SUPERADMIN_KEY: 'test-superadmin-secret-key-1234',
        TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
        WEBHOOK_URL: 'https://webhook.site/test-order',
        WEBHOOK_SECRET: 'whsec_test_secret_123',
        RESEND_API_KEY: '', // triggers simulated mode
        EMAIL_FROM: 'Ventrina <test@ventrina.app>',
        ...envOverrides,
    };

    const context: PagesContext<Env> = {
        request,
        env: env as any,
        params: {},
        data: {},
        waitUntil: vi.fn(),
        next: vi.fn(),
    };

    return context;
}
