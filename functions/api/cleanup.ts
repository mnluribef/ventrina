// functions/api/cleanup.ts
// Endpoint de limpieza programada: sesiones expiradas y registros obsoletos de rate limiting
// Protegido por SUPERADMIN_KEY — llamable desde cron externo o Cloudflare Scheduled Workers
import { getDB, jsonResponse } from './_helpers';
import type { Env, PagesHandler } from '../types';

/**
 * GET /api/cleanup — Purga sesiones expiradas y registros obsoletos.
 * Requiere cabecera X-Superadmin-Key para ejecutarse.
 */
export const onRequestGet: PagesHandler<Env> = async (context) => {
    const { env, request } = context;

    const key = request.headers.get('X-Superadmin-Key');
    if (!key || key !== env.SUPERADMIN_KEY) {
        return jsonResponse({ error: 'No autorizado.' }, 401);
    }

    const db = getDB(env);
    const now = Math.floor(Date.now() / 1000);
    const nowMs = Date.now();

    try {
        const [sessionsResult, rateLimitsResult] = await Promise.all([
            db.prepare('DELETE FROM sessions WHERE expires_at < ?')
                .bind(now)
                .run(),
            db.prepare('DELETE FROM rate_limits WHERE lockout_until < ? AND lockout_until != 0')
                .bind(nowMs)
                .run()
        ]);

        const deletedSessions   = sessionsResult?.meta?.changes ?? 0;
        const deletedRateLimits = rateLimitsResult?.meta?.changes ?? 0;

        console.log(JSON.stringify({
            type: 'cleanup_run',
            deletedSessions,
            deletedRateLimits,
            timestamp: new Date().toISOString()
        }));

        return jsonResponse({
            success: true,
            deletedSessions,
            deletedRateLimits,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[Cleanup] Error durante limpieza:', err);
        return jsonResponse({ error: 'Error durante limpieza.' }, 500);
    }
};
