// tests/variant-stock.test.ts
// Tests para deducción atómica de inventario a nivel de variantes (Oportunidad 2)

import type { D1Database } from '@cloudflare/workers-types';
import { beforeEach, describe, expect, it } from 'vitest';
import { OrderService } from '../functions/api/_services/order.service';
import type { TenantRow } from '../functions/types';
import { createMemoryD1 } from './helpers/d1-memory';

describe('Variant-Level Atomic Stock Deduction (Oportunidad 2)', () => {
    let db: D1Database;
    let orderService: OrderService;
    let mockTenant: TenantRow;

    beforeEach(async () => {
        db = createMemoryD1();
        orderService = new OrderService(db);

        mockTenant = {
            id: 'fashion-store',
            name: 'Tienda de Ropa Urbana',
            plan: 'pro',
            template: 'fashion',
            config_json: JSON.stringify({ bcvRate: 850, labels: { deliveryOptionPrice: 3 } }),
            domain: 'fashion.ventrina.app',
            active: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        // Insertar tenant
        await db
            .prepare('INSERT OR REPLACE INTO tenants (id, name, plan, template, config_json) VALUES (?, ?, ?, ?, ?)')
            .bind(mockTenant.id, mockTenant.name, mockTenant.plan, mockTenant.template, mockTenant.config_json)
            .run();

        // Configurar tasa BCV en settings
        await db
            .prepare('INSERT OR REPLACE INTO settings (key, value, tenant_id) VALUES (?, ?, ?)')
            .bind('bcv_rate', '850.00', mockTenant.id)
            .run();

        // Insertar producto base con variantes
        await db
            .prepare(
                `INSERT OR REPLACE INTO products (
                    id, name, price, stock, active, tenant_id, template
                ) VALUES (
                    'franela-oversize', 'Franela Oversize Premium', 25.0, 50, 1, 'fashion-store', 'fashion'
                )`,
            )
            .run();

        // Insertar variantes: Talla M (stock 5) y Talla L (stock 2)
        await db
            .prepare(
                `INSERT INTO product_variants (
                    id, product_id, sku, label, price_delta, stock, active, tenant_id
                ) VALUES (
                    101, 'franela-oversize', 'FO-M', 'M', 0.0, 5, 1, 'fashion-store'
                )`,
            )
            .run();

        await db
            .prepare(
                `INSERT INTO product_variants (
                    id, product_id, sku, label, price_delta, stock, active, tenant_id
                ) VALUES (
                    102, 'franela-oversize', 'FO-L', 'L', 0.0, 2, 1, 'fashion-store'
                )`,
            )
            .run();
    });

    it('deducts stock from matching variant and base product when order is placed', async () => {
        const orderResult = await orderService.createOrder({
            tenant: mockTenant,
            tenantId: 'fashion-store',
            clientIp: '127.0.0.1',
            isTestEnv: true,
            clientName: 'Alejandro Gómez',
            clientPhone: '04141234567',
            deliveryType: 'pickup',
            items: [
                {
                    id: 'franela-oversize',
                    name: 'Franela Oversize Premium',
                    price: 25.0,
                    qty: 2,
                    options: { size: 'M' },
                },
            ],
        });

        expect(orderResult.ok).toBe(true);

        // Verificar que la variante M pasó de 5 a 3 de stock
        const variantM = await db
            .prepare('SELECT stock, active FROM product_variants WHERE id = ?')
            .bind(101)
            .first<{ stock: number; active: number }>();
        expect(variantM?.stock).toBe(3);
        expect(variantM?.active).toBe(1);

        // La variante L no fue tocada y sigue en 2
        const variantL = await db
            .prepare('SELECT stock FROM product_variants WHERE id = ?')
            .bind(102)
            .first<{ stock: number }>();
        expect(variantL?.stock).toBe(2);

        // El producto base pasó de 50 a 48
        const baseProd = await db
            .prepare('SELECT stock FROM products WHERE id = ?')
            .bind('franela-oversize')
            .first<{ stock: number }>();
        expect(baseProd?.stock).toBe(48);
    });

    it('deducts stock when variant is resolved via explicit variantId', async () => {
        const orderResult = await orderService.createOrder({
            tenant: mockTenant,
            tenantId: 'fashion-store',
            clientIp: '127.0.0.1',
            isTestEnv: true,
            clientName: 'Beatriz Silva',
            clientPhone: '04149876543',
            deliveryType: 'pickup',
            items: [
                {
                    id: 'franela-oversize',
                    name: 'Franela Oversize Premium',
                    price: 25.0,
                    qty: 1,
                    variantId: 102,
                },
            ],
        });

        expect(orderResult.ok).toBe(true);

        // Verificar que la variante L pasó de 2 a 1
        const variantL = await db
            .prepare('SELECT stock FROM product_variants WHERE id = ?')
            .bind(102)
            .first<{ stock: number }>();
        expect(variantL?.stock).toBe(1);
    });

    it('rejects order with 400 when variant stock is insufficient', async () => {
        const orderResult = await orderService.createOrder({
            tenant: mockTenant,
            tenantId: 'fashion-store',
            clientIp: '127.0.0.1',
            isTestEnv: true,
            clientName: 'Marcos Díaz',
            clientPhone: '04125555555',
            deliveryType: 'pickup',
            items: [
                {
                    id: 'franela-oversize',
                    name: 'Franela Oversize Premium',
                    price: 25.0,
                    qty: 5, // Solo hay 2 disponibles en Talla L
                    options: { size: 'L' },
                },
            ],
        });

        expect(orderResult.ok).toBe(false);
        if (!orderResult.ok) {
            expect(orderResult.code).toBe(400);
            expect(orderResult.error).toContain('Stock insuficiente para "Franela Oversize Premium (L)"');
            expect(orderResult.error).toContain('Disponible: 2, Solicitado: 5');
        }

        // El stock de la variante no cambió
        const variantL = await db
            .prepare('SELECT stock FROM product_variants WHERE id = ?')
            .bind(102)
            .first<{ stock: number }>();
        expect(variantL?.stock).toBe(2);
    });

    it('restores variant stock when an order is cancelled', async () => {
        // 1. Crear orden que compra 2 unidades de talla M
        const orderResult = await orderService.createOrder({
            tenant: mockTenant,
            tenantId: 'fashion-store',
            clientIp: '127.0.0.1',
            isTestEnv: true,
            clientName: 'Diana Castro',
            clientPhone: '04161112233',
            deliveryType: 'pickup',
            items: [
                {
                    id: 'franela-oversize',
                    name: 'Franela Oversize Premium',
                    price: 25.0,
                    qty: 2,
                    options: { size: 'M' },
                },
            ],
        });

        expect(orderResult.ok).toBe(true);
        if (!orderResult.ok) return;

        const orderId = orderResult.data.orderId;

        // Comprobar que bajó a 3
        let variantM = await db
            .prepare('SELECT stock FROM product_variants WHERE id = ?')
            .bind(101)
            .first<{ stock: number }>();
        expect(variantM?.stock).toBe(3);

        // 2. Cancelar la orden
        const cancelResult = await orderService.updateOrderStatus(
            orderId,
            'fashion-store',
            'cancelado',
            'admin',
            'Cliente solicitó cancelación',
        );
        expect(cancelResult.ok).toBe(true);

        // 3. Comprobar que la variante M fue restituida a 5
        variantM = await db
            .prepare('SELECT stock FROM product_variants WHERE id = ?')
            .bind(101)
            .first<{ stock: number }>();
        expect(variantM?.stock).toBe(5);

        // El producto base fue restituido a 50
        const baseProd = await db
            .prepare('SELECT stock FROM products WHERE id = ?')
            .bind('franela-oversize')
            .first<{ stock: number }>();
        expect(baseProd?.stock).toBe(50);
    });
});
