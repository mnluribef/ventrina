// functions/api/_guards.ts
// Helper centralizado de autenticación/autorización — encapsula: resolveTenant → CSRF → verifySession → role check
// Incluye: requireRole() genérico (LSP), resolveAuthenticatedTenant() (DRY — SRP fix #5)
import { validateCsrf, verifySession, unauthorizedResponse, forbiddenResponse } from './_auth';
import { resolveTenant, getTenantByIdCached } from './_tenant';
import { getDB } from './_helpers';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import type { UserSession, TenantRow, PagesContext, Env } from '../types';

export type GuardResult =
    | { ok: true; user: UserSession; tenantId: string; tenant: TenantRow | null }
    | { ok: false; response: Response };

/**
 * Resuelve el tenant correcto para un usuario ya autenticado.
 *
 * Problema que resuelve (DRY — fix #5):
 * resolveTenant() puede caer en 'demo' cuando la petición viene del dominio raíz
 * (ej: ventrina.app/admin). En ese caso, si el usuario ya está autenticado y tiene
 * un tenant_id real, éste debe usarse en lugar de 'demo'.
 *
 * También provee el fallback al objeto demo sintético cuando la BD no lo tiene.
 */
export async function resolveAuthenticatedTenant(
    db: D1Database,
    kv: KVNamespace | undefined,
    initialTenantId: string,
    initialTenant: TenantRow | null,
    user: UserSession
): Promise<{ tenantId: string; tenant: TenantRow | null }> {
    let tenantId = initialTenantId;
    let tenant   = initialTenant;

    // Si resolveTenant cayó en demo pero el usuario pertenece a otro tenant, correguir.
    if ((!tenant || tenantId === 'demo') && user.tenant_id && user.tenant_id !== 'demo') {
        const userTenant = await getTenantByIdCached(db, user.tenant_id, kv);
        if (userTenant) {
            tenant   = userTenant;
            tenantId = user.tenant_id;
        }
    }

    // Fallback defensivo para el tenant demo
    if (!tenant && (tenantId === 'demo' || user.tenant_id === 'demo')) {
        const demoTenant = await getTenantByIdCached(db, 'demo', kv);
        tenant = demoTenant ?? {
            id: 'demo',
            name: 'Ventrina Demo Store',
            plan: 'pro',
            template: 'restaurant',
            config_json: '{}',
            domain: 'demo.ventrina.app',
            whatsapp: null,
            active: 1,
            deleted_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    return { tenantId, tenant };
}

/**
 * Guard genérico que acepta uno o varios roles permitidos (LSP fix #12).
 *
 * Agrupa: resolveTenant → CSRF → verifySession → role check.
 *
 * Uso:
 * ```ts
 * const guard = await requireRole(['admin'], context);
 * if (!guard.ok) return guard.response;
 * const { user, tenantId, tenant } = guard;
 * ```
 */
export async function requireRole(
    roles: string[],
    context: PagesContext<Env>
): Promise<GuardResult> {
    const { request, env } = context;
    const db = getDB(env);
    const { id: tenantId, tenant } = await resolveTenant(request, db, env.KV);

    if (!validateCsrf(request, tenant?.domain)) {
        return { ok: false, response: forbiddenResponse('Verificación de seguridad CSRF fallida.') };
    }

    const user = await verifySession(context, tenantId);
    if (!user) {
        return { ok: false, response: unauthorizedResponse() };
    }

    if (!roles.includes(user.role)) {
        return { ok: false, response: forbiddenResponse() };
    }

    return { ok: true, user, tenantId, tenant: tenant ?? null };
}

/**
 * Verifica que la petición proviene de un admin autenticado del tenant correcto.
 */
export async function requireAdmin(context: PagesContext<Env>): Promise<GuardResult> {
    return requireRole(['admin'], context);
}

/**
 * Verifica que la petición proviene de un usuario autenticado (admin o staff) del tenant correcto.
 */
export async function requireStaffOrAdmin(context: PagesContext<Env>): Promise<GuardResult> {
    return requireRole(['admin', 'staff'], context);
}
