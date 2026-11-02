// tests/e2e-client-journey.test.ts
// Prueba integral del ciclo de vida del cliente (E2E Client Journey)
// Ejecuta el flujo completo paso a paso contra SQLite D1 en memoria con el esquema canónico real.

import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import { beforeEach, describe, expect, it } from 'vitest';
import { invalidateTenantCache } from '../functions/api/_tenant';
import { onRequestGet as analyticsGetHandler } from '../functions/api/analytics';
import {
    onRequestGet as authCheckHandler,
    onRequestPost as authLoginHandler,
    onRequestDelete as authLogoutHandler,
} from '../functions/api/auth';
import { onRequestGet as billingGetHandler } from '../functions/api/billing';
import { onRequestGet as categoriesGetHandler } from '../functions/api/categories';
import { onRequestGet as cleanupGetHandler } from '../functions/api/cleanup';
import { onRequestGet as healthGetHandler } from '../functions/api/health';
import { onRequestPost as onboardingHandler } from '../functions/api/onboarding';
import {
    onRequestGet as ordersGetHandler,
    onRequestPost as ordersPostHandler,
    onRequestPut as ordersPutHandler,
} from '../functions/api/orders';
import {
    onRequestGet as productsGetHandler,
    onRequestPatch as productsPatchHandler,
    onRequestPost as productsPostHandler,
    onRequestPut as productsPutHandler,
} from '../functions/api/products';
import { onRequestPost as whatsappWebhookPost } from '../functions/api/webhook/whatsapp';
import { createMemoryD1, createMemoryKV, createMemoryR2, createTestContext } from './helpers/d1-memory';

