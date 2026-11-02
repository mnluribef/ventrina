// functions/api/_services/webhook.service.ts
// Servicio centralizado para despacho de webhooks salientes con firma HMAC-SHA256 (SRP fix #9)
import { generateWebhookSignature } from './order.service';

export interface WebhookPayload {
    event: string;
    [key: string]: unknown;
}

export interface WebhookConfig {
    url: string;
    secret: string;
}

/**
 * Despacha un webhook firmado de forma asíncrona (via waitUntil si está disponible).
 * Firma cada payload con HMAC-SHA256 y lo entrega al endpoint configurado.
 *
 * @param config  - URL y secreto del webhook
 * @param payload - Datos del evento a enviar
 * @param waitUntil - Callback de Cloudflare Pages para tareas en background (opcional)
 */
export async function dispatchWebhook(
    config: WebhookConfig,
    payload: WebhookPayload,
    waitUntil?: (promise: Promise<unknown>) => void,
): Promise<void> {
    const body = JSON.stringify({
        ...payload,
        timestamp: payload.timestamp ?? new Date().toISOString(),
    });

    let signature: string;
    try {
        signature = await generateWebhookSignature(body, config.secret);
    } catch (err) {
        console.error('[WebhookService] Error al generar firma HMAC:', err);
        return;
    }

    const sendRequest = fetch(config.url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Ventrina-Signature': `sha256=${signature}`,
        },
        body,
    }).catch((err) => console.error('[WebhookService] Error al enviar webhook:', err));

    if (waitUntil) {
        waitUntil(sendRequest);
    } else {
        await sendRequest;
    }
}

/**
 * Despacha el webhook solo si la configuración está completa (url + secret).
 * Devuelve true si se intentó el envío, false si se omitió por config incompleta.
 */
export function dispatchWebhookIfConfigured(
    webhookUrl: string | undefined,
    webhookSecret: string | undefined,
    payload: WebhookPayload,
    waitUntil?: (promise: Promise<unknown>) => void,
): boolean {
    if (!webhookUrl || !webhookSecret) return false;

    // No await — se despacha en background
    dispatchWebhook({ url: webhookUrl, secret: webhookSecret }, payload, waitUntil).catch((err) =>
        console.error('[WebhookService] Fallo inesperado:', err),
    );

    return true;
}
