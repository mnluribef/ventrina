// tests/checkout-integration.test.ts
// Tests de integración para Checkout público, WebhookService, OCP Plans y Guards
import { describe, it, expect, vi } from 'vitest';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import type { Env, PagesContext, TenantRow, UserSession } from '../functions/types';
import { onRequestPost as ordersPostHandler } from '../functions/api/orders';
import { dispatchWebhook, dispatchWebhookIfConfigured } from '../functions/api/_services/webhook.service';
import { resolvePlan, checkProductLimit } from '../functions/api/_plans';
import { resolveAuthenticatedTenant } from '../functions/api/_guards';

describe('Checkout & Orders API Integration (POST /api/orders)', () => {
    it('creates an order successfully when payload is valid and stock is available', async () => {
        const mockTenant: TenantRow = {
            id: 'fogon',
            name: 'El Fogón',
            plan: 'pro',
            template: 'restaurant',
            config_json: JSON.stringify({ bcvRate: 850 }),
            domain: 'fogon.ventrina.app',
            active: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const mockDb = {
            prepare: vi.fn().mockImplementation((query: string) => ({
                bind: vi.fn().mockImplementation((..._args: unknown[]) => ({
                    first: vi.fn().mockImplementation(async () => {
                        if (query.includes('FROM tenants WHERE id = ?')) return mockTenant;
                        if (query.includes('FROM settings WHERE key = ?')) return { value: '850.00' };
                        if (query.includes('SELECT COUNT(*) as total FROM orders')) return { total: 5 };
                        if (query.includes('SELECT 1 FROM coupons')) return null;
                        return null;
                    }),
                    all: vi.fn().mockImplementation(async () => {
                        if (query.includes('FROM products WHERE tenant_id = ?')) {
                            return {
                                results: [
                                    {
                                        id: 'p1',
                                        name: 'Hamburguesa',
                                        price: 10,
                                        stock: 50,
                                        active: 1,
                                        tenant_id: 'fogon'
                                    }
                                ]
                            };
                        }
                        return { results: [] };
                    }),
                    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } })
                }))
            })),
            batch: vi.fn().mockImplementation(async (statements: unknown[]) => {
                return (statements as unknown[]).map(() => ({
                    meta: { changes: 1 }
                }));
            })
        } as unknown as D1Database;

        const mockKv = {
            get: vi.fn().mockResolvedValue(null),
            put: vi.fn().mockResolvedValue(undefined)
        } as unknown as KVNamespace;

        const context = {
            request: new Request('https://fogon.ventrina.app/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': 'test-idemp-12345'
                },
                body: JSON.stringify({
                    clientName: 'Juan Pérez',
                    clientPhone: '+584141234567',
                    clientEmail: 'juan@example.com',
                    deliveryType: 'delivery',
                    deliveryAddress: 'Av. Libertador, Caracas',
                    items: [
                        {
                            id: 'p1',
                            name: 'Hamburguesa',
                            price: 10,
                            qty: 2
                        }
                    ]
                })
            }),
            env: {
                DB: mockDb,
                KV: mockKv,
                ENVIRONMENT: 'test',
                WEBHOOK_URL: 'https://webhook.site/test',
                WEBHOOK_SECRET: 'whsec_test123456'
            } as Env,
            waitUntil: vi.fn()
        } as unknown as PagesContext<Env>;

        const response = await ordersPostHandler(context);
        expect(response.status).toBe(201);
        const data = (await response.json()) as { success: boolean; orderId: string; totalPrice: number; totalBs: number };
        expect(data.success).toBe(true);
        expect(data.orderId).toBeDefined();
        // 2 items * $10 + $5 delivery = $25.00
        expect(data.totalPrice).toBe(25);
        expect(data.totalBs).toBe(21250); // 25 * 850
        expect(mockKv.put).toHaveBeenCalledWith(
            expect.stringContaining('idem:fogon:test-idemp-12345'),
            data.orderId,
            expect.objectContaining({ expirationTtl: 86400 })
        );
    });

    it('returns 400 when order payload has empty items list', async () => {
        const mockDb = {
            prepare: vi.fn().mockReturnValue({
                bind: vi.fn().mockReturnValue({
                    first: vi.fn().mockResolvedValue(null),
                    all: vi.fn().mockResolvedValue({ results: [] })
                })
            })
        } as unknown as D1Database;

        const context = {
            request: new Request('https://fogon.ventrina.app/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientName: 'Juan Pérez',
                    clientPhone: '+584141234567',
                    deliveryType: 'pickup',
                    items: []
                })
            }),
            env: { DB: mockDb } as Env,
            waitUntil: vi.fn()
        } as unknown as PagesContext<Env>;

        const response = await ordersPostHandler(context);
        expect(response.status).toBe(400);
        const data = (await response.json()) as { error: string };
        expect(data.error).toBe('Datos inválidos');
    });
});