describe('E2E Client Journey Simulation (Full Modules Verification)', () => {
    let db: D1Database;
    let kv: KVNamespace;
    let r2: R2Bucket;

    beforeEach(() => {
        db = createMemoryD1();
        kv = createMemoryKV();
        r2 = createMemoryR2();
    });

    it('executes full end-to-end customer & merchant workflow across all modules', async () => {
        // =========================================================================
        // MÓDULO 1: Subsystem Health Check inicial
        // =========================================================================
        const healthCtx = createTestContext({
            url: 'https://ventrina.app/api/health',
            db,
            kv,
            r2,
        });
        const healthRes = await healthGetHandler(healthCtx);
        expect(healthRes.status).toBe(200);
        const healthData = (await healthRes.json()) as any;
        expect(healthData.status).toBe('healthy');
        expect(healthData.checks.database.status).toBe('ok');

        // =========================================================================
        // MÓDULO 2: Onboarding de Nuevo Comercio (Registro de Cliente)
        // =========================================================================
        const onboardingCtx = createTestContext({
            url: 'https://ventrina.app/api/onboarding',
            method: 'POST',
            body: {
                tenantName: 'Hamburguesas El Chamo',
                tenantSlug: 'elchamo',
                template: 'restaurant',
                email: 'admin@elchamo.com',
                password: 'Password123!',
                whatsapp: '04141234567',
                acceptTerms: true,
            },
            db,
            kv,
            r2,
        });

        const onboardingRes = await onboardingHandler(onboardingCtx);
        expect(onboardingRes.status).toBe(201);
        const onboardingData = (await onboardingRes.json()) as any;
        expect(onboardingData.success).toBe(true);
        expect(onboardingData.tenantId).toBe('elchamo');

        // Verificar en BD que el tenant y usuario existen con teléfono normalizado
        const tenantRow = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind('elchamo').first<any>();
        expect(tenantRow).toBeDefined();
        expect(tenantRow.whatsapp).toBe('584141234567');
        expect(tenantRow.plan).toBe('basic');

        const userRow = await db
            .prepare('SELECT * FROM users WHERE email = ? AND tenant_id = ?')
            .bind('admin@elchamo.com', 'elchamo')
            .first<any>();
        expect(userRow).toBeDefined();
        expect(userRow.password_salt).toBeDefined(); // PBKDF2 salt

        // =========================================================================
        // MÓDULO 3: Inicio de Sesión y Autenticación del Comerciante
        // =========================================================================
        const loginCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/auth',
            method: 'POST',
            headers: {
                'X-Tenant-Id': 'elchamo',
            },
            body: {
                email: 'admin@elchamo.com',
                password: 'Password123!',
                tenant: 'elchamo',
            },
            db,
            kv,
        });

        const loginRes = await authLoginHandler(loginCtx);
        expect(loginRes.status).toBe(200);
        const loginData = (await loginRes.json()) as any;
        expect(loginData.success).toBe(true);
        expect(loginData.tenantId).toBe('elchamo');

        // Extraer cookie de sesión
        const setCookieHeader = loginRes.headers.get('Set-Cookie') || '';
        expect(setCookieHeader).toContain('ventrina_session=');
        const sessionTokenMatch = setCookieHeader.match(/ventrina_session=([^;]+)/);
        const sessionToken = sessionTokenMatch ? sessionTokenMatch[1] : '';
        expect(sessionToken.length).toBeGreaterThan(10);

        // Verificar sesión activa
        const checkCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/auth',
            headers: {
                Cookie: `ventrina_session=${sessionToken}`,
                'X-Tenant-Id': 'elchamo',
            },
            db,
            kv,
        });
        const checkRes = await authCheckHandler(checkCtx);
        expect(checkRes.status).toBe(200);
        const checkData = (await checkRes.json()) as any;
        expect(checkData.authenticated).toBe(true);
        expect(checkData.email).toBe('admin@elchamo.com');

        // =========================================================================
        // MÓDULO 4: Gestión de Catálogo por el Administrador (Crear, Listar, Modificar)
        // =========================================================================
        // 4.1 Crear un producto nuevo
        const createProdCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/products',
            method: 'POST',
            headers: {
                Cookie: `ventrina_session=${sessionToken}`,
                'X-Tenant-Id': 'elchamo',
                'X-Requested-With': 'fetch',
            },
            body: {
                id: 'chamo-doble',
                name: 'Hamburguesa Doble Carne',
                description: 'Doble carne angus, queso cheddar, tocineta y salsa especial.',
                price: 8.5,
                compare_at_price: 10.0,
                category: 'principales',
                template: 'restaurant',
                stock: 20,
                active: 1,
            },
            db,
            kv,
        });

        const createProdRes = await productsPostHandler(createProdCtx);
        expect(createProdRes.status).toBe(201);
        const createProdData = (await createProdRes.json()) as any;
        expect(createProdData.success).toBe(true);

        // 4.2 Actualizar el producto (ajustar precio a 9.00)
        const updateProdCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/products',
            method: 'PUT',
            headers: {
                Cookie: `ventrina_session=${sessionToken}`,
                'X-Tenant-Id': 'elchamo',
                'X-Requested-With': 'fetch',
            },
            body: {
                id: 'chamo-doble',
                name: 'Hamburguesa Doble Carne Especial',
                description: 'Doble carne angus premium con queso fundido.',
                price: 9.0,
                compare_at_price: 11.0,
                category: 'principales',
                template: 'restaurant',
                stock: 20,
                active: 1,
            },
            db,
            kv,
        });
        const updateProdRes = await productsPutHandler(updateProdCtx);
        expect(updateProdRes.status).toBe(200);

        // 4.2.1 Crear variante con stock controlado (Doble Queso, stock: 10)
        await db
            .prepare(
                `INSERT INTO product_variants (
                    id, product_id, sku, label, price_delta, stock, active, tenant_id
                ) VALUES (
                    501, 'chamo-doble', 'CD-DQ', 'Doble Queso', 0.0, 10, 1, 'elchamo'
                )`,
            )
            .run();

        // 4.3 Archivar y reactivar producto con PATCH
        const patchCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/products?id=chamo-doble&action=archive',
            method: 'PATCH',
            headers: {
                Cookie: `ventrina_session=${sessionToken}`,
                'X-Tenant-Id': 'elchamo',
                'X-Requested-With': 'fetch',
            },
            db,
            kv,
        });
        const patchRes = await productsPatchHandler(patchCtx);
        expect(patchRes.status).toBe(200);

        // Reactivar
        const restoreCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/products?id=chamo-doble&action=restore',
            method: 'PATCH',
            headers: {
                Cookie: `ventrina_session=${sessionToken}`,
                'X-Tenant-Id': 'elchamo',
                'X-Requested-With': 'fetch',
            },
            db,
            kv,
        });
        const restoreRes = await productsPatchHandler(restoreCtx);
        expect(restoreRes.status).toBe(200);

        // 4.4 Consultar categorías de la tienda
        const catCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/categories?template=restaurant',
            headers: { 'X-Tenant-Id': 'elchamo' },
            db,
            kv,
        });
        const catRes = await categoriesGetHandler(catCtx);
        expect(catRes.status).toBe(200);
        const catData = (await catRes.json()) as any;
        expect(catData.categories).toBeDefined();

        // =========================================================================
        // MÓDULO 5: Crear Cupón de Descuento
        // =========================================================================
        await db
            .prepare(`
            INSERT INTO coupons (code, discount_type, discount_value, tenant_id, active)
            VALUES (?, ?, ?, ?, 1)
        `)
            .bind('CHAMO10', 'percentage', 10.0, 'elchamo')
            .run();

        // Configurar tasa BCV de la tienda
        await db
            .prepare(`
            INSERT OR REPLACE INTO settings (key, value, tenant_id)
            VALUES ('bcv_rate', '850.00', 'elchamo')
        `)
            .run();

        // =========================================================================
        // MÓDULO 6: Navegación del Catálogo por el Comprador Público
        // =========================================================================
        const publicCatalogCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/products',
            headers: { 'X-Tenant-Id': 'elchamo' },
            db,
            kv,
        });
        const publicCatalogRes = await productsGetHandler(publicCatalogCtx);
        expect(publicCatalogRes.status).toBe(200);
        const publicCatalogData = (await publicCatalogRes.json()) as any;
        expect(publicCatalogData.data.length).toBeGreaterThanOrEqual(1);

        const targetProduct = publicCatalogData.data.find((p: any) => p.id === 'chamo-doble');
        expect(targetProduct).toBeDefined();
        expect(targetProduct.price).toBe(9);
        expect(targetProduct.stock).toBe(20);

        // =========================================================================
        // MÓDULO 7: Checkout del Comprador (Creación de Pedido con Descuento y Stock Atómico)
        // =========================================================================
        const orderCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/orders',
            method: 'POST',
            headers: {
                'X-Tenant-Id': 'elchamo',
                'Idempotency-Key': 'order-idem-chamo-001',
            },
            body: {
                clientName: 'Carlos Gómez',
                clientPhone: '+584129876543',
                clientEmail: 'carlos@cliente.com',
                deliveryType: 'delivery',
                deliveryAddress: 'Urb. El Rosal, Edif. Centro, Piso 4',
                couponCode: 'CHAMO10',
                items: [
                    {
                        id: 'chamo-doble',
                        name: 'Hamburguesa Doble Carne Especial',
                        price: 9.0,
                        qty: 2,
                        options: { size: 'Doble Queso' },
                    },
                ],
            },
            db,
            kv,
        });

        const orderRes = await ordersPostHandler(orderCtx);
        expect(orderRes.status).toBe(201);
        const orderData = (await orderRes.json()) as any;
        expect(orderData.success).toBe(true);
        expect(orderData.orderId).toBeDefined();

        // 2 items * $9.00 = $18.00 - 10% ($1.80) = $16.20 + $5.00 delivery = $21.20
        expect(orderData.itemsTotal).toBe(18);
        expect(orderData.discountAmount).toBe(1.8);
        expect(orderData.totalPrice).toBe(21.2);
        expect(orderData.totalBs).toBe(18020); // 21.2 * 850
        expect(orderData.appliedCoupon).toBe('CHAMO10');

        const placedOrderId = orderData.orderId;

        // 7.1 Verificar deducción atómica de stock en BD (Base: 20 - 2 = 18, Variante: 10 - 2 = 8)
        const updatedProduct = await db
            .prepare('SELECT stock FROM products WHERE id = ? AND tenant_id = ?')
            .bind('chamo-doble', 'elchamo')
            .first<any>();
        expect(updatedProduct.stock).toBe(18);

        const updatedVariant = await db
            .prepare('SELECT stock FROM product_variants WHERE id = ? AND tenant_id = ?')
            .bind(501, 'elchamo')
            .first<any>();
        expect(updatedVariant.stock).toBe(8);

        // 7.2 Verificar idempotencia: enviar la misma petición no debe crear duplicado ni descontar más stock
        const repeatOrderRes = await ordersPostHandler(orderCtx);
        expect(repeatOrderRes.status).toBe(200);
        const repeatData = (await repeatOrderRes.json()) as any;
        expect(repeatData.idempotent).toBe(true);
        expect(repeatData.orderId).toBe(placedOrderId);

        const checkStockAgain = await db
            .prepare('SELECT stock FROM products WHERE id = ? AND tenant_id = ?')
            .bind('chamo-doble', 'elchamo')
            .first<any>();
        expect(checkStockAgain.stock).toBe(18); // Se mantuvo en 18, sin doble descuento

        // =========================================================================
        // MÓDULO 8: Procesamiento del Pedido por el Comerciante (Admin / Staff)
        // =========================================================================
        // 8.1 Consultar pedidos en el panel
        const getOrdersCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/orders',
            headers: {
                Cookie: `ventrina_session=${sessionToken}`,
                'X-Tenant-Id': 'elchamo',
            },
            db,
            kv,
        });
        const getOrdersRes = await ordersGetHandler(getOrdersCtx);
        expect(getOrdersRes.status).toBe(200);
        const ordersList = (await getOrdersRes.json()) as any;
        expect(ordersList.data.length).toBeGreaterThanOrEqual(1);

        // 8.2 Cambiar estado del pedido a 'en_produccion' y luego 'completado'
        const putOrderCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/orders',
            method: 'PUT',
            headers: {
                Cookie: `ventrina_session=${sessionToken}`,
                'X-Tenant-Id': 'elchamo',
                'X-Requested-With': 'fetch',
            },
            body: {
                id: placedOrderId,
                status: 'completado',
                paymentMethod: 'Pago Móvil',
                paymentAmount: 21.2,
                note: 'Pago verificado exitosamente.',
            },
            db,
            kv,
        });

        const putOrderRes = await ordersPutHandler(putOrderCtx);
        expect(putOrderRes.status).toBe(200);
        const putOrderData = (await putOrderRes.json()) as any;
        expect(putOrderData.success).toBe(true);
        expect(putOrderData.whatsappNotificationUrl).toBeDefined();

        // 8.3 Ingesta de WhatsApp Webhook: El cliente envía un mensaje confirmando la recepción
        const waCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/webhook/whatsapp',
            method: 'POST',
            body: {
                object: 'whatsapp_business_account',
                entry: [
                    {
                        id: 'WABA_01',
                        changes: [
                            {
                                field: 'messages',
                                value: {
                                    messages: [
                                        {
                                            from: '584129876543',
                                            id: 'wamid.HBgL9988',
                                            timestamp: '1678901234',
                                            type: 'text',
                                            text: { body: `¡Muchas gracias! Ya recibí mi pedido ${placedOrderId}` },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            },
            db,
            kv,
        });
        const waRes = await whatsappWebhookPost(waCtx);
        expect(waRes.status).toBe(200);

        // Verificar eventos de auditoría en 'order_events' (creación, actualización de estado y mensaje WhatsApp)
        const events = await db
            .prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY id ASC')
            .bind(placedOrderId)
            .all<any>();
        expect(events.results.length).toBe(3);
        expect(events.results[0].to_status).toBe('pendiente');
        expect(events.results[1].from_status).toBe('pendiente');
        expect(events.results[1].to_status).toBe('completado');
        expect(events.results[2].actor).toBe('cliente_whatsapp');
        expect(events.results[2].note).toContain(placedOrderId);

        // =========================================================================
        // MÓDULO 9: Analíticas del Negocio (Analytics)
        // =========================================================================
        // Actualizar plan a 'pro' e invalidar caché KV del tenant para consultar analíticas avanzadas
        await db.prepare("UPDATE tenants SET plan = 'pro' WHERE id = 'elchamo'").run();
        await invalidateTenantCache(kv, 'elchamo');

        const analyticsCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/analytics',
            headers: {
                Cookie: `ventrina_session=${sessionToken}`,
                'X-Tenant-Id': 'elchamo',
            },
            db,
            kv,
        });
        const analyticsRes = await analyticsGetHandler(analyticsCtx);
        expect(analyticsRes.status).toBe(200);
        const analyticsData = (await analyticsRes.json()) as any;
        expect(analyticsData.summary).toBeDefined();
        expect(analyticsData.summary.salesCountThisMonth).toBeGreaterThanOrEqual(1);
        expect(analyticsData.summary.revenueThisMonth).toBe(21.2);
        expect(analyticsData.topProducts.length).toBeGreaterThanOrEqual(1);
        expect(analyticsData.ordersByStatus.length).toBeGreaterThanOrEqual(1);

        // =========================================================================
        // MÓDULO 10: Facturación & Límites de Plan (Billing)
        // =========================================================================
        const billingCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/billing',
            headers: {
                Cookie: `ventrina_session=${sessionToken}`,
                'X-Tenant-Id': 'elchamo',
            },
            db,
            kv,
        });
        const billingRes = await billingGetHandler(billingCtx);
        expect(billingRes.status).toBe(200);
        const billingData = (await billingRes.json()) as any;
        expect(billingData.tenant.id).toBe('elchamo');
        expect(billingData.usage.products.current).toBeGreaterThanOrEqual(1);
        expect(billingData.billing.method).toBeDefined();

        // =========================================================================
        // MÓDULO 11: Cierre de Sesión & Limpieza Operativa (Cleanup)
        // =========================================================================
        // 11.1 Logout
        const logoutCtx = createTestContext({
            url: 'https://elchamo.ventrina.app/api/auth',
            method: 'DELETE',
            headers: {
                Cookie: `ventrina_session=${sessionToken}`,
            },
            db,
            kv,
        });
        const logoutRes = await authLogoutHandler(logoutCtx);
        expect(logoutRes.status).toBe(200);

        // 11.2 Cleanup programado (requiere SUPERADMIN_KEY)
        const cleanupCtx = createTestContext({
            url: 'https://ventrina.app/api/cleanup',
            headers: {
                'X-Superadmin-Key': 'test-superadmin-secret-key-1234',
            },
            db,
            kv,
        });
        const cleanupRes = await cleanupGetHandler(cleanupCtx);
        expect(cleanupRes.status).toBe(200);
        const cleanupData = (await cleanupRes.json()) as any;
        expect(cleanupData.success).toBe(true);
    });
});
