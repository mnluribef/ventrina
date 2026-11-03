/**
 * Cloudflare Scheduled Worker: Limpieza periódica de sesiones y rate limits
 *
 * Se ejecuta mediante Cron Trigger en Cloudflare para purgar registros expirados en D1.
 * Dispara de forma segura el endpoint /api/cleanup del backend Pages.
 */

export default {
    async scheduled(controller, env) {
        const baseUrl = env.APP_BASE_URL || 'https://ventrina.app';
        const apiKey = env.SUPERADMIN_KEY;

        if (!apiKey) {
            console.error('[CronCleanup] ERROR: SUPERADMIN_KEY no está configurada.');
            return;
        }

        const endpoint = `${baseUrl}/api/cleanup`;
        console.log(`[CronCleanup] Iniciando ejecución de mantenimiento en: ${endpoint} (Cron: ${controller.cron})`);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Ventrina-CronWorker/1.0',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[CronCleanup] Falló la limpieza. HTTP ${response.status}: ${errorText}`);
                return;
            }

            const result = await response.json();
            console.log('[CronCleanup] Limpieza completada exitosamente:', JSON.stringify(result));
        } catch (err) {
            console.error('[CronCleanup] Excepción de red al ejecutar cleanup:', err.message);
        }
    },

    // Permite disparo manual de prueba mediante HTTP GET si se provee la clave
    async fetch(request, env) {
        const auth = request.headers.get('Authorization') || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();

        if (!env.SUPERADMIN_KEY || token !== env.SUPERADMIN_KEY) {
            return new Response(JSON.stringify({ error: 'No autorizado' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Ejecutar scheduled manualmente
        await this.scheduled({ cron: 'manual-trigger' }, env, null);
        return new Response(JSON.stringify({ message: 'Trigger manual de limpieza ejecutado' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    },
};