describe('WebhookService (SRP fix #9)', () => {
    it('dispatches signed webhook with X-Ventrina-Signature header', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('OK', { status: 200 })
        );

        const config = {
            url: 'https://api.example.com/webhook',
            secret: 'test-secret-key-123'
        };

        const payload = {
            event: 'order_status_updated',
            orderId: 'ORD-998877',
            status: 'completado'
        };

        await dispatchWebhook(config, payload);

        expect(fetchSpy).toHaveBeenCalledWith(
            'https://api.example.com/webhook',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                    'X-Ventrina-Signature': expect.stringMatching(/^sha256=[a-f0-9]{64}$/)
                })
            })
        );

        fetchSpy.mockRestore();
    });

    it('skips dispatching if webhook secret or url is missing', () => {
        const dispatched = dispatchWebhookIfConfigured(
            undefined,
            'secret',
            { event: 'test' }
        );
        expect(dispatched).toBe(false);

        const dispatched2 = dispatchWebhookIfConfigured(
            'https://test.com',
            undefined,
            { event: 'test' }
        );
        expect(dispatched2).toBe(false);
    });
});

describe('Plans & Capabilities (OCP fix #6)', () => {
    it('resolves standard plans and defaults to basic for unknown plan key', () => {
        const proPlan = resolvePlan('pro');
        expect(proPlan.name).toBe('Profesional');
        expect(proPlan.maxProducts).toBe(200);

        const fallbackPlan = resolvePlan('unknown_custom_plan');
        expect(fallbackPlan.name).toBe('Básico');
        expect(fallbackPlan.maxProducts).toBe(30);
    });

    it('enforces product limits according to tenant plan', async () => {
        const mockDb = {
            prepare: vi.fn().mockReturnValue({
                bind: vi.fn().mockReturnValue({
                    first: vi.fn().mockResolvedValue({ total: 29 })
                })
            })
        } as unknown as D1Database;

        const basicTenant: TenantRow = {
            id: 'tienda-basic',
            name: 'Tienda Básica',
            plan: 'basic',
            template: 'restaurant',
            active: 1
        };

        const check1 = await checkProductLimit(mockDb, basicTenant);
        expect(check1.allowed).toBe(true);
        expect(check1.limit).toBe(30);
        expect(check1.current).toBe(29);
    });
});

describe('Guards & Tenant Resolution (DRY & LSP fix #5, #12)', () => {
    it('resolveAuthenticatedTenant favors authenticated user tenant over default demo', async () => {
        const mockUser: UserSession = {
            email: 'admin@negocio.com',
            username: 'admin@negocio.com',
            role: 'admin',
            tenant_id: 'real-store'
        };

        const mockRealTenant: TenantRow = {
            id: 'real-store',
            name: 'Real Store C.A.',
            plan: 'pro',
            template: 'hardware',
            active: 1
        };

        const mockDb = {
            prepare: vi.fn().mockReturnValue({
                bind: vi.fn().mockReturnValue({
                    first: vi.fn().mockResolvedValue(mockRealTenant)
                })
            })
        } as unknown as D1Database;

        const resolved = await resolveAuthenticatedTenant(
            mockDb,
            undefined,
            'demo', // initial was demo
            null,
            mockUser
        );

        expect(resolved.tenantId).toBe('real-store');
        expect(resolved.tenant?.name).toBe('Real Store C.A.');
    });
});
