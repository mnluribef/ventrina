// tests/whatsapp-webhook.test.ts
// Tests para el webhook bidireccional de Meta WhatsApp Cloud API (Oportunidad 3)

import type { D1Database } from '@cloudflare/workers-types';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    verifyMetaSignature,
    onRequestGet as whatsappWebhookGet,
    onRequestPost as whatsappWebhookPost,
} from '../functions/api/webhook/whatsapp';
import type { Env, PagesContext } from '../functions/types';
import { createMemoryD1, createTestContext } from './helpers/d1-memory';

describe('WhatsApp Cloud API Webhook (/api/webhook/whatsapp)', () => {
    let db: D1Database;

    beforeEach(async () => {
        db = createMemoryD1();

        // Crear tenant demo y una orden existente para vincular callbacks
        await db
            .prepare(
                "INSERT OR REPLACE INTO tenants (id, name, plan, template) VALUES ('fogon', 'El Fogón Criollo', 'pro', 'restaurant')",
            )
            .run();

        await db
            .prepare(
                `INSERT OR REPLACE INTO orders (
                    id, client_name, client_phone, delivery_type, status, total_items, total_price, tenant_id
                ) VALUES (
                    'ORD-WA100', 'Carlos Pérez', '04121234567', 'delivery', 'pendiente', 1, 15.0, 'fogon'
                )`,
            )
            .run();
    });

    describe('GET Verification Challenge (Hub Subscription)', () => {
        it('accepts subscription challenge with valid verify_token', async () => {
            const ctx = createTestContext({
                url: 'https://ventrina.app/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=test_token_123&hub.challenge=CHALLENGE_CODE_99',
                method: 'GET',
                db,
                envOverrides: {
                    WHATSAPP_VERIFY_TOKEN: 'test_token_123',
                },
            });

            const res = await whatsappWebhookGet(ctx as unknown as PagesContext<Env>);
            expect(res.status).toBe(200);
            const text = await res.text();
            expect(text).toBe('CHALLENGE_CODE_99');
        });

        it('rejects subscription challenge with invalid verify_token', async () => {
            const ctx = createTestContext({
                url: 'https://ventrina.app/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=CHALLENGE_CODE_99',
                method: 'GET',
                db,
                envOverrides: {
                    WHATSAPP_VERIFY_TOKEN: 'test_token_123',
                },
            });

            const res = await whatsappWebhookGet(ctx as unknown as PagesContext<Env>);
            expect(res.status).toBe(403);
            const text = await res.text();
            expect(text).toContain('Verificación de webhook fallida');
        });
    });

    describe('POST Event Ingestion (Statuses & Inbound Messages)', () => {
        it('rejects invalid JSON payload with 400', async () => {
            const ctx = createTestContext({
                url: 'https://ventrina.app/api/webhook/whatsapp',
                method: 'POST',
                db,
                body: 'not a json',
            });

            const res = await whatsappWebhookPost(ctx as unknown as PagesContext<Env>);
            expect(res.status).toBe(400);
            const data = (await res.json()) as { error: string };
            expect(data.error).toBe('Payload JSON inválido.');
        });

        it('processes message status update (delivered) and records audit event in order_events', async () => {
            const payload = {
                object: 'whatsapp_business_account',
                entry: [
                    {
                        id: 'WABA_123',
                        changes: [
                            {
                                field: 'messages',
                                value: {
                                    messaging_product: 'whatsapp',
                                    statuses: [
                                        {
                                            id: 'wamid.HBgL12345',
                                            status: 'delivered',
                                            timestamp: '1678901234',
                                            recipient_id: '584121234567',
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            };

            const ctx = createTestContext({
                url: 'https://ventrina.app/api/webhook/whatsapp',
                method: 'POST',
                db,
                body: payload,
            });

            const res = await whatsappWebhookPost(ctx as unknown as PagesContext<Env>);
            expect(res.status).toBe(200);
            const data = (await res.json()) as { received: boolean; processed: { statuses: number } };
            expect(data.received).toBe(true);
            expect(data.processed.statuses).toBe(1);

            // Verificar que se insertó el evento de auditoría
            const event = await db
                .prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY id DESC LIMIT 1')
                .bind('ORD-WA100')
                .first<{ actor: string; note: string }>();

            expect(event).not.toBeNull();
            expect(event?.actor).toBe('whatsapp');
            expect(event?.note).toContain('WhatsApp: Mensaje delivered');
        });

        it('processes incoming customer message citing order ID and records customer event', async () => {
            const payload = {
                object: 'whatsapp_business_account',
                entry: [
                    {
                        id: 'WABA_123',
                        changes: [
                            {
                                field: 'messages',
                                value: {
                                    messaging_product: 'whatsapp',
                                    messages: [
                                        {
                                            from: '584121234567',
                                            id: 'wamid.HBgL999',
                                            timestamp: '1678901234',
                                            type: 'text',
                                            text: {
                                                body: 'Hola, ¿a qué hora llega mi pedido ORD-WA100?',
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            };

            const ctx = createTestContext({
                url: 'https://ventrina.app/api/webhook/whatsapp',
                method: 'POST',
                db,
                body: payload,
            });

            const res = await whatsappWebhookPost(ctx as unknown as PagesContext<Env>);
            expect(res.status).toBe(200);
            const data = (await res.json()) as { received: boolean; processed: { messages: number } };
            expect(data.received).toBe(true);
            expect(data.processed.messages).toBe(1);

            const event = await db
                .prepare('SELECT * FROM order_events WHERE order_id = ? AND actor = ? LIMIT 1')
                .bind('ORD-WA100', 'cliente_whatsapp')
                .first<{ actor: string; note: string }>();

            expect(event).not.toBeNull();
            expect(event?.actor).toBe('cliente_whatsapp');
            expect(event?.note).toContain('¿a qué hora llega mi pedido ORD-WA100?');
        });

        it('validates HMAC-SHA256 signature helper correctly', async () => {
            const secret = 'meta_secret_key';
            const body = JSON.stringify({ object: 'whatsapp_business_account' });

            const encoder = new TextEncoder();
            const keyData = encoder.encode(secret);
            const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, [
                'sign',
            ]);
            const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
            const hex = Array.from(new Uint8Array(signature))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');

            const valid = await verifyMetaSignature(body, `sha256=${hex}`, secret);
            expect(valid).toBe(true);

            const invalid = await verifyMetaSignature(body, 'sha256=invalid_hex_string', secret);
            expect(invalid).toBe(false);
        });
    });
});
