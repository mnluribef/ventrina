// functions/api/_plans.ts
// Configuración de límites y capacidades de cada plan del SaaS
// OCP fix #6: El registro de planes es un objeto de datos separado de la lógica de verificación.
// Para añadir un nuevo plan, añade una entrada a PLANS_REGISTRY sin tocar checkProductLimit/checkOrderLimit.
import type { D1Database } from '@cloudflare/workers-types';
import type { TenantRow } from '../types';

export interface PlanConfig {
    name: string;
    monthlyPriceUsd: number;
    maxProducts: number;
    maxOrdersPerMonth: number;
    features: string[];
}

/**
 * Registro de planes disponibles. Para agregar un plan nuevo, añade una entrada aquí.
 * La lógica de negocio en checkProductLimit/checkOrderLimit no requiere modificación (OCP).
 */
export const PLANS: Record<string, PlanConfig> = {
    'basic': {
        name: 'Básico',
        monthlyPriceUsd: 15,
        maxProducts: 30,
        maxOrdersPerMonth: 100,
        features: ['catalog', 'whatsapp_orders']
    },
    'pro': {
        name: 'Profesional',
        monthlyPriceUsd: 30,
        maxProducts: 200,
        maxOrdersPerMonth: 1000,
        features: ['catalog', 'whatsapp_orders', 'inventory', 'analytics']
    },
    'enterprise': {
        name: 'Empresarial',
        monthlyPriceUsd: 99,
        maxProducts: 999999,
        maxOrdersPerMonth: 999999,
        features: ['catalog', 'whatsapp_orders', 'inventory', 'analytics', 'api', 'custom_domain']
    }
};

/** Plan por defecto cuando el tenant no tiene uno asignado */
const DEFAULT_PLAN = 'basic';

/**
 * Resuelve la configuración de un plan por su clave.
 * Si el plan no existe en el registro, retorna el plan básico.
 */
export function resolvePlan(planKey: string | undefined | null): PlanConfig {
    if (!planKey) return PLANS[DEFAULT_PLAN];
    return PLANS[planKey] ?? PLANS[DEFAULT_PLAN];
}

export interface LimitCheckResult {
    allowed: boolean;
    limit: number;
    current: number;
}

/**
 * Verifica si un tenant ha excedido su límite de productos.
 */
export async function checkProductLimit(
    db: D1Database,
    tenant: TenantRow | null
): Promise<LimitCheckResult> {
    const plan = resolvePlan(tenant?.plan);

    const row = await db.prepare(
        'SELECT COUNT(*) as total FROM products WHERE tenant_id = ? AND active = 1'
    ).bind(tenant?.id || 'demo').first<{ total: number }>();

    const total = row?.total ?? 0;

    return {
        allowed: total < plan.maxProducts,
        limit: plan.maxProducts,
        current: total
    };
}

/**
 * Verifica si un tenant ha excedido su límite de pedidos en el mes actual.
 */
export async function checkOrderLimit(
    db: D1Database,
    tenant: TenantRow | null
): Promise<LimitCheckResult> {
    const plan = resolvePlan(tenant?.plan);

    const date = new Date();
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();

    const row = await db.prepare(
        'SELECT COUNT(*) as total FROM orders WHERE tenant_id = ? AND created_at >= ?'
    ).bind(tenant?.id || 'demo', firstDayOfMonth).first<{ total: number }>();

    const total = row?.total ?? 0;

    return {
        allowed: total < plan.maxOrdersPerMonth,
        limit: plan.maxOrdersPerMonth,
        current: total
    };
}
