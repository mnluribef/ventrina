import { type ConfirmModalOptions, getModalService } from './services/modal.service';
import { renderIconSvg } from '../components/common/icons';

interface BillingInfo {
    expiresAt?: string | null;
    paymentStatus?: 'active' | 'pending' | 'overdue';
    notes?: string;
    updatedAt?: string;
}

interface TenantItem {
    id: string;
    name: string;
    plan: string;
    active: number;
    created_at: string;
    template: string;
    whatsapp?: string | null;
    domain?: string | null;
    owner_email?: string | null;
    product_count?: number;
    order_count_month?: number;
    revenue_month?: number;
    billing?: BillingInfo | null;
}

interface SystemSummary {
    totalTenants: number;
    activeTenants: number;
    suspendedTenants: number;
    mrr: number;
    totalRevenueMonth: number;
    totalOrdersMonth: number;
    templateBreakdown: Record<string, number>;
}

function getIconSvg(name: string, extraClass = 'sa-icon-sm'): string {
    return renderIconSvg(name, { class: extraClass });
}

// Global State
let masterToken = sessionStorage.getItem('sa_token') || '';
let allTenants: TenantItem[] = [];
let activeTemplateFilter = 'all';
let activeStatusFilter: 'all' | 'active' | 'trial' | 'suspended' = 'all';

// DOM Elements
const loginStep = document.getElementById('sa-login-step');
const dashboardStep = document.getElementById('sa-dashboard-step');
const loginBtn = document.getElementById('sa-login-btn');
const passInput = document.getElementById('sa-password') as HTMLInputElement | null;
const passToggleBtn = document.getElementById('sa-password-toggle');
const errorMsg = document.getElementById('sa-error');
const tbody = document.getElementById('sa-tenants-list');
const logoutBtn = document.getElementById('sa-logout-btn');
const refreshBtn = document.getElementById('sa-refresh-btn');
const cleanupBtn = document.getElementById('sa-cleanup-btn');
const exportCsvBtn = document.getElementById('sa-export-csv-btn');

// Status Filter Tabs
const statusTabsContainer = document.getElementById('sa-status-tabs');
const badgeCountAll = document.getElementById('badge-count-all');
const badgeCountActive = document.getElementById('badge-count-active');
const badgeCountTrial = document.getElementById('badge-count-trial');
const badgeCountSuspended = document.getElementById('badge-count-suspended');

// Search & Filter Elements
const searchInput = document.getElementById('sa-search-input') as HTMLInputElement | null;
const searchClearBtn = document.getElementById('sa-search-clear');
const filterStatus = document.getElementById('sa-filter-status') as HTMLSelectElement | null;
const filterPlan = document.getElementById('sa-filter-plan') as HTMLSelectElement | null;
const filterBilling = document.getElementById('sa-filter-billing') as HTMLSelectElement | null;
const templateChipsContainer = document.getElementById('sa-template-chips');
const visibleCountEl = document.getElementById('sa-visible-count');

// Billing Modal Elements
const billingModal = document.getElementById('sa-billing-modal');
const modalCloseBtn = document.getElementById('sa-modal-close');
const modalCancelBtn = document.getElementById('modal-btn-cancel');
const modalSaveBtn = document.getElementById('modal-btn-save');
const modalTenantId = document.getElementById('modal-tenant-id') as HTMLInputElement | null;
const modalTenantName = document.getElementById('modal-tenant-name');
const modalExpiresDate = document.getElementById('modal-expires-date') as HTMLInputElement | null;
const modalPaymentStatus = document.getElementById('modal-payment-status') as HTMLSelectElement | null;
const modalBillingNotes = document.getElementById('modal-billing-notes') as HTMLTextAreaElement | null;
const modalPlus30Btn = document.getElementById('modal-btn-plus30');
const modalPlus365Btn = document.getElementById('modal-btn-plus365');

// Plan Modal Elements
const planModal = document.getElementById('sa-plan-modal');
const planModalCloseBtn = document.getElementById('sa-plan-modal-close');
const planModalCancelBtn = document.getElementById('plan-modal-btn-cancel');
const planModalSaveBtn = document.getElementById('plan-modal-btn-save');
const planModalTenantId = document.getElementById('plan-modal-tenant-id') as HTMLInputElement | null;
const planModalTenantName = document.getElementById('plan-modal-tenant-name');

// Toast Element
const toastEl = document.getElementById('sa-toast');
const toastMsg = document.getElementById('sa-toast-msg');
const toastIcon = document.getElementById('sa-toast-icon');
let toastTimer: number | null = null;

// Initialize
if (masterToken) {
    showDashboard();
}

// -------------------------------------------------------------
// Authentication Flow
// -------------------------------------------------------------

loginBtn?.addEventListener('click', handleLogin);
passInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
});

// Password Show/Hide Toggle
passToggleBtn?.addEventListener('click', () => {
    if (!passInput) return;
    const isPass = passInput.type === 'password';
    passInput.type = isPass ? 'text' : 'password';
    if (passToggleBtn) {
        passToggleBtn.innerHTML = getIconSvg(isPass ? 'eye-off' : 'eye', 'sa-icon-sm');
    }
});

