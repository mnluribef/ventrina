// functions/api/billing.ts
// Endpoint para que cada tenant consulte su plan, límites, consumo actual e info de pago
import { verifySession, unauthorizedResponse } from "./_auth";
import { resolveTenant, tenantNotFoundResponse } from "./_tenant";
import { PLANS, checkProductLimit, checkOrderLimit } from "./_plans";
import { getDB, jsonResponse } from "./_helpers";
import { resolveAuthenticatedTenant } from "./_guards";
import { type Env, type PagesHandler, extractPaymentConfig } from '../types';

export const onRequestGet: PagesHandler<Env> = async (context) => {
    const { env, request } = context;
    const db = getDB(env);
    let { id: tenantId, tenant } = await resolveTenant(request, db, env.KV);

    // Solo los administradores del tenant pueden ver esta info
    const user = await verifySession(context, (tenantId && tenantId !== 'demo') ? tenantId : undefined);
    if (!user) return unauthorizedResponse();

    // Resolución correcta del tenant para usuarios autenticados (DRY — fix #5)
    ({ tenantId, tenant } = await resolveAuthenticatedTenant(db, env.KV, tenantId, tenant, user));

    if (!tenant) {
        return tenantNotFoundResponse();
    }

    try {
        const productStats = await checkProductLimit(db, tenant);
        const orderStats = await checkOrderLimit(db, tenant);
        
        const planKey = tenant.plan || 'basic';
        const planDetails = PLANS[planKey] || PLANS['basic'];

        // Datos para Pagos Manuales (B2B Venezuela) extraídos mediante ISP
        const paymentInfo = {
            ...extractPaymentConfig(env),
            monthlyPriceUsd: planDetails.monthlyPriceUsd
        };

        return jsonResponse({
            tenant: {
                id: tenant.id,
                name: tenant.name,
                plan: planDetails.name,
                planKey: planKey,
                hasAnalytics: ['pro', 'enterprise', 'demo'].includes(planKey),
                status: tenant.active === 1 ? 'Activo' : 'Suspendido',
                domain: tenant.domain || `${tenant.id}.ventrina.app`
            },
            usage: {
                products: {
                    current: productStats.current,
                    limit: productStats.limit,
                    percentage: Math.min(100, Math.round((productStats.current / productStats.limit) * 100))
                },
                ordersThisMonth: {
                    current: orderStats.current,
                    limit: orderStats.limit,
                    percentage: Math.min(100, Math.round((orderStats.current / orderStats.limit) * 100))
                }
            },
            billing: paymentInfo
        });

    } catch (err) {
        console.error("Error en GET /api/billing:", err);
        return jsonResponse({ error: "Error interno al consultar datos de facturación." }, 500);
    }
};
