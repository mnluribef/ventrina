// functions/api/webhook/whatsapp.ts
// Webhook bidireccional de WhatsApp Cloud API (Meta) para notificaciones de entrega, lectura y mensajes de clientes (Oportunidad 3)

import type { Env, PagesHandler } from '../../types';
import { bytesToHex } from '../_auth';
import { getDB, jsonResponse } from '../_helpers';
import { normalizePhoneForWhatsApp } from '../_whatsapp';

export interface WhatsAppStatusItem {
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed' | string;
    timestamp: string;
    recipient_id: string;
    errors?: Array<{ code: number; title: string; message?: string }>;
}

export interface WhatsAppMessageItem {
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: {
        body: string;
    };
}

export interface WhatsAppChangeValue {
    messaging_product?: string;
    metadata?: {
        display_phone_number?: string;
        phone_number_id?: string;
    };
    statuses?: WhatsAppStatusItem[];
    messages?: WhatsAppMessageItem[];
}

export interface WhatsAppWebhookPayload {
    object?: string;
    entry?: Array<{
        id?: string;
        changes?: Array<{
            field?: string;
            value?: WhatsAppChangeValue;
        }>;
    }>;
}

/**
 * Valida la firma HMAC-SHA256 de Meta WhatsApp (X-Hub-Signature-256)
 */
export async function verifyMetaSignature(
    payload: string,
    signatureHeader: string | null,
    secret?: string,
): Promise<boolean> {
    if (!secret || !signatureHeader) return true; // Si no está configurado el secret, no se fuerza rechazo en dev/test
    if (!signatureHeader.startsWith('sha256=')) return false;

    const signature = signatureHeader.slice(7);
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedHex = bytesToHex(new Uint8Array(expected));

    return signature.toLowerCase() === expectedHex.toLowerCase();
}

/**
 * GET /api/webhook/whatsapp — Challenge de verificación de Meta WhatsApp Webhook
 */
export const onRequestGet: PagesHandler<Env> = async (context) => {
    const { request, env } = context;
    const url = new URL(request.url);

    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const expectedToken = env.WHATSAPP_VERIFY_TOKEN || 'ventrina_whatsapp_secret';

    if (mode === 'subscribe' && token === expectedToken) {
        return new Response(challenge || '', {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        });
    }

    return new Response('Verificación de webhook fallida.', { status: 403 });
};

/**
 * POST /api/webhook/whatsapp — Ingesta de callbacks de estado y mensajes entrantes de clientes
 */
export const onRequestPost: PagesHandler<Env> = async (context) => {
    const { request, env } = context;
    const db = getDB(env);

    const rawBody = await request.text();

    // Verificación de firma opcional si está configurado WHATSAPP_APP_SECRET
    const signature = request.headers.get('x-hub-signature-256');
    if (env.WHATSAPP_APP_SECRET) {
        const isValid = await verifyMetaSignature(rawBody, signature, env.WHATSAPP_APP_SECRET);
        if (!isValid) {
            return jsonResponse({ error: 'Firma de webhook inválida.' }, 401);
        }
    }

    let payload: WhatsAppWebhookPayload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return jsonResponse({ error: 'Payload JSON inválido.' }, 400);
    }

    if (payload.object !== 'whatsapp_business_account' && !payload.entry) {
        // Responder 200 a pings que no correspondan a whatsapp_business_account
        return jsonResponse({ received: true });
    }

    let processedStatuses = 0;
    let processedMessages = 0;

    for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
            const value = change.value;
            if (!value) continue;

            // 1. Procesar callbacks de estado de entrega / lectura
            if (value.statuses && Array.isArray(value.statuses)) {
                for (const status of value.statuses) {
                    const cleanPhone = normalizePhoneForWhatsApp(status.recipient_id);

                    // Buscar el pedido más reciente asociado a este destinatario
                    const recentOrder = await db
                        .prepare(
                            `SELECT id, tenant_id, status FROM orders 
                             WHERE client_phone LIKE ? OR client_phone LIKE ? 
                             ORDER BY created_at DESC LIMIT 1`,
                        )
                        .bind(`%${status.recipient_id}%`, `%${cleanPhone.slice(-8)}%`)
                        .first<{ id: string; tenant_id: string; status: string }>();

                    if (recentOrder) {
                        await db
                            .prepare(
                                `INSERT INTO order_events (order_id, tenant_id, from_status, to_status, actor, note)
                                 VALUES (?, ?, ?, ?, 'whatsapp', ?)`,
                            )
                            .bind(
                                recentOrder.id,
                                recentOrder.tenant_id,
                                recentOrder.status,
                                recentOrder.status,
                                `WhatsApp: Mensaje ${status.status} (ID: ${status.id})`,
                            )
                            .run();
                        processedStatuses++;
                    }
                }
            }

            // 2. Procesar mensajes entrantes de clientes
            if (value.messages && Array.isArray(value.messages)) {
                for (const message of value.messages) {
                    const textBody = message.text?.body?.trim() || '';
                    const senderPhone = normalizePhoneForWhatsApp(message.from);

                    // Buscar si el mensaje cita un número de pedido (ej: ORD-ABC12 o similar)
                    const orderIdMatch = textBody.match(/\b([A-Z0-9]{3,6}-[A-Z0-9]{4,8})\b/i);
                    let targetOrder: { id: string; tenant_id: string; status: string } | null = null;

                    if (orderIdMatch) {
                        const matchedId = orderIdMatch[1].toUpperCase();
                        targetOrder = await db
                            .prepare('SELECT id, tenant_id, status FROM orders WHERE id = ? LIMIT 1')
                            .bind(matchedId)
                            .first<{ id: string; tenant_id: string; status: string }>();
                    }

                    if (!targetOrder && senderPhone) {
                        // Fallback: Buscar el pedido activo más reciente del remitente
                        targetOrder = await db
                            .prepare(
                                `SELECT id, tenant_id, status FROM orders 
                                 WHERE client_phone LIKE ? OR client_phone LIKE ? 
                                 ORDER BY created_at DESC LIMIT 1`,
                            )
                            .bind(`%${message.from}%`, `%${senderPhone.slice(-8)}%`)
                            .first<{ id: string; tenant_id: string; status: string }>();
                    }

                    if (targetOrder) {
                        await db
                            .prepare(
                                `INSERT INTO order_events (order_id, tenant_id, from_status, to_status, actor, note)
                                 VALUES (?, ?, ?, ?, 'cliente_whatsapp', ?)`,
                            )
                            .bind(
                                targetOrder.id,
                                targetOrder.tenant_id,
                                targetOrder.status,
                                targetOrder.status,
                                `Mensaje recibido de +${senderPhone}: "${textBody.slice(0, 200)}"`,
                            )
                            .run();
                        processedMessages++;
                    }
                }
            }
        }
    }

    return jsonResponse({
        received: true,
        processed: {
            statuses: processedStatuses,
            messages: processedMessages,
        },
    });
};