async function handleLogin() {
    if (!passInput) return;
    const pass = passInput.value.trim();
    if (!pass) return;

    masterToken = `Bearer ${pass}`;

    try {
        const res = await fetch('/api/superadmin/tenants', {
            headers: { Authorization: masterToken },
        });

        if (res.ok) {
            sessionStorage.setItem('sa_token', masterToken);
            if (errorMsg) errorMsg.classList.add('hidden');
            showDashboard();
            return;
        }

        if (res.status === 503) {
            showError('El sistema Superadmin no está configurado (SUPERADMIN_KEY ausente).');
            return;
        }

        if (res.status === 401) {
            showError('Contraseña maestra incorrecta.');
            masterToken = '';
            return;
        }

        // Si estamos en servidor estático sin backend Pages Functions (HTTP 404)
        if (
            res.status === 404 &&
            (pass === 'demo' || pass === 'admin' || pass === 'cambia_esto_por_una_clave_segura_de_64_chars')
        ) {
            sessionStorage.setItem('sa_token', masterToken);
            if (errorMsg) errorMsg.classList.add('hidden');
            showDashboard();
            return;
        }

        showError('Contraseña maestra incorrecta.');
        masterToken = '';
    } catch {
        if (pass === 'demo' || pass === 'admin' || pass === 'cambia_esto_por_una_clave_segura_de_64_chars') {
            sessionStorage.setItem('sa_token', masterToken);
            if (errorMsg) errorMsg.classList.add('hidden');
            showDashboard();
            return;
        }
        showError('Error de conexión con el servidor.');
    }
}

function showError(msg: string) {
    if (!errorMsg) return;
    errorMsg.innerHTML = `${getIconSvg('alert-circle', 'sa-icon-sm')} <span>${escapeHtml(msg)}</span>`;
    errorMsg.classList.remove('hidden');
}

logoutBtn?.addEventListener('click', () => {
    sessionStorage.removeItem('sa_token');
    masterToken = '';
    dashboardStep?.classList.add('hidden');
    loginStep?.classList.remove('hidden');
    if (passInput) passInput.value = '';
});

refreshBtn?.addEventListener('click', () => {
    loadTenants();
    showToast('Datos del sistema actualizados', 'info');
});

// -------------------------------------------------------------
// Dashboard & Data Loading
// -------------------------------------------------------------

async function showDashboard() {
    loginStep?.classList.add('hidden');
    dashboardStep?.classList.remove('hidden');
    await loadTenants();
}

const DEMO_MOCK_TENANTS: TenantItem[] = [
    {
        id: 'fogon',
        name: 'El Fogón Venezolano',
        plan: 'enterprise',
        active: 1,
        created_at: '2026-08-15 10:00:00',
        template: 'restaurant',
        whatsapp: '584121234567',
        domain: null,
        owner_email: 'fogon@ventrina.app',
        product_count: 84,
        order_count_month: 230,
        revenue_month: 4620.5,
        billing: {
            expiresAt: '2026-11-25T00:00:00.000Z',
            paymentStatus: 'active',
            notes: 'Pagó anualidad Enterprise vía Binance Tx #94821 el 25/08.',
        },
    },
    {
        id: 'ferremax',
        name: 'Ferretería Industrial Max',
        plan: 'pro',
        active: 1,
        created_at: '2026-09-01 14:30:00',
        template: 'hardware',
        whatsapp: '584149876543',
        domain: 'ferremax.com.ve',
        owner_email: 'ventas@ferremax.com.ve',
        product_count: 185,
        order_count_month: 94,
        revenue_month: 3150.0,
        billing: {
            expiresAt: '2026-11-03T00:00:00.000Z',
            paymentStatus: 'active',
            notes: 'Renovación mensual Pro al día vía Transferencia Banesco.',
        },
    },
    {
        id: 'boutique-chic',
        name: 'Atelier & Moda Chic',
        plan: 'pro',
        active: 1,
        created_at: '2026-09-20 09:15:00',
        template: 'fashion',
        whatsapp: '584165551234',
        domain: null,
        owner_email: 'contacto@modachic.ve',
        product_count: 142,
        order_count_month: 62,
        revenue_month: 1890.0,
        billing: {
            expiresAt: '2026-10-31T00:00:00.000Z',
            paymentStatus: 'pending',
            notes: 'Aviso de cobro enviado por WhatsApp. Pendiente comprobante Pago Móvil.',
        },
    },
    {
        id: 'cybertech',
        name: 'CyberTech Store & Mobile',
        plan: 'enterprise',
        active: 1,
        created_at: '2026-07-10 16:45:00',
        template: 'tech',
        whatsapp: '584247778899',
        domain: 'cybertech.store',
        owner_email: 'soporte@cybertech.store',
        product_count: 310,
        order_count_month: 115,
        revenue_month: 6420.0,
        billing: {
            expiresAt: '2026-12-10T00:00:00.000Z',
            paymentStatus: 'active',
            notes: 'Plan Enterprise con soporte prioritario.',
        },
    },
    {
        id: 'repuestos-aragua',
        name: 'Autopartes & Frenos Aragua',
        plan: 'basic',
        active: 0,
        created_at: '2026-09-05 11:20:00',
        template: 'autoparts',
        whatsapp: '584129990011',
        domain: null,
        owner_email: 'gerencia@autopartesaragua.com',
        product_count: 28,
        order_count_month: 12,
        revenue_month: 420.0,
        billing: {
            expiresAt: '2026-10-15T00:00:00.000Z',
            paymentStatus: 'overdue',
            notes: 'Suspendido por mora de 15 días en Plan Básico.',
        },
    },
    {
        id: 'bodegon-la-victoria',
        name: 'Bodegón Gourmet La Victoria',
        plan: 'pro',
        active: 1,
        created_at: '2026-08-28 12:00:00',
        template: 'grocery',
        whatsapp: '584143334455',
        domain: null,
        owner_email: 'admin@bodegonlavictoria.com',
        product_count: 198,
        order_count_month: 180,
        revenue_month: 5120.0,
        billing: {
            expiresAt: '2026-11-28T00:00:00.000Z',
            paymentStatus: 'active',
            notes: 'Catálogo de alta rotación (198/200 prod). Candidato a Enterprise.',
        },
    },
];

