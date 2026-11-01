// functions/api/billing.ts
// Endpoint para que cada tenant consulte su plan, límites, consumo actual e info de pago
import { verifySession, unauthorizedResponse } from "./_auth";
import { resolveTenant, tenantNotFoundResponse, getTenantByIdCached } from "./_tenant";
import { PLANS, checkProductLimit, checkOrderLimit } from "./_plans";
import { getDB, jsonResponse } from "./_helpers";
import type { Env, PagesHandler } from '../types';

export const onRequestGet: PagesHandler<Env> = async (context) => {
    const { env, request } = context;
    const db = getDB(env);
    let { id: tenantId, tenant } = await resolveTenant(request, db, env.KV);

    // Solo los administradores del tenant pueden ver esta info
    const user = await verifySession(context, (tenantId && tenantId !== 'demo') ? tenantId : undefined);
    if (!user) return unauthorizedResponse();

    // Si resolveTenant no encontró el tenant o resolvió demo por defecto, pero el usuario tiene tenant_id:
    if ((!tenant || tenantId === 'demo') && user.tenant_id && user.tenant_id !== 'demo') {
        const userTenant = await getTenantByIdCached(db, user.tenant_id, env.KV);
        if (userTenant) {
            tenant = userTenant;
            tenantId = user.tenant_id;
        }
    }

    // Fallback defensivo para entorno de demostración
    if (!tenant && (tenantId === 'demo' || user.tenant_id === 'demo')) {
        const demoTenant = await getTenantByIdCached(db, 'demo', env.KV);
        if (demoTenant) {
            tenant = demoTenant;
        } else {
            tenant = {
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
    }

    if (!tenant) {
        return tenantNotFoundResponse();
    }

    try {
        const productStats = await checkProductLimit(db, tenant);
        const orderStats = await checkOrderLimit(db, tenant);
        
        const planKey = tenant.plan || 'basic';
        const planDetails = PLANS[planKey] || PLANS['basic'];

        // Datos para Pagos Manuales (B2B Venezuela)
        const paymentInfo = {
            method: env.PAYMENT_METHOD || "Transferencia Bancaria / Pago Móvil",
            bank: env.PAYMENT_BANK || "Banesco",
            phone: env.PAYMENT_PHONE || "No disponible",
            id: env.PAYMENT_ID || "No disponible",
            binancePay: env.PAYMENT_BINANCE || "pagos@ventrina.app",
            zelle: env.PAYMENT_ZELLE || "pagos@ventrina.app",
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