function loadDemoTenants() {
    allTenants = DEMO_MOCK_TENANTS;
    updateStatsFallback(allTenants);
    updateStatusTabCounts();
    renderTemplateChips();
    applyFiltersAndRender();
}

async function loadTenants() {
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="sa-table-center">Cargando tiendas...</td></tr>';

    try {
        const res = await fetch('/api/superadmin/tenants', {
            headers: { Authorization: masterToken },
        });

        if (res.ok) {
            const data = (await res.json()) as any;
            if (Array.isArray(data)) {
                allTenants = data;
                updateStatsFallback(data);
            } else {
                allTenants = data.tenants || [];
                updateExecutiveKPIs(data.summary || {});
            }
            updateStatusTabCounts();
            renderTemplateChips();
            applyFiltersAndRender();
            return;
        }

        if (res.status === 401) {
            sessionStorage.removeItem('sa_token');
            window.location.reload();
            return;
        }

        // Entorno estático de preview local: cargar datos de demostración
        if (res.status === 404) {
            loadDemoTenants();
            return;
        }

        throw new Error(`Error HTTP: ${res.status}`);
    } catch (_err) {
        // En preview estático o sin conexión, cargar mock enriquecido
        loadDemoTenants();
    }
}

// -------------------------------------------------------------
// Executive KPIs & Summary
// -------------------------------------------------------------

function updateExecutiveKPIs(summary: Partial<SystemSummary>) {
    const total = summary.totalTenants ?? allTenants.length;
    const active = summary.activeTenants ?? allTenants.filter((t) => t.active === 1).length;
    const suspended = summary.suspendedTenants ?? total - active;
    const mrr = summary.mrr ?? 0;
    const gmv = summary.totalRevenueMonth ?? 0;
    const orders = summary.totalOrdersMonth ?? 0;

    const statTotal = document.getElementById('stat-total');
    const statActive = document.getElementById('stat-active');
    const statSuspended = document.getElementById('stat-suspended');
    const statActiveRatio = document.getElementById('stat-active-ratio');
    const statMrr = document.getElementById('stat-mrr');
    const statGmv = document.getElementById('stat-gmv');
    const statOrders = document.getElementById('stat-orders');

    if (statTotal) statTotal.textContent = String(total);
    if (statActive) statActive.textContent = `${active} activas`;
    if (statSuspended) statSuspended.textContent = `${suspended} susp.`;
    if (statActiveRatio) statActiveRatio.textContent = `${active}/${total} Activas`;
    if (statMrr) statMrr.textContent = `$${mrr.toLocaleString('en-US')}`;
    if (statGmv)
        statGmv.textContent = `$${gmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (statOrders) statOrders.textContent = String(orders);
}

function updateStatsFallback(tenants: TenantItem[]) {
    let mrr = 0;
    let gmv = 0;
    let orders = 0;
    for (const t of tenants) {
        if (t.active === 1) {
            mrr += t.plan === 'enterprise' ? 99 : t.plan === 'pro' ? 30 : 15;
        }
        gmv += Number(t.revenue_month || 0);
        orders += Number(t.order_count_month || 0);
    }
    updateExecutiveKPIs({
        totalTenants: tenants.length,
        activeTenants: tenants.filter((t) => t.active === 1).length,
        suspendedTenants: tenants.filter((t) => t.active !== 1).length,
        mrr,
        totalRevenueMonth: gmv,
        totalOrdersMonth: orders,
    });
}

function updateStatusTabCounts() {
    const total = allTenants.length;
    const active = allTenants.filter((t) => t.active === 1 && t.billing?.paymentStatus !== 'pending').length;
    const trial = allTenants.filter((t) => !t.billing?.expiresAt || t.billing?.paymentStatus === 'pending').length;
    const suspended = allTenants.filter((t) => t.active !== 1).length;

    if (badgeCountAll) badgeCountAll.textContent = String(total);
    if (badgeCountActive) badgeCountActive.textContent = String(active);
    if (badgeCountTrial) badgeCountTrial.textContent = String(trial);
    if (badgeCountSuspended) badgeCountSuspended.textContent = String(suspended);
}

// -------------------------------------------------------------
// Template Breakdown Filter Chips (Crisp SVGs)
// -------------------------------------------------------------

const TEMPLATE_NAMES: Record<string, { label: string; iconKey: string }> = {
    restaurant: { label: 'Restaurante', iconKey: 'utensils' },
    hardware: { label: 'Ferretería', iconKey: 'wrench' },
    fashion: { label: 'Moda & Ropa', iconKey: 'shirt' },
    tech: { label: 'Tecnología', iconKey: 'laptop' },
    autoparts: { label: 'Repuestos', iconKey: 'car' },
    grocery: { label: 'Bodegón / Super', iconKey: 'shopping-cart' },
};

function renderTemplateChips() {
    if (!templateChipsContainer) return;

    const counts: Record<string, number> = {};
    for (const t of allTenants) {
        const tpl = t.template || 'restaurant';
        counts[tpl] = (counts[tpl] || 0) + 1;
    }

    let chipsHtml = `
        <button type="button" class="sa-chip ${activeTemplateFilter === 'all' ? 'active' : ''}" data-template="all">
            ${getIconSvg('grid', 'sa-icon-sm')}
            <span>Todas (${allTenants.length})</span>
        </button>
    `;

    for (const [key, meta] of Object.entries(TEMPLATE_NAMES)) {
        const count = counts[key] || 0;
        if (count > 0 || activeTemplateFilter === key) {
            chipsHtml += `
                <button type="button" class="sa-chip ${activeTemplateFilter === key ? 'active' : ''}" data-template="${key}">
                    ${getIconSvg(meta.iconKey, 'sa-icon-sm')}
                    <span>${meta.label} (${count})</span>
                </button>
            `;
        }
    }

    templateChipsContainer.innerHTML = chipsHtml;
}

templateChipsContainer?.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement)?.closest('.sa-chip') as HTMLElement | null;
    if (!target) return;
    activeTemplateFilter = target.dataset.template || 'all';
    renderTemplateChips();
    applyFiltersAndRender();
});

// -------------------------------------------------------------
// Status Filter Tabs Logic (Todas, Activas, En Prueba, Suspendidas)
// -------------------------------------------------------------

statusTabsContainer?.addEventListener('click', (e) => {
    const tabBtn = (e.target as HTMLElement)?.closest('.sa-status-tab') as HTMLButtonElement | null;
    if (!tabBtn) return;
    const filterVal = (tabBtn.dataset.statusFilter || 'all') as 'all' | 'active' | 'trial' | 'suspended';
    activeStatusFilter = filterVal;

    // Update active tab styles & ARIA attributes
    const allTabs = statusTabsContainer.querySelectorAll('.sa-status-tab');
    allTabs.forEach((tab) => {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
    });
    tabBtn.classList.add('active');
    tabBtn.setAttribute('aria-selected', 'true');

    // Sync status dropdown selector
    if (filterStatus) {
        if (filterVal === 'active' || filterVal === 'suspended') {
            filterStatus.value = filterVal;
        } else {
            filterStatus.value = 'all';
        }
    }

    applyFiltersAndRender();
});

function updateStatusTabUI() {
    if (!statusTabsContainer) return;
    const allTabs = statusTabsContainer.querySelectorAll('.sa-status-tab');
    allTabs.forEach((tab) => {
        const btn = tab as HTMLButtonElement;
        const matches = btn.dataset.statusFilter === activeStatusFilter;
        btn.classList.toggle('active', matches);
        btn.setAttribute('aria-selected', matches ? 'true' : 'false');
    });
}

// -------------------------------------------------------------
// Search & Filter Logic
// -------------------------------------------------------------

searchInput?.addEventListener('input', () => {
    if (searchClearBtn) {
        if (searchInput.value.trim().length > 0) {
            searchClearBtn.classList.remove('hidden');
        } else {
            searchClearBtn.classList.add('hidden');
        }
    }
    applyFiltersAndRender();
});

searchClearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    searchClearBtn.classList.add('hidden');
    applyFiltersAndRender();
});

filterStatus?.addEventListener('change', () => {
    const val = filterStatus.value;
    activeStatusFilter = val === 'active' ? 'active' : val === 'suspended' ? 'suspended' : 'all';
    updateStatusTabUI();
    applyFiltersAndRender();
});

filterPlan?.addEventListener('change', applyFiltersAndRender);
filterBilling?.addEventListener('change', applyFiltersAndRender);

function applyFiltersAndRender() {
    const term = (searchInput?.value || '').toLowerCase().trim();
    const statusVal = filterStatus?.value || 'all';
    const planVal = filterPlan?.value || 'all';
    const billingVal = filterBilling?.value || 'all';

    const now = new Date();

    const filtered = allTenants.filter((t) => {
        // Template filter
        if (activeTemplateFilter !== 'all' && (t.template || 'restaurant') !== activeTemplateFilter) {
            return false;
        }

        // Status Tabs filter
        if (activeStatusFilter === 'active') {
            if (t.active !== 1 || t.billing?.paymentStatus === 'pending') return false;
        } else if (activeStatusFilter === 'trial') {
            const isTrial = !t.billing?.expiresAt || t.billing?.paymentStatus === 'pending';
            if (!isTrial) return false;
        } else if (activeStatusFilter === 'suspended') {
            if (t.active === 1) return false;
        }

        // Status dropdown filter (granular)
        if (statusVal === 'active' && t.active !== 1) return false;
        if (statusVal === 'suspended' && t.active === 1) return false;

        // Plan filter
        if (planVal !== 'all' && t.plan !== planVal) return false;

        // Billing filter
        if (billingVal !== 'all') {
            const expDateStr = t.billing?.expiresAt;
            if (!expDateStr) {
                if (billingVal !== 'warning') return false;
            } else {
                const expDate = new Date(expDateStr);
                const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (billingVal === 'active' && diffDays < 5) return false;
                if (billingVal === 'warning' && (diffDays < 0 || diffDays > 5)) return false;
                if (billingVal === 'overdue' && diffDays >= 0) return false;
            }
        }

        // Text search (ID, name, whatsapp, owner_email)
        if (term) {
            const matchesId = t.id.toLowerCase().includes(term);
            const matchesName = (t.name || '').toLowerCase().includes(term);
            const matchesWa = (t.whatsapp || '').toLowerCase().includes(term);
            const matchesEmail = (t.owner_email || '').toLowerCase().includes(term);
            if (!matchesId && !matchesName && !matchesWa && !matchesEmail) {
                return false;
            }
        }

        return true;
    });

    if (visibleCountEl) {
        visibleCountEl.innerHTML = `Mostrando <strong>${filtered.length}</strong> de <strong>${allTenants.length}</strong> tiendas registradas`;
    }

    renderTable(filtered);
}

// -------------------------------------------------------------
// Table Rendering (No Inline CSS, Pure SVG Icons, High Aesthetics)
// -------------------------------------------------------------

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name.substring(0, 2) || 'VT').toUpperCase();
}

function renderTable(tenants: TenantItem[]) {
    if (!tbody) return;

    if (tenants.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="8" class="sa-table-center">No se encontraron tiendas con los filtros seleccionados.</td></tr>';
        return;
    }

    const now = new Date();

    tbody.innerHTML = tenants
        .map((t) => {
            const isActive = t.active === 1;
            const statusBadge = isActive
                ? `<span class="badge badge-active">${getIconSvg('check-circle', 'sa-icon-xs')} Activo</span>`
                : `<span class="badge badge-suspended">${getIconSvg('ban', 'sa-icon-xs')} Suspendido</span>`;

            const templateMeta = TEMPLATE_NAMES[t.template] || { label: t.template, iconKey: 'grid' };

            // Plan Tier Badge representation
            let planBadgeHtml = '';
            let planLabel = '';
            let planIconKey = 'box';
            let planPrice = '$15';

            if (t.plan === 'enterprise') {
                planLabel = 'Empresarial';
                planIconKey = 'sparkles';
                planPrice = '$99';
                planBadgeHtml = `
                    <span class="badge-tier badge-tier-enterprise">
                        ${getIconSvg(planIconKey, 'sa-icon-xs')}
                        <span>${planLabel}</span>
                    </span>
                `;
            } else if (t.plan === 'pro') {
                planLabel = 'Profesional';
                planIconKey = 'zap';
                planPrice = '$30';
                planBadgeHtml = `
                    <span class="badge-tier badge-tier-pro">
                        ${getIconSvg(planIconKey, 'sa-icon-xs')}
                        <span>${planLabel}</span>
                    </span>
                `;
            } else {
                planLabel = 'Básico';
                planIconKey = 'box';
                planPrice = '$15';
                planBadgeHtml = `
                    <span class="badge-tier badge-tier-basic">
                        ${getIconSvg(planIconKey, 'sa-icon-xs')}
                        <span>${planLabel}</span>
                    </span>
                `;
            }

            // Usage and limits
            const prodCount = Number(t.product_count || 0);
            const orderCount = Number(t.order_count_month || 0);
            const revMonth = Number(t.revenue_month || 0);
            const maxProd = t.plan === 'basic' ? 30 : t.plan === 'pro' ? 200 : '∞';
            const isNearLimit = typeof maxProd === 'number' && prodCount >= maxProd;
            const usageBadgeClass = isNearLimit ? 'sa-usage-badge limit-warning' : 'sa-usage-badge';

            // Billing status calculation
            let billingBadgeHtml = `<span class="billing-badge billing-badge-warning">${getIconSvg('alert-triangle', 'sa-icon-xs')} Trial / Sin fecha</span>`;
            let daysRemaining: number | null = null;

            if (t.billing?.expiresAt) {
                const expDate = new Date(t.billing.expiresAt);
                daysRemaining = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                if (daysRemaining < 0) {
                    billingBadgeHtml = `<span class="billing-badge billing-badge-overdue">${getIconSvg('alert-circle', 'sa-icon-xs')} Vencido (${Math.abs(daysRemaining)}d)</span>`;
                } else if (daysRemaining <= 5) {
                    billingBadgeHtml = `<span class="billing-badge billing-badge-warning">${getIconSvg('alert-triangle', 'sa-icon-xs')} Vence en ${daysRemaining}d</span>`;
                } else {
                    billingBadgeHtml = `<span class="billing-badge billing-badge-active">${getIconSvg('check-circle', 'sa-icon-xs')} Al día (${daysRemaining}d)</span>`;
                }
            }

            // WhatsApp payment reminder URL
            const cleanWa = (t.whatsapp || '').replace(/[^0-9]/g, '');
            let waButtonHtml = '';
            if (cleanWa) {
                const reminderMsg = encodeURIComponent(
                    `Hola ${t.name}, te saludamos de Ventrina SaaS 👋. Te recordamos la cuota mensual de tu catálogo virtual (Plan ${t.plan.toUpperCase()}). ¿Deseas renovar tu servicio hoy? Quedamos atentos.`,
                );
                waButtonHtml = `
                <a href="https://wa.me/${cleanWa}?text=${reminderMsg}" target="_blank" rel="noopener noreferrer" class="btn-mini btn-mini-wa" title="Enviar recordatorio de cobro por WhatsApp" aria-label="Enviar recordatorio de cobro por WhatsApp">
                    ${getIconSvg('whatsapp', 'sa-icon-sm')}
                    <span>Cobrar</span>
                </a>
            `;
            }

            // URLs & Contact
            const storeUrl = t.domain ? `https://${t.domain}` : `https://${t.id}.ventrina.app`;
            const waContactLink = cleanWa
                ? `<a href="https://wa.me/${cleanWa}" target="_blank" rel="noopener noreferrer" class="whatsapp-link-sm" title="Contactar vía WhatsApp">${getIconSvg('whatsapp', 'sa-icon-sm')} +${cleanWa}</a>`
                : '<span class="tenant-meta-sub">Sin WhatsApp</span>';

            const ownerEmailDisplay = t.owner_email
                ? `<span class="owner-email-sm" title="Dueño / Admin">${getIconSvg('mail', 'sa-icon-sm')} ${escapeHtml(t.owner_email)}</span>`
                : '';

            const avatarInitials = getInitials(t.name || t.id);

            return `
            <tr>
                <td>
                    <div class="tenant-cell-main">
                        <div class="tenant-avatar">${avatarInitials}</div>
                        <div class="tenant-identity-meta">
                            <a href="${storeUrl}" target="_blank" rel="noopener noreferrer" class="tenant-link">
                                <span>${t.id}.ventrina.app</span>
                                ${getIconSvg('external-link', 'sa-icon-sm')}
                            </a>
                            <span class="tenant-id-sub">${t.id}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="tenant-owner-row">
                        <span class="tenant-business-name">${escapeHtml(t.name)}</span>
                        <div class="tenant-meta-sub">
                            ${waContactLink}
                            ${ownerEmailDisplay}
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge badge-template">
                        ${getIconSvg(templateMeta.iconKey, 'sa-icon-xs')}
                        <span>${templateMeta.label}</span>
                    </span>
                </td>
                <td>
                    <div class="tenant-plan-col">
                        <div class="tenant-plan-header">
                            ${planBadgeHtml}
                            <span class="tier-price">${planPrice}/m</span>
                        </div>
                        <div class="tenant-usage-row">
                            <span class="${usageBadgeClass}">${prodCount} / ${maxProd} prod.</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="billing-cell">
                        ${billingBadgeHtml}
                        <div class="billing-actions-row">
                            <button type="button" class="btn-mini" data-action="manage-billing" data-tenant-id="${t.id}" title="Configurar fecha de expiración y notas" aria-label="Gestionar facturación de ${escapeHtml(t.name)}">
                                ${getIconSvg('calendar-cog', 'sa-icon-sm')}
                                <span>Facturación</span>
                            </button>
                            ${waButtonHtml}
                        </div>
                    </div>
                </td>
                <td>
                    <div class="sa-usage-sub">
                        <strong>${orderCount}</strong> pedidos este mes
                    </div>
                    <div class="sa-usage-sub">
                        <strong>$${revMonth.toFixed(2)}</strong> transaccionados
                    </div>
                </td>
                <td>${statusBadge}</td>
                <td class="sa-table-right">
                    <div class="table-actions-cell">
                        <a href="${storeUrl}" target="_blank" rel="noopener noreferrer" class="sa-btn-action sa-btn-view" title="Ver catálogo público de ${escapeHtml(t.name)}" aria-label="Ver tienda pública ${escapeHtml(t.name)}">
                            ${getIconSvg('external-link', 'sa-icon-xs')}
                            <span>Ver</span>
                        </a>
                        <button type="button" class="sa-btn-action sa-btn-edit-plan" data-action="open-plan-modal" data-tenant-id="${t.id}" data-current-plan="${t.plan}" data-tenant-name="${escapeHtml(t.name)}" title="Editar plan y límites de ${escapeHtml(t.name)}" aria-label="Editar plan de suscripción de ${escapeHtml(t.name)}">
                            ${getIconSvg('zap', 'sa-icon-xs')}
                            <span>Plan</span>
                        </button>
                        <button type="button" class="sa-btn-action sa-btn-admin" data-action="impersonate" data-tenant-id="${t.id}" title="Acceso de soporte como Administrador a ${escapeHtml(t.name)}" aria-label="Entrar como administrador a ${escapeHtml(t.name)}">
                            ${getIconSvg('user-check', 'sa-icon-xs')}
                            <span>Admin</span>
                        </button>
                        <button type="button" class="sa-btn-action ${isActive ? 'sa-btn-suspend' : 'sa-btn-activate'}" data-action="toggle-status" data-tenant-id="${t.id}" data-status="${isActive ? 0 : 1}" title="${isActive ? 'Suspender acceso a la tienda' : 'Reactivar acceso a la tienda'}" aria-label="${isActive ? 'Suspender tienda ' + escapeHtml(t.name) : 'Reactivar tienda ' + escapeHtml(t.name)}">
                            ${getIconSvg(isActive ? 'ban' : 'power', 'sa-icon-xs')}
                            <span>${isActive ? 'Suspender' : 'Activar'}</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        })
        .join('');
}

// -------------------------------------------------------------
// Action Handlers & Event Delegation
// -------------------------------------------------------------

if (tbody) {
    tbody.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement | null;

        // 1. Open Plan Modal
        const btnPlan = target?.closest('button[data-action="open-plan-modal"]') as HTMLButtonElement | null;
        if (btnPlan) {
            const tenantId = btnPlan.dataset.tenantId;
            const currentPlan = btnPlan.dataset.currentPlan || 'basic';
            const tenantName = btnPlan.dataset.tenantName || tenantId || '';
            if (tenantId) {
                openPlanModal(tenantId, currentPlan, tenantName);
            }
            return;
        }

        // 2. Toggle Status (Suspend / Reactivate)
        const btnSuspend = target?.closest('button[data-action="toggle-status"]') as HTMLButtonElement | null;
        if (btnSuspend) {
            const tenantId = btnSuspend.dataset.tenantId;
            const newStatus = Number(btnSuspend.dataset.status);
            if (!tenantId) return;
            const actionText = newStatus === 1 ? 'ACTIVAR' : 'SUSPENDER';
            const confirmed = await showSuperAdminConfirmModal({
                title: newStatus === 1 ? '¿Activar tienda?' : '¿Suspender tienda?',
                subtitle: `Tienda: ${tenantId}`,
                message: `¿Estás seguro que deseas ${actionText.toLowerCase()} a la tienda "${tenantId}"? ${newStatus === 1 ? 'El catálogo y pedidos volverán a estar disponibles.' : 'El acceso a la tienda y catálogo quedará bloqueado temporalmente.'}`,
                confirmText: newStatus === 1 ? 'Activar Tienda' : 'Suspender Tienda',
                cancelText: 'Cancelar',
                variant: newStatus === 1 ? 'primary' : 'danger',
                icon: newStatus === 1 ? 'power' : 'ban',
            });
            if (!confirmed) return;
            await updateTenant(tenantId, 'toggle_status', newStatus);
            return;
        }

        // 3. Impersonate (Admin Session)
        const btnImpersonate = target?.closest('button[data-action="impersonate"]') as HTMLButtonElement | null;
        if (btnImpersonate) {
            const tenantId = btnImpersonate.dataset.tenantId;
            if (!tenantId) return;
            await handleImpersonate(tenantId);
            return;
        }

        // 4. Manage Billing
        const btnBilling = target?.closest('button[data-action="manage-billing"]') as HTMLButtonElement | null;
        if (btnBilling) {
            const tenantId = btnBilling.dataset.tenantId;
            if (!tenantId) return;
            openBillingModal(tenantId);
            return;
        }
    });
}

// Impersonate API Call
async function handleImpersonate(tenantId: string) {
    showToast(`Iniciando sesión de soporte en "${tenantId}"...`, 'info');

    try {
        const res = await fetch('/api/superadmin/tenants', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: masterToken,
            },
            body: JSON.stringify({ tenantId, action: 'impersonate' }),
        });

        const data = (await res.json()) as any;
        if (res.ok && data.success) {
            showToast(`Sesión de soporte creada para ${tenantId}`, 'success');
            window.open(data.redirectUrl, '_blank');
        } else {
            showToast(data.error || 'Error al iniciar sesión como administrador.', 'error');
        }
    } catch {
        showToast('Error de conexión al impersonar.', 'error');
    }
}

// Update Tenant Generic
async function updateTenant(tenantId: string, action: string, value: any) {
    try {
        const res = await fetch('/api/superadmin/tenants', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: masterToken,
            },
            body: JSON.stringify({ tenantId, action, value }),
        });

        const data = (await res.json()) as any;
        if (res.ok) {
            showToast(data.message || 'Actualizado correctamente.', 'success');
            await loadTenants();
        } else {
            showToast(data.error || 'Error al actualizar.', 'error');
        }
    } catch {
        showToast('Error de red al actualizar tienda.', 'error');
    }
}

// -------------------------------------------------------------
// Plan Management Modal
// -------------------------------------------------------------

function openPlanModal(tenantId: string, currentPlan: string, tenantName?: string) {
    if (!planModal) return;
    if (planModalTenantId) planModalTenantId.value = tenantId;
    if (planModalTenantName) {
        planModalTenantName.textContent = tenantName ? `${tenantName} (${tenantId}.ventrina.app)` : tenantId;
    }
    const radio = planModal.querySelector(
        `input[name="sa-plan-choice"][value="${currentPlan}"]`,
    ) as HTMLInputElement | null;
    if (radio) {
        radio.checked = true;
    }
    planModal.classList.remove('hidden');
}

function closePlanModal() {
    planModal?.classList.add('hidden');
}

planModalCloseBtn?.addEventListener('click', closePlanModal);
planModalCancelBtn?.addEventListener('click', closePlanModal);

planModalSaveBtn?.addEventListener('click', async () => {
    if (!planModalTenantId) return;
    const tenantId = planModalTenantId.value;
    const checkedRadio = planModal?.querySelector('input[name="sa-plan-choice"]:checked') as HTMLInputElement | null;
    if (!checkedRadio) return;
    const newPlan = checkedRadio.value;

    const confirmed = await showSuperAdminConfirmModal({
        title: '¿Confirmar cambio de plan?',
        subtitle: `Tienda: ${tenantId}`,
        message: `¿Cambiar el plan de "${tenantId}" a ${newPlan.toUpperCase()}? Se actualizarán los límites de catálogo y facturación.`,
        confirmText: 'Actualizar Plan',
        cancelText: 'Cancelar',
        variant: 'warning',
        icon: 'zap',
    });
    if (!confirmed) return;

    closePlanModal();
    await updateTenant(tenantId, 'change_plan', newPlan);
});

// -------------------------------------------------------------
// Billing Management Modal
// -------------------------------------------------------------

function openBillingModal(tenantId: string) {
    const tenant = allTenants.find((t) => t.id === tenantId);
    if (!tenant || !billingModal) return;

    if (modalTenantId) modalTenantId.value = tenant.id;
    if (modalTenantName) modalTenantName.textContent = `${tenant.name} (${tenant.id}.ventrina.app)`;

    const expiresAt = tenant.billing?.expiresAt ? tenant.billing.expiresAt.substring(0, 10) : '';
    if (modalExpiresDate) modalExpiresDate.value = expiresAt;
    if (modalPaymentStatus) modalPaymentStatus.value = tenant.billing?.paymentStatus || 'active';
    if (modalBillingNotes) modalBillingNotes.value = tenant.billing?.notes || '';

    billingModal.classList.remove('hidden');
}

function closeBillingModal() {
    billingModal?.classList.add('hidden');
}

modalCloseBtn?.addEventListener('click', closeBillingModal);
modalCancelBtn?.addEventListener('click', closeBillingModal);

modalPlus30Btn?.addEventListener('click', () => {
    if (!modalExpiresDate) return;
    const base = modalExpiresDate.value ? new Date(modalExpiresDate.value) : new Date();
    base.setDate(base.getDate() + 30);
    modalExpiresDate.value = base.toISOString().substring(0, 10);
});

modalPlus365Btn?.addEventListener('click', () => {
    if (!modalExpiresDate) return;
    const base = modalExpiresDate.value ? new Date(modalExpiresDate.value) : new Date();
    base.setFullYear(base.getFullYear() + 1);
    modalExpiresDate.value = base.toISOString().substring(0, 10);
});

modalSaveBtn?.addEventListener('click', async () => {
    if (!modalTenantId) return;
    const tenantId = modalTenantId.value;
    const expiresAt = modalExpiresDate?.value ? new Date(modalExpiresDate.value).toISOString() : null;
    const paymentStatus = modalPaymentStatus?.value || 'active';
    const notes = modalBillingNotes?.value || '';

    await updateTenant(tenantId, 'update_billing', {
        expiresAt,
        paymentStatus,
        notes,
    });

    closeBillingModal();
});

// -------------------------------------------------------------
// Universal Interactive Confirmation Modal
// -------------------------------------------------------------

const saConfirmService = getModalService('sa-confirm-modal');

function showSuperAdminConfirmModal(options: ConfirmModalOptions): Promise<boolean> {
    return saConfirmService.confirm(options);
}

// -------------------------------------------------------------
// Maintenance / Cleanup Endpoint Call
// -------------------------------------------------------------

cleanupBtn?.addEventListener('click', async () => {
    const confirmed = await showSuperAdminConfirmModal({
        title: 'Mantenimiento del Sistema',
        subtitle: 'Cloudflare Edge Maintenance',
        message:
            '¿Deseas ejecutar el mantenimiento del sistema (purga de sesiones inactivas y limpieza de rate-limits)?',
        confirmText: 'Ejecutar Mantenimiento',
        cancelText: 'Cancelar',
        variant: 'warning',
        icon: 'refresh-cw',
    });
    if (!confirmed) {
        return;
    }

    showToast('Ejecutando mantenimiento en Cloudflare...', 'info');

    try {
        const res = await fetch('/api/cleanup', {
            method: 'POST',
            headers: { Authorization: masterToken },
        });

        const data = (await res.json()) as any;
        if (res.ok && data.success) {
            const sessionsPurged = data.purged?.sessions ?? 0;
            showToast(`Mantenimiento completado: ${sessionsPurged} sesiones inactivas purgadas.`, 'success');
        } else {
            showToast(data.error || 'Error al ejecutar mantenimiento.', 'error');
        }
    } catch {
        showToast('Error de red al conectar con endpoint de mantenimiento.', 'error');
    }
});

// -------------------------------------------------------------
// Export to CSV
// -------------------------------------------------------------

exportCsvBtn?.addEventListener('click', () => {
    if (allTenants.length === 0) {
        showToast('No hay tiendas para exportar.', 'error');
        return;
    }

    const headers = [
        'ID Subdominio',
        'Nombre del Negocio',
        'Email Propietario',
        'WhatsApp',
        'Plantilla',
        'Plan',
        'Estado',
        'Total Productos',
        'Pedidos Este Mes',
        'Ventas Mes (USD)',
        'Vencimiento Facturacion',
        'Estado Cobro',
        'Notas Cobro',
        'Fecha Registro',
    ];

    const rows = allTenants.map((t) => [
        t.id,
        `"${(t.name || '').replace(/"/g, '""')}"`,
        t.owner_email || '',
        t.whatsapp || '',
        t.template || 'restaurant',
        t.plan,
        t.active === 1 ? 'Activo' : 'Suspendido',
        t.product_count || 0,
        t.order_count_month || 0,
        Number(t.revenue_month || 0).toFixed(2),
        t.billing?.expiresAt ? t.billing.expiresAt.substring(0, 10) : 'N/A',
        t.billing?.paymentStatus || 'active',
        `"${(t.billing?.notes || '').replace(/"/g, '""')}"`,
        t.created_at ? t.created_at.substring(0, 10) : '',
    ]);

    const csvContent = `\uFEFF${[headers.join(','), ...rows.map((r) => r.join(','))].join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().substring(0, 10);
    link.setAttribute('download', `ventrina_tiendas_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Archivo CSV generado y descargado.', 'success');
});

// -------------------------------------------------------------
// Helpers & Toast Notifications
// -------------------------------------------------------------

function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(message: string, type: 'info' | 'success' | 'error' = 'info') {
    if (!toastEl || !toastMsg || !toastIcon) return;

    if (toastTimer) clearTimeout(toastTimer);

    toastMsg.textContent = message;
    toastEl.className = `sa-toast ${type}`;
    const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
    toastIcon.innerHTML = getIconSvg(iconName, 'sa-icon');

    toastEl.classList.remove('hidden');

    toastTimer = window.setTimeout(() => {
        toastEl.classList.add('hidden');
    }, 3800);
}
